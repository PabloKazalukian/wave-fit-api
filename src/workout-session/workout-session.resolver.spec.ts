import { Test, TestingModule } from '@nestjs/testing';
import { WorkoutSessionResolver } from './workout-session.resolver';
import { WorkoutSessionService } from './workout-session.service';

describe('WorkoutSessionResolver', () => {
  let resolver: WorkoutSessionResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkoutSessionResolver, WorkoutSessionService],
    }).compile();

    resolver = module.get<WorkoutSessionResolver>(WorkoutSessionResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
