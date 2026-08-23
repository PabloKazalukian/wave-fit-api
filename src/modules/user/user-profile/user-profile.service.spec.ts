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
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
