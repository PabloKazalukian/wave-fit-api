import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotImplementedException } from '@nestjs/common';
import { TrainingPlanResolver } from './training-plan.resolver';
import { TrainingPlanService } from './training-plan.service';
import { ConfirmPlanService } from './plan-confirmation/confirm-plan.service';
import { PlanConfirmationAction } from './schema/training-plan.schema';

describe('TrainingPlanResolver', () => {
  let resolver: TrainingPlanResolver;

  const USER_ID = '507f1f77bcf86cd799439011';
  const PLAN_ID = '64f000000000000000000010';

  const trainingPlanServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const confirmPlanServiceMock = {
    confirm: jest.fn(),
  };

  const buildContext = () => ({
    req: { user: { id: USER_ID } },
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPlanResolver,
        {
          provide: TrainingPlanService,
          useValue: trainingPlanServiceMock,
        },
        {
          provide: ConfirmPlanService,
          useValue: confirmPlanServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<TrainingPlanResolver>(TrainingPlanResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('confirmPlan', () => {
    it('delega en ConfirmPlanService con el userId de la cookie', async () => {
      const output = { trainingPlan: { id: PLAN_ID }, weekLog: null, routinePlan: null };
      confirmPlanServiceMock.confirm.mockResolvedValue(output);
      const context = buildContext();

      const result = await resolver.confirmPlan(
        PLAN_ID,
        PlanConfirmationAction.CREATE_WEEK_LOG,
        context,
      );

      expect(confirmPlanServiceMock.confirm).toHaveBeenCalledWith(
        USER_ID,
        PLAN_ID,
        PlanConfirmationAction.CREATE_WEEK_LOG,
      );
      expect(result).toBe(output);
    });

    it('propaga el ConflictException cuando la semana activa ya existe', async () => {
      confirmPlanServiceMock.confirm.mockRejectedValue(
        new ConflictException('Already active week'),
      );

      await expect(
        resolver.confirmPlan(
          PLAN_ID,
          PlanConfirmationAction.CREATE_WEEK_LOG,
          buildContext(),
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('propaga el NotImplementedException del stub ADAPT_ACTIVE_WEEK', async () => {
      confirmPlanServiceMock.confirm.mockRejectedValue(
        new NotImplementedException(),
      );

      await expect(
        resolver.confirmPlan(
          PLAN_ID,
          PlanConfirmationAction.ADAPT_ACTIVE_WEEK,
          buildContext(),
        ),
      ).rejects.toThrow(NotImplementedException);
    });
  });
});
