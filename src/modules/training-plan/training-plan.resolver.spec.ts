import { Test, TestingModule } from '@nestjs/testing';
import { TrainingPlanResolver } from './training-plan.resolver';
import { TrainingPlanService } from './training-plan.service';

describe('TrainingPlanResolver', () => {
  let resolver: TrainingPlanResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TrainingPlanResolver, TrainingPlanService],
    }).compile();

    resolver = module.get<TrainingPlanResolver>(TrainingPlanResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
