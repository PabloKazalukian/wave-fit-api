import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TrainingPreferenceResolver } from './training-preference.resolver';
import { TrainingPreferenceService } from './training-preference.service';
import { UserTrainingPreference } from '../schema/training-preference.schema';

describe('TrainingPreferenceResolver', () => {
  let resolver: TrainingPreferenceResolver;

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
        TrainingPreferenceResolver,
        TrainingPreferenceService,
        {
          provide: getModelToken(UserTrainingPreference.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    resolver = module.get<TrainingPreferenceResolver>(
      TrainingPreferenceResolver,
    );
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
