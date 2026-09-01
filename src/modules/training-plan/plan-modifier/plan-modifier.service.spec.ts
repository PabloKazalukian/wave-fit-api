import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PlanModifierService } from './plan-modifier.service';
import { UserProfileService } from '../../user/user-profile';
import { Goal } from '../entities/goal.entity';
import { AiService } from '../../ai/ai.service';
import { PlanValidatorService } from '../plan-validator/plan-validator.service';
import { PlanGeneratorParser } from '../plan-generator/plan-generator.parser';
import { ExerciseService } from '../../routines/templates/exercise/exercise.service';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { PlanMaterializerService } from '../plan-materializer/plan-materializer.service';

describe('PlanModifierService', () => {
  let service: PlanModifierService;

  const USER_ID = '507f1f77bcf86cd799439011';
  const PROFILE_ID = '64f000000000000000000001';
  const GOAL_DB_ID = new Types.ObjectId('64f000000000000000000002');
  const PLAN_ID = '64f000000000000000000010';

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
          : [{ name: 'Press Banca', plannedSets: 4, plannedReps: '8-10' }],
    })),
  });

  const makePlan = (overrides: Partial<any> = {}) => ({
    _id: PLAN_ID,
    userId: USER_ID,
    confirmed: false,
    version: 1,
    aiSnapshot: {
      contextSentToAI: validProfileContext(),
      promptUsed: 'original',
      modelUsed: 'llama',
      rawResponse: buildPlanJson(),
      tokensUsed: 100,
    },
    ...overrides,
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
        PlanModifierService,
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

    service = module.get<PlanModifierService>(PlanModifierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('modifyPlan (flujo feliz)', () => {
    it('re-parsea el snapshot vigente y envía el plan actual a la IA', async () => {
      const result = await service.modifyPlan(
        USER_ID,
        makePlan(),
        'cambia a 5x5',
      );

      // la IA recibe el prompt de modificación con el plan actual
      const promptArgs = aiServiceMock.executePrompt.mock.calls[0][0];
      expect(promptArgs.providerName).toBe('test-provider');
      expect(promptArgs.userPrompt).toContain('cambia a 5x5');
      expect(promptArgs.userPrompt).toContain('--- PLAN ACTUAL ---');

      // resultado consolidado con el nuevo snapshot
      expect(result.goalId).toBe(GOAL_DB_ID.toString());
      expect(result.userProfileId).toBe(PROFILE_ID);
      expect(result.aiSnapshot.modelUsed).toBe('llama-3.3-70b');
      expect(result.aiSnapshot.tokensUsed).toBe(123);
      expect(result.metadata.title).toBe('PPL IA');
    });

    it('audita TRAINING_PLAN_MODIFIED con success', async () => {
      await service.modifyPlan(USER_ID, makePlan(), 'cambia');

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_MODIFIED',
          entity: 'TrainingPlan',
          userId: USER_ID,
          success: true,
          metadata: expect.objectContaining({
            planId: PLAN_ID,
            title: 'PPL IA',
            focus: 'muscle_gain',
            durationWeeks: 8,
            daysPerWeek: 5,
            tokensUsed: 123,
          }),
        }),
      );
    });
  });

  describe('validación previa', () => {
    it('lanza BadRequestException si el perfil es inválido y audita el fallo', async () => {
      planValidatorMock.validate.mockResolvedValue({
        valid: false,
        missing: ['UserProfile.weightKg'],
        recommended: [],
      });

      await expect(
        service.modifyPlan(USER_ID, makePlan(), 'cambia'),
      ).rejects.toThrow(BadRequestException);

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_MODIFIED',
          success: false,
        }),
      );
    });

    it('lanza NotFoundException si el perfil no existe', async () => {
      userProfileServiceMock.getFullProfileContext.mockResolvedValue({
        profile: null,
      });

      await expect(
        service.modifyPlan(USER_ID, makePlan(), 'cambia'),
      ).rejects.toThrow(new NotFoundException('User profile not found'));
    });

    it('lanza ConflictException si el plan no tiene snapshot de IA', async () => {
      const planWithoutSnapshot = makePlan({ aiSnapshot: { rawResponse: null } });

      await expect(
        service.modifyPlan(USER_ID, planWithoutSnapshot, 'cambia'),
      ).rejects.toThrow('El plan no tiene snapshot de IA para modificar');
    });
  });

  describe('lock de modificación concurrente (in-flight)', () => {
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

    const flushPromises = () => new Promise((r) => setTimeout(r, 0));

    it('comparte la misma promesa para comentarios idénticos', async () => {
      holdAiInFlight();
      const plan = makePlan();

      const p1 = service.modifyPlan(USER_ID, plan, 'mismo');
      await flushPromises();
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);

      const p2 = service.modifyPlan(USER_ID, plan, 'mismo');
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);

      resolveAi({
        rawContent: JSON.stringify(buildPlanJson()),
        modelUsed: 'llama',
        promptUsed: 'sys\nusr',
        tokensUsed: 1,
      });
      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1).toBe(r2);
    });

    it('rechaza con ConflictException si llega otro comment en vuelo', async () => {
      holdAiInFlight();
      const plan = makePlan();

      const inFlight = service.modifyPlan(USER_ID, plan, 'primero');
      await flushPromises();
      expect(aiServiceMock.executePrompt).toHaveBeenCalledTimes(1);

      await expect(
        service.modifyPlan(USER_ID, plan, 'otro'),
      ).rejects.toThrow(
        new ConflictException(
          'Ya hay una modificación de plan en curso para este usuario',
        ),
      );

      rejectAi(new Error('cleanup'));
      await expect(inFlight).rejects.toThrow('cleanup');
    });
  });
});
