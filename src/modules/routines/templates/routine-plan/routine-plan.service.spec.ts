import { Test, TestingModule } from '@nestjs/testing';
import { RoutinePlanService } from './routine-plan.service';

describe('RoutinePlanService', () => {
  let service: RoutinePlanService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutinePlanService],
    }).compile();

    service = module.get<RoutinePlanService>(RoutinePlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
