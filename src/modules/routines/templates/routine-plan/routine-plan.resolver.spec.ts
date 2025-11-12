import { Test, TestingModule } from '@nestjs/testing';
import { RoutinePlanResolver } from './routine-plan.resolver';
import { RoutinePlanService } from './routine-plan.service';

describe('RoutinePlanResolver', () => {
  let resolver: RoutinePlanResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutinePlanResolver, RoutinePlanService],
    }).compile();

    resolver = module.get<RoutinePlanResolver>(RoutinePlanResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
