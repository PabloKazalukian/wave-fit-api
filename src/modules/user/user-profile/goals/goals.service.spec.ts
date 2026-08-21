import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GoalsService } from './goals.service';
import { UserGoal } from '../schema/goals.schema';

describe('GoalsService', () => {
  let service: GoalsService;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
    exec: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoalsService,
        {
          provide: getModelToken(UserGoal.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<GoalsService>(GoalsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
