import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { TrainingPreferenceService } from './training-preference.service';
import { UserTrainingPreference } from '../schema/training-preference.schema';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';

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

  const exerciseServiceMock = {
    findOne: jest.fn(),
    findByIds: jest.fn(),
  };

  const routinePlanServiceMock = {
    findOne: jest.fn(),
    findByIds: jest.fn(),
  };

  const USER_ID = new Types.ObjectId().toString();
  const EXERCISE_ID = new Types.ObjectId().toString();
  const ROUTINE_ID = new Types.ObjectId().toString();

  // Soporta las cadenas usadas por el service: .exec(), .orFail().exec()
  const resolveWith = (value: any) => ({
    lean: () => ({ exec: () => Promise.resolve(value) }),
    orFail: () => ({ exec: () => Promise.resolve(value) }),
    exec: () => Promise.resolve(value),
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
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

    service = module.get<TrainingPreferenceService>(TrainingPreferenceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findTrainingPreference', () => {
    it('should return the user training preference', async () => {
      const trainingPreference = { userId: USER_ID, daysPerWeek: 5 };
      mockModel.findOne.mockReturnValue(resolveWith(trainingPreference));
      const result = await service.findTrainingPreference(USER_ID);
      expect(result).toEqual(trainingPreference);
    });
  });

  describe('updateTrainingPreference', () => {
    it('should update the user training preference', async () => {
      const input = {
        preferredStyles: ['hypertrophy'],
      } as any;
      const updated = { userId: USER_ID, ...input };
      mockModel.exists.mockReturnValue(resolveWith({ _id: 'pref-1' }));
      mockModel.findOneAndUpdate.mockReturnValue(resolveWith(updated));

      const result = await service.updateTrainingPreference(USER_ID, input);

      expect(result).toEqual(updated);
    });

    it('convierte favoriteExercises a ObjectIds cuando vienen', async () => {
      const input = {
        preferredStyles: ['hypertrophy'],
        favoriteExercises: [EXERCISE_ID],
      } as any;
      exerciseServiceMock.findByIds.mockResolvedValue([{ id: EXERCISE_ID }]);
      mockModel.exists.mockReturnValue(resolveWith(null));
      mockModel.create.mockResolvedValue(input);
      mockModel.findOneAndUpdate.mockReturnValue(
        resolveWith({ userId: USER_ID, ...input }),
      );

      await service.updateTrainingPreference(USER_ID, input);

      const setData = mockModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setData.favoriteExercises[0]).toBeInstanceOf(Types.ObjectId);
    });

    it('rechaza favoriteExercises con formato inválido', async () => {
      const input = {
        preferredStyles: ['hypertrophy'],
        favoriteExercises: ['no-es-un-id'],
      } as any;

      await expect(
        service.updateTrainingPreference(USER_ID, input),
      ).rejects.toThrow(BadRequestException);
      expect(exerciseServiceMock.findByIds).not.toHaveBeenCalled();
    });

    it('rechaza favoriteExercises que no existen en el catálogo', async () => {
      const input = {
        preferredStyles: ['hypertrophy'],
        favoriteExercises: [EXERCISE_ID],
      } as any;
      exerciseServiceMock.findByIds.mockResolvedValue([]);

      await expect(
        service.updateTrainingPreference(USER_ID, input),
      ).rejects.toThrow(BadRequestException);
    });

    it('convierte favoriteRoutines a ObjectIds cuando vienen', async () => {
      const input = {
        preferredStyles: ['hypertrophy'],
        favoriteRoutines: [ROUTINE_ID],
      } as any;
      routinePlanServiceMock.findByIds.mockResolvedValue([
        { id: ROUTINE_ID },
      ]);
      mockModel.exists.mockReturnValue(resolveWith(null));
      mockModel.create.mockResolvedValue(input);
      mockModel.findOneAndUpdate.mockReturnValue(
        resolveWith({ userId: USER_ID, ...input }),
      );

      await service.updateTrainingPreference(USER_ID, input);

      const setData = mockModel.findOneAndUpdate.mock.calls[0][1].$set;
      expect(setData.favoriteRoutines[0]).toBeInstanceOf(Types.ObjectId);
    });

    it('rechaza favoriteRoutines que no existen', async () => {
      const input = {
        preferredStyles: ['hypertrophy'],
        favoriteRoutines: [ROUTINE_ID],
      } as any;
      routinePlanServiceMock.findByIds.mockResolvedValue([]);

      await expect(
        service.updateTrainingPreference(USER_ID, input),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleFavoriteExercise', () => {
    it('agrega el ejercicio con $addToSet si no era favorito', async () => {
      exerciseServiceMock.findOne.mockResolvedValue({ id: EXERCISE_ID });
      mockModel.findOne.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteExercises: [] }),
      );
      const updated = {
        userId: USER_ID,
        favoriteExercises: [EXERCISE_ID],
      };
      mockModel.findOneAndUpdate.mockReturnValue(resolveWith(updated));

      const result = await service.toggleFavoriteExercise(USER_ID, EXERCISE_ID);

      const [, update, options] =
        mockModel.findOneAndUpdate.mock.calls[0] as any[];
      expect(update.$addToSet.favoriteExercises).toBeInstanceOf(
        Types.ObjectId,
      );
      expect(options.upsert).toBe(true);
      expect(options.new).toBe(true);
      expect(String(result.favoriteExercises[0])).toBe(EXERCISE_ID);
    });

    it('quita el ejercicio con $pull si ya era favorito', async () => {
      exerciseServiceMock.findOne.mockResolvedValue({ id: EXERCISE_ID });
      mockModel.findOne.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteExercises: [EXERCISE_ID] }),
      );
      mockModel.findOneAndUpdate.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteExercises: [] }),
      );

      const result = await service.toggleFavoriteExercise(USER_ID, EXERCISE_ID);

      const [, update] = mockModel.findOneAndUpdate.mock.calls[0] as any[];
      expect(update.$pull.favoriteExercises).toBeInstanceOf(Types.ObjectId);
      expect(result.favoriteExercises).toHaveLength(0);
    });

    it('crea la preferencia con upsert aunque no exista documento previo', async () => {
      exerciseServiceMock.findOne.mockResolvedValue({ id: EXERCISE_ID });
      mockModel.findOne.mockReturnValue(resolveWith(null));
      mockModel.findOneAndUpdate.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteExercises: [EXERCISE_ID] }),
      );

      await service.toggleFavoriteExercise(USER_ID, EXERCISE_ID);

      const [, , options] = mockModel.findOneAndUpdate.mock.calls[0] as any[];
      expect(options.upsert).toBe(true);
    });

    it('lanza BadRequest si el id tiene formato inválido', async () => {
      await expect(
        service.toggleFavoriteExercise(USER_ID, 'no-es-un-id'),
      ).rejects.toThrow(BadRequestException);
      expect(exerciseServiceMock.findOne).not.toHaveBeenCalled();
      expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('lanza NotFound si el ejercicio no existe en el catálogo', async () => {
      exerciseServiceMock.findOne.mockResolvedValue(null);

      await expect(
        service.toggleFavoriteExercise(USER_ID, EXERCISE_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('toggleFavoriteRoutine', () => {
    it('agrega la rutina con $addToSet si no era favorita', async () => {
      routinePlanServiceMock.findOne.mockResolvedValue({ id: ROUTINE_ID });
      mockModel.findOne.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteRoutines: [] }),
      );
      const updated = { userId: USER_ID, favoriteRoutines: [ROUTINE_ID] };
      mockModel.findOneAndUpdate.mockReturnValue(resolveWith(updated));

      const result = await service.toggleFavoriteRoutine(USER_ID, ROUTINE_ID);

      const [, update, options] =
        mockModel.findOneAndUpdate.mock.calls[0] as any[];
      expect(update.$addToSet.favoriteRoutines).toBeInstanceOf(Types.ObjectId);
      expect(options.upsert).toBe(true);
      expect(String(result.favoriteRoutines[0])).toBe(ROUTINE_ID);
    });

    it('quita la rutina con $pull si ya era favorita', async () => {
      routinePlanServiceMock.findOne.mockResolvedValue({ id: ROUTINE_ID });
      mockModel.findOne.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteRoutines: [ROUTINE_ID] }),
      );
      mockModel.findOneAndUpdate.mockReturnValue(
        resolveWith({ userId: USER_ID, favoriteRoutines: [] }),
      );

      const result = await service.toggleFavoriteRoutine(USER_ID, ROUTINE_ID);

      const [, update] = mockModel.findOneAndUpdate.mock.calls[0] as any[];
      expect(update.$pull.favoriteRoutines).toBeInstanceOf(Types.ObjectId);
      expect(result.favoriteRoutines).toHaveLength(0);
    });

    it('lanza BadRequest si el id tiene formato inválido', async () => {
      await expect(
        service.toggleFavoriteRoutine(USER_ID, 'no-es-un-id'),
      ).rejects.toThrow(BadRequestException);
      expect(routinePlanServiceMock.findOne).not.toHaveBeenCalled();
      expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('propaga NotFound si la rutina no existe', async () => {
      routinePlanServiceMock.findOne.mockRejectedValue(
        new NotFoundException(`Plan con ID "${ROUTINE_ID}" no encontrado`),
      );

      await expect(
        service.toggleFavoriteRoutine(USER_ID, ROUTINE_ID),
      ).rejects.toThrow(NotFoundException);
      expect(mockModel.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });
});
