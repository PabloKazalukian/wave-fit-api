import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GoalsResolver } from './goals.resolver';
import { GoalsService } from './goals.service';
import { UserGoal } from '../schema/goals.schema';

describe('GoalsResolver', () => {
  let resolver: GoalsResolver;

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
        GoalsResolver,
        GoalsService,
        {
          provide: getModelToken(UserGoal.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<GoalsResolver>(GoalsResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
