import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { PlanGeneratorService } from './plan-generator.service';
import { UserProfileService } from '../../user/user-profile';
import { Goal } from '../entities/goal.entity';
import { AiService } from '../../ai/ai.service';
import { PlanValidatorService } from '../plan-validator/plan-validator.service';
import { PlanGeneratorParser } from './plan-generator.parser';
import { ExerciseService } from '../../routines/templates/exercise/exercise.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PlanMaterializerService } from '../plan-materializer/plan-materializer.service';

describe('PlanGeneratorService', () => {
  let service: PlanGeneratorService;

  const USER_ID = '507f1f77bcf86cd799439011';
  const PROFILE_ID = '64f000000000000000000001';
  const GOAL_DB_ID = new Types.ObjectId('64f000000000000000000002');

  const userProfileServiceMock = {
    getFullProfileContext: jest.fn(),
  };

  const goalModelMock = {
    create: jest.fn(),
  };

  const aiServiceMock = {
    executePrompt: jest.fn(),
  };

  const planValidatorMock = {
    validate: jest.fn(),
  };

  const exerciseServiceMock = {
    findAll: jest.fn(),
  };

  const auditLogsServiceMock = {
    logAsync: jest.fn(),
  };

  const validProfileContext = () => ({
    profile: {
      _id: new Types.ObjectId(PROFILE_ID),
      gender: 'M',
      birthDate: new Date('1995-06-15'),
      heightCm: 178,
      weightKg: 75,
    },
    goal: {
      primaryGoal: 'muscle_gain',
      secondaryGoals: [],
      trainingExperience: 'intermediate',
      timelineWeeks: 8,
    },
    schedule: { daysPerWeek: 5, preferredDays: [], sessionDurationMin: 60 },
  });

  const buildPlanJson = () => ({
    title: 'PPL IA',
    focus: 'muscle_gain',
    durationWeeks: 8,
    daysPerWeek: 5,
    days: Array.from({ length: 7 }, (_, i) => ({
      order: i + 1,
      isRest: i % 2 === 1,
      focus: i % 2 === 1 ? null : 'push',
      exercises:
        i % 2 === 1
          ? []
          : [
              {
                name: 'Press Banca',
                plannedSets: 4,
                plannedReps: '8-10',
              },
            ],
    })),
  });

  const stubAiResponse = () => {
    const planJson = buildPlanJson();
    aiServiceMock.executePrompt.mockResolvedValue({
      rawContent: JSON.stringify(planJson),
      modelUsed: 'llama-3.3-70b',
      promptUsed: 'sys\nusr',
      tokensUsed: 123,
    });
    return planJson;
  };

  beforeAll(() => {
    process.env.PREFERRED_AI_PROVIDER = 'test-provider';
  });

  afterAll(() => {
    delete process.env.PREFERRED_AI_PROVIDER;
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    userProfileServiceMock.getFullProfileContext.mockResolvedValue(
      validProfileContext(),
    );
    planValidatorMock.validate.mockResolvedValue({
      valid: true,
      missing: [],
      recommended: [],
    });
    goalModelMock.create.mockResolvedValue({ _id: GOAL_DB_ID });
    exerciseServiceMock.findAll.mockResolvedValue([
      { id: 'ex-1', name: 'Press Banca', category: 'chest' },
    ]);
    stubAiResponse();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanGeneratorService,
        // real: solo depende del ExerciseService mockeado
        PlanMaterializerService,
        { provide: UserProfileService, useValue: userProfileServiceMock },
        { provide: getModelToken(Goal.name), useValue: goalModelMock },
        { provide: AiService, useValue: aiServiceMock },
        { provide: PlanValidatorService, useValue: planValidatorMock },
        { provide: ExerciseService, useValue: exerciseServiceMock },
        { provide: AuditLogsService, useValue: auditLogsServiceMock },
        PlanGeneratorParser,
      ],
    }).compile();

    service = module.get<PlanGeneratorService>(PlanGeneratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validación previa', () => {
    it('lanza BadRequestException con el detalle de campos faltantes', async () => {
      planValidatorMock.validate.mockResolvedValue({
        valid: false,
        missing: ['UserProfile.weightKg: Peso no especificado'],
        recommended: [],
      });

      try {
        await service.generatePlan(USER_ID);
        throw new Error('debería haber fallado');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as any;
        expect(response.message).toContain(
          'Faltan datos obligatorios para generar el plan',
        );
        expect(response.missing).toContain(
          'UserProfile.weightKg: Peso no especificado',
        );
      }
      expect(userProfileServiceMock.getFullProfileContext).not.toHaveBeenCalled();
    });
  });

  describe('perfil inexistente', () => {
    it('lanza NotFoundException si el contexto no trae perfil', async () => {
      userProfileServiceMock.getFullProfileContext.mockResolvedValue({
        profile: null,
      });

      await expect(service.generatePlan(USER_ID)).rejects.toThrow(
        new NotFoundException('User profile not found'),
      );
      expect(goalModelMock.create).not.toHaveBeenCalled();
    });
  });

  describe('generatePlan (flujo feliz)', () => {
    it('orquesta validación → snapshot → IA → parseo → weekLog', async () => {
      const planJson = stubAiResponse();

      const result = await service.generatePlan(USER_ID);

      // snapshot de objetivo capturado con el contexto de IA
      expect(goalModelMock.create).toHaveBeenCalledTimes(1);
      const goalArgs = goalModelMock.create.mock.calls[0][0];
      expect(goalArgs.userId).toBe(USER_ID);
      expect(goalArgs.contextSnapshot.biometrics.weightKg).toBe(75);
      expect(goalArgs.contextSnapshot.goal.primary).toBe('muscle_gain');
      expect(goalArgs.capturedAt).toBeInstanceOf(Date);

      // catálogo mapeado al prompt
      expect(exerciseServiceMock.findAll).toHaveBeenCalled();

      // llamada a la IA con el proveedor configurado y el catálogo solo con nombres
      expect(aiServiceMock.executePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          providerName: 'test-provider',
          systemPrompt: expect.stringContaining('formato JSON válido'),
          userPrompt: expect.stringContaining('- Press Banca'),
        }),
      );
      const promptArgs = aiServiceMock.executePrompt.mock.calls[0][0];
      expect(promptArgs.userPrompt).not.toContain('ex-1');

      // resultado consolidado
      expect(result.goalId).toBe(GOAL_DB_ID.toString());
      expect(result.userProfileId).toBe(PROFILE_ID);
      expect(result.weekLog.days).toHaveLength(7);
      expect(result.sessions).toHaveLength(4); // días no-rest del plan

      // sesiones creadas solo para días de entrenamiento
      result.sessions.forEach((session) => {
        expect(session.status).toBe('not_started');
        expect(session.userId).toBe(USER_ID);
        expect(session.weekLogId).toBe(result.weekLog.id);
        expect(session.exercises[0].exerciseId).toBe('ex-1');
      });

      // snapshot de IA con la respuesta cruda parseada
      expect(result.aiSnapshot.rawResponse).toEqual(planJson);
      expect(result.aiSnapshot.modelUsed).toBe('llama-3.3-70b');
      expect(result.aiSnapshot.tokensUsed).toBe(123);
      expect(result.aiSnapshot.promptUsed).toBe('sys\nusr');

      // metadata derivada del plan parseado
      expect(result.metadata).toEqual({
        title: 'PPL IA',
        focus: 'muscle_gain',
        durationWeeks: 8,
        daysPerWeek: 5,
      });
    });

    it('propaga el comentario del usuario en el prompt', async () => {
      await service.generatePlan(USER_ID, 'sin peso muerto por lesión');

      const callArgs = aiServiceMock.executePrompt.mock.calls[0][0];
      expect(callArgs.userPrompt).toContain('sin peso muerto por lesión');
    });
  });

  describe('lock de generación concurrente (in-flight)', () => {
    let resolveAi!: (value: any) => void;
    let rejectAi!: (reason?: any) => void;

    const holdAiInFlight = () => {
      aiServiceMock.executePrompt.mockImplementationOnce(
        () =>
          new Promise((res, rej) => {
            resolveAi = res;
            rejectAi = rej;
          }),
      );
    };

    // Vacía la cola de microtareas para que la cadena de generación
    // llegue hasta la llamada a IA suspendida.
    const flushPromises = () => new Promise((r) => setTimeout(r, 0));

    it('comparte la misma promesa para comentarios idénticos sin segunda llamada a IA', async () => {
      holdAiInFlight();

      const p1 = service.generatePlan(USER_ID, 'mismo comentario');
      await flushPromises();

      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);

      const p2 = service.generatePlan(USER_ID, 'mismo comentario');
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);
      expect(goalModelMock.create).toHaveBeenCalledTimes(1);

      resolveAi({
        rawContent: JSON.stringify(buildPlanJson()),
        modelUsed: 'llama-3.3-70b',
        promptUsed: 'sys\nusr',
        tokensUsed: 123,
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(r2);
    });

    it('rechaza con ConflictException si llega otro comment mientras hay una generación en vuelo', async () => {
      holdAiInFlight();

      const inFlight = service.generatePlan(USER_ID, 'primer comment');
      await flushPromises();
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);

      await expect(
        service.generatePlan(USER_ID, 'otro comment'),
      ).rejects.toThrow(
        new ConflictException(
          'Ya hay una generación de plan en curso para este usuario',
        ),
      );
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);

      // liberar la promesa original para no dejar colgado el test
      rejectAi(new Error('cleanup'));
      await expect(inFlight).rejects.toThrow('cleanup');
    });

    it('libera el lock tras un fallo y permite una nueva generación', async () => {
      holdAiInFlight();

      const firstAttempt = service.generatePlan(USER_ID, 'comment');
      await flushPromises();
      rejectAi(new Error('groq caído'));

      await expect(firstAttempt).rejects.toThrow('groq caído');

      stubAiResponse();
      await expect(
        service.generatePlan(USER_ID, 'comment'),
      ).resolves.toBeDefined();
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(2);
    });

    it('no interfiere entre usuarios distintos', async () => {
      holdAiInFlight();
      service.generatePlan('user-a', 'comment');
      await flushPromises();

      stubAiResponse();
      await expect(
        service.generatePlan('user-b', 'comment'),
      ).resolves.toBeDefined();

      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolución de ejercicios por nombre contra el catálogo', () => {
    const stubAiResponseWithExtraNames = (...extraNames: string[]) => {
      const planJson = buildPlanJson();
      planJson.days[0].exercises = [
        ...planJson.days[0].exercises,
        ...extraNames.map((name) => ({
          name,
          plannedSets: 3,
          plannedReps: '10',
        })),
      ];
      aiServiceMock.executePrompt.mockResolvedValue({
        rawContent: JSON.stringify(planJson),
        modelUsed: 'llama-3.3-70b',
        promptUsed: 'sys\nusr',
        tokensUsed: 123,
      });
      return planJson;
    };

    it('descarta los nombres que no existen en el catálogo y genera con los válidos', async () => {
      stubAiResponseWithExtraNames('Ejercicio inventado', 'Otro inventado');

      const result = await service.generatePlan(USER_ID);

      // Los inventados se descartan; cada sesión conserva solo "Press Banca"
      expect(result.sessions.length).toBeGreaterThan(0);
      result.sessions.forEach((session) => {
        expect(session.exercises).toHaveLength(1);
        expect(session.exercises[0].exerciseId).toBe('ex-1');
      });

      // La generación se audita como exitosa pese al descarte
      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_GENERATED',
          success: true,
        }),
      );
    });

    it('resuelve el id correcto aunque la IA cambie mayúsculas o acentos', async () => {
      exerciseServiceMock.findAll.mockResolvedValue([
        { id: '64f9aabbccddeeff00112233', name: 'Press Banca', category: 'chest' },
      ]);

      const planJson = buildPlanJson();
      planJson.days.forEach((day) => {
        day.exercises.forEach((ex) => {
          ex.name = 'press banca';
        });
      });
      aiServiceMock.executePrompt.mockResolvedValue({
        rawContent: JSON.stringify(planJson),
        modelUsed: 'llama',
        promptUsed: 'sys\nusr',
        tokensUsed: 5,
      });

      const result = await service.generatePlan(USER_ID);
      result.sessions.forEach((session) => {
        expect(session.exercises[0].exerciseId).toBe(
          '64f9aabbccddeeff00112233',
        );
      });
    });

    it('deduplica nombres equivalentes del catálogo y usa el primero', async () => {
      exerciseServiceMock.findAll.mockResolvedValue([
        { id: 'ex-1', name: 'Press Banca', category: 'chest' },
        { id: 'id-a', name: 'Curl Biceps', category: 'arms' },
        { id: 'id-b', name: 'curl  biceps!', category: 'arms' },
      ]);

      await service.generatePlan(USER_ID);

      // solo una entrada en el prompt (la del primero)
      const userPrompt = aiServiceMock.executePrompt.mock.calls[0][0].userPrompt;
      expect(userPrompt.match(/^- Curl Biceps$/gm)).toHaveLength(1);
      expect(userPrompt).not.toContain('- curl  biceps!');
    });
  });

  describe('audit-log de generación', () => {
    it('audita el éxito de la generación con metadata del plan', async () => {
      await service.generatePlan(USER_ID);

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_GENERATED',
          entity: 'TrainingPlan',
          userId: USER_ID,
          success: true,
          metadata: expect.objectContaining({
            title: 'PPL IA',
            focus: 'muscle_gain',
            durationWeeks: 8,
            daysPerWeek: 5,
            tokensUsed: 123,
          }),
        }),
      );
    });

    it('audita el fallo cuando la validación previa rechaza', async () => {
      planValidatorMock.validate.mockResolvedValue({
        valid: false,
        missing: ['UserProfile.weightKg'],
        recommended: [],
      });

      await expect(service.generatePlan(USER_ID)).rejects.toThrow(
        BadRequestException,
      );

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_GENERATED',
          success: false,
          errorMessage: expect.stringContaining('Faltan datos obligatorios'),
        }),
      );
    });
  });

  describe('resolveFocus', () => {
    it('retorna el focus si es un valor válido del enum', () => {
      expect((service as any).resolveFocus('strength', {})).toBe('strength');
    });

    it('cae al goal.primary del contexto si el focus es inválido', () => {
      const ctx = { goal: { primary: 'fat_loss' } };
      expect((service as any).resolveFocus('hypertrophy', ctx)).toBe(
        'fat_loss',
      );
    });

    it('usa MAINTENANCE como último recurso', () => {
      expect((service as any).resolveFocus('desconocido', {})).toBe(
        'maintenance',
      );
    });
  });
});
