import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WeightResolver } from './weight.resolver';
import { WeightService } from './weight.service';
import { UserWeightLog } from '../schema/weight.schema';

describe('WeightResolver', () => {
  let resolver: WeightResolver;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    sort: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WeightResolver,
        WeightService,
        {
          provide: getModelToken(UserWeightLog.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<WeightResolver>(WeightResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
