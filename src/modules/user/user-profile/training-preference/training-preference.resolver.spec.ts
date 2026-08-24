import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { TrainingPreferenceResolver } from './training-preference.resolver';
import { TrainingPreferenceService } from './training-preference.service';
import { UserTrainingPreference } from '../schema/training-preference.schema';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';

describe('TrainingPreferenceResolver', () => {
  let resolver: TrainingPreferenceResolver;
  let service: TrainingPreferenceService;

  const mockModel = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
    exec: jest.fn(),
  };

  const exerciseServiceMock = {
    findOne: jest.fn(),
    findByIds: jest.fn(),
  };

  const routinePlanServiceMock = {
    findOne: jest.fn(),
    findByIds: jest.fn(),
  };

  const USER_ID = new Types.ObjectId().toString();
  const context = { req: { user: { id: USER_ID } } };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPreferenceResolver,
        TrainingPreferenceService,
        {
          provide: getModelToken(UserTrainingPreference.name),
          useValue: mockModel,
        },
        {
          provide: ExerciseService,
          useValue: exerciseServiceMock,
        },
        {
          provide: RoutinePlanService,
          useValue: routinePlanServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<TrainingPreferenceResolver>(
      TrainingPreferenceResolver,
    );
    service = module.get<TrainingPreferenceService>(TrainingPreferenceService);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('updateUserTrainingPreference delega con el userId del contexto', () => {
    const input = { preferredStyles: ['hypertrophy'] } as any;
    jest
      .spyOn(service, 'updateTrainingPreference')
      .mockResolvedValue({ userId: USER_ID } as any);

    resolver.updateUserTrainingPreference(input, context);

    expect(service.updateTrainingPreference).toHaveBeenCalledWith(
      USER_ID,
      input,
    );
  });

  it('toggleFavoriteExercise delega con userId y exerciseId', () => {
    jest
      .spyOn(service, 'toggleFavoriteExercise')
      .mockResolvedValue({ userId: USER_ID } as any);

    resolver.toggleFavoriteExercise('exercise-1', context);

    expect(service.toggleFavoriteExercise).toHaveBeenCalledWith(
      USER_ID,
      'exercise-1',
    );
  });

  it('toggleFavoriteRoutine delega con userId y routineId', () => {
    jest
      .spyOn(service, 'toggleFavoriteRoutine')
      .mockResolvedValue({ userId: USER_ID } as any);

    resolver.toggleFavoriteRoutine('routine-1', context);

    expect(service.toggleFavoriteRoutine).toHaveBeenCalledWith(
      USER_ID,
      'routine-1',
    );
  });
});
