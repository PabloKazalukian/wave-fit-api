import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { TrainingPreferenceService } from './training-preference.service';
import { UserTrainingPreference } from '../schema/training-preference.schema';

describe('TrainingPreferenceService', () => {
  let service: TrainingPreferenceService;

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
        TrainingPreferenceService,
        {
          provide: getModelToken(UserTrainingPreference.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<TrainingPreferenceService>(TrainingPreferenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
