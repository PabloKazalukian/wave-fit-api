import { Test, TestingModule } from '@nestjs/testing';
import { RoutineDayResolver } from './routine-day.resolver';
import { RoutineDayService } from './routine-day.service';

describe('RoutineDayResolver', () => {
  let resolver: RoutineDayResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutineDayResolver, RoutineDayService],
    }).compile();

    resolver = module.get<RoutineDayResolver>(RoutineDayResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
