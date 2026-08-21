import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { WeightService } from './weight.service';
import { UserWeightLog } from '../schema/weight.schema';

describe('WeightService', () => {
  let service: WeightService;

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
        WeightService,
        {
          provide: getModelToken(UserWeightLog.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<WeightService>(WeightService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
