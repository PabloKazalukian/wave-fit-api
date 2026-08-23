import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StrengthMetricsService } from './strength-metrics.service';
import { UserStrengthMetric } from '../schema/strength-metrics.schema';

describe('StrengthMetricsService', () => {
  let service: StrengthMetricsService;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndDelete: jest.fn(),
    sort: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StrengthMetricsService,
        {
          provide: getModelToken(UserStrengthMetric.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<StrengthMetricsService>(StrengthMetricsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
