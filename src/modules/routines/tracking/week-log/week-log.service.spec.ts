import { Test, TestingModule } from '@nestjs/testing';
import { WeekLogService } from './week-log.service';

describe('WeekLogService', () => {
  let service: WeekLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WeekLogService],
    }).compile();

    service = module.get<WeekLogService>(WeekLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
