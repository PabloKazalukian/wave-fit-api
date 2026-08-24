import { Test, TestingModule } from '@nestjs/testing';
import { RoutinePlanService } from './routine-plan.service';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RoutinePlan } from './schema/routine-plan.schema';
import { UserTrainingPreference } from 'src/modules/user/user-profile/schema/training-preference.schema';

describe('RoutinePlanService', () => {
  let service: RoutinePlanService;

  const routinePlanModelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  };

  const trainingPreferenceModelMock = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinePlanService,
        {
          provide: getModelToken(RoutinePlan.name),
          useValue: routinePlanModelMock,
        },
        {
          provide: getModelToken(UserTrainingPreference.name),
          useValue: trainingPreferenceModelMock,
        },
      ],
    }).compile();

    service = module.get<RoutinePlanService>(RoutinePlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findByIds', () => {
    it('consulta con $in y serializa', async () => {
      routinePlanModelMock.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue([{ _id: 'plan-1', name: 'PPL' }]),
        }),
      });

      const result = await service.findByIds(['plan-1']);

      expect(routinePlanModelMock.find).toHaveBeenCalledWith({
        _id: { $in: ['plan-1'] },
      });
      expect(result[0].id).toBe('plan-1');
    });
  });

  describe('favoritos', () => {
    const userId = new Types.ObjectId().toString();

    it('getFavoriteRoutineIds retorna un Set con los ids del usuario', async () => {
      trainingPreferenceModelMock.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            favoriteRoutines: ['fav-1', 'fav-2'],
          }),
        }),
      });

      const result = await service.getFavoriteRoutineIds(userId);

      expect(result).toBeInstanceOf(Set);
      expect(result.has('fav-1')).toBe(true);
      expect(result.size).toBe(2);
    });

    it('getFavoriteRoutineIds retorna Set vacío si no hay preferencia', async () => {
      trainingPreferenceModelMock.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });

      const result = await service.getFavoriteRoutineIds(userId);

      expect(result.size).toBe(0);
    });

    it('markFavorites marca los planes incluidos en el Set', () => {
      const plans = [
        { id: 'plan-1', name: 'A' },
        { id: 'plan-2', name: 'B' },
      ];
      const favorites = new Set(['plan-2']);

      const result = service.markFavorites(plans, favorites);

      expect(result[0].isFavorite).toBe(false);
      expect(result[1].isFavorite).toBe(true);
    });
  });
});
