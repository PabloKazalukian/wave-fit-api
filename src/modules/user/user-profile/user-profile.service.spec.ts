import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './schema/user-profile.schema';
import { UserGoal } from './schema/goals.schema';
import { UserTrainingPreference } from './schema/training-preference.schema';
import { UserWeightLog } from './schema/weight.schema';
import { UserHealthConstraint } from './schema/health-constraints.schema';
import { UserSchedule } from './schema/schedule.schema';
import { UserResource } from './schema/resourse.schema';
import { UserStrengthMetric } from './schema/strength-metrics.schema';
import { GoalsService } from './goals/goals.service';
import { TrainingPreferenceService } from './training-preference/training-preference.service';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';
import { RoutineDayService } from 'src/modules/routines/templates/routine-day/routine-day.service';
import { WeightService } from './weight/weight.service';
import { HealthConstraintsService } from './health-constraints/health-constraints.service';
import { ScheduleService } from './schedule/schedule.service';
import { ResourceService } from './resource/resource.service';
import { StrengthMetricsService } from './strength-metrics/strength-metrics.service';

const createMockModel = () => ({
  create: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findOneAndDelete: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  deleteMany: jest.fn().mockReturnThis(),
  exists: jest.fn(),
  exec: jest.fn().mockResolvedValue({ deletedCount: 0 }),
});

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        GoalsService,
        TrainingPreferenceService,
        WeightService,
        HealthConstraintsService,
        ScheduleService,
        ResourceService,
        StrengthMetricsService,
        ...[
          UserProfile,
          UserHealthConstraint,
          UserResource,
          UserSchedule,
          UserStrengthMetric,
          UserGoal,
          UserTrainingPreference,
          UserWeightLog,
        ].map((model) => ({
          provide: getModelToken(model.name),
          useValue: createMockModel(),
        })),
        {
          provide: ExerciseService,
          useValue: { findOne: jest.fn(), findByIds: jest.fn() },
        },
        {
          provide: RoutinePlanService,
          useValue: { findOne: jest.fn(), findByIds: jest.fn() },
        },
        {
          provide: RoutineDayService,
          useValue: { findOne: jest.fn(), findByIds: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('removeAllProfileData', () => {
    it('borra los datos de todos los dominios del perfil y el perfil base', async () => {
      const goals = jest.spyOn(
        (service as any).goalsService,
        'removeGoal',
      );
      const preferences = jest.spyOn(
        (service as any).trainingPreferenceService,
        'removeTrainingPreference',
      );
      const weights = jest.spyOn(
        (service as any).weightService,
        'removeWeightLogs',
      );
      const health = jest.spyOn(
        (service as any).healthConstraintsService,
        'removeHealthConstraints',
      );
      const schedule = jest.spyOn(
        (service as any).scheduleService,
        'removeSchedule',
      );
      const resources = jest.spyOn(
        (service as any).resourceService,
        'removeResource',
      );
      const metrics = jest.spyOn(
        (service as any).strengthMetricsService,
        'removeStrengthMetrics',
      );

      await expect(service.removeAllProfileData('507f1f77bcf86cd799439011')).resolves.toBe(true);

      expect(goals).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(preferences).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(weights).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(health).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(schedule).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(resources).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
      expect(metrics).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    it('es idempotente: devuelve true aunque no hubiera datos que borrar', async () => {
      // mocks por defecto: deleteMany → deletedCount 0 → remove* devuelven false
      await expect(service.removeAllProfileData('507f1f77bcf86cd799439011')).resolves.toBe(true);
    });
  });
});
