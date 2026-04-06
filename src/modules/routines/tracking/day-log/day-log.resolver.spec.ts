import { Test, TestingModule } from '@nestjs/testing';
import { DayLogResolver } from './day-log.resolver';
import { DayLogService } from './day-log.service';

describe('DayLogResolver', () => {
  let resolver: DayLogResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DayLogResolver, DayLogService],
    }).compile();

    resolver = module.get<DayLogResolver>(DayLogResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
