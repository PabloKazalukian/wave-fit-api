import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { StrengthMetricsResolver } from './strength-metrics.resolver';
import { StrengthMetricsService } from './strength-metrics.service';
import { UserStrengthMetric } from '../schema/strength-metrics.schema';

describe('StrengthMetricsResolver', () => {
  let resolver: StrengthMetricsResolver;

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
        StrengthMetricsResolver,
        StrengthMetricsService,
        {
          provide: getModelToken(UserStrengthMetric.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<StrengthMetricsResolver>(StrengthMetricsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
