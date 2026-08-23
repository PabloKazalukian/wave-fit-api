import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
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
                exerciseId: 'ex-1',
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
        { provide: UserProfileService, useValue: userProfileServiceMock },
        { provide: getModelToken(Goal.name), useValue: goalModelMock },
        { provide: AiService, useValue: aiServiceMock },
        { provide: PlanValidatorService, useValue: planValidatorMock },
        { provide: ExerciseService, useValue: exerciseServiceMock },
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

      // llamada a la IA con el proveedor configurado
      expect(aiServiceMock.executePrompt).toHaveBeenCalledWith(
        expect.objectContaining({
          providerName: 'test-provider',
          systemPrompt: expect.stringContaining('formato JSON válido'),
          userPrompt: expect.stringContaining('- ex-1 | Press Banca | chest'),
        }),
      );

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
