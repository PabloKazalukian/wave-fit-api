import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { UserProfileResolver } from './user-profile.resolver';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './schema/user-profile.schema';
import { UserHealthConstraint } from './schema/health-constraints.schema';
import { UserSchedule } from './schema/schedule.schema';
import { UserResource } from './schema/resourse.schema';
import { UserStrengthMetric } from './schema/strength-metrics.schema';
import { UserGoal } from './schema/goals.schema';
import { UserTrainingPreference } from './schema/training-preference.schema';
import { UserWeightLog } from './schema/weight.schema';
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
  exists: jest.fn(),
  exec: jest.fn(),
});

describe('UserProfileResolver', () => {
  let resolver: UserProfileResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileResolver,
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

    resolver = module.get<UserProfileResolver>(UserProfileResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
