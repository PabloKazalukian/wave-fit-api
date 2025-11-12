import { Test, TestingModule } from '@nestjs/testing';
import { WeekLogResolver } from './week-log.resolver';
import { WeekLogService } from './week-log.service';

describe('WeekLogResolver', () => {
  let resolver: WeekLogResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WeekLogResolver, WeekLogService],
    }).compile();

    resolver = module.get<WeekLogResolver>(WeekLogResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
