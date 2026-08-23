import { Test, TestingModule } from '@nestjs/testing';
import { TrainingPlanResolver } from './training-plan.resolver';
import { TrainingPlanService } from './training-plan.service';

describe('TrainingPlanResolver', () => {
  let resolver: TrainingPlanResolver;

  const trainingPlanServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPlanResolver,
        {
          provide: TrainingPlanService,
          useValue: trainingPlanServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<TrainingPlanResolver>(TrainingPlanResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
