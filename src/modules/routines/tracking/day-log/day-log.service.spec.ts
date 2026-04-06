import { Test, TestingModule } from '@nestjs/testing';
import { DayLogService } from './day-log.service';

describe('DayLogService', () => {
  let service: DayLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DayLogService],
    }).compile();

    service = module.get<DayLogService>(DayLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
