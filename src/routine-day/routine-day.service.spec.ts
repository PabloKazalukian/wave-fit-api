import { Test, TestingModule } from '@nestjs/testing';
import { RoutineDayService } from './routine-day.service';

describe('RoutineDayService', () => {
  let service: RoutineDayService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RoutineDayService],
    }).compile();

    service = module.get<RoutineDayService>(RoutineDayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
