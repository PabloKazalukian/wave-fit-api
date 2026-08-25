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

  describe('scoping por usuario (privacidad de planes)', () => {
    const userId = new Types.ObjectId().toString();

    const stubFind = (resolveValue: any) => {
      routinePlanModelMock.find.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(resolveValue),
        }),
      });
    };

    it('findAll sin userId consulta todos (comportamiento interno)', async () => {
      stubFind([]);

      await service.findAll();

      expect(routinePlanModelMock.find).toHaveBeenCalledWith({});
    });

    it('findAll con userId filtra globales + propios', async () => {
      stubFind([]);

      await service.findAll(userId);

      const filter = routinePlanModelMock.find.mock.calls[0][0];
      expect(filter.$or).toEqual([
        { createdBy: null },
        { createdBy: new Types.ObjectId(userId) },
      ]);
    });

    it('findOne con userId aplica el mismo filtro para planes ajenos', async () => {
      stubFindOne(null);
      const foreignId = new Types.ObjectId().toString();

      await expect(service.findOne(foreignId, userId)).rejects.toThrow(
        'no encontrado',
      );

      const [filter] = routinePlanModelMock.findOne.mock.calls[0];
      expect(filter._id).toBe(foreignId);
      expect(filter.$or).toEqual([
        { createdBy: null },
        { createdBy: new Types.ObjectId(userId) },
      ]);
    });

    it('findOne sin userId no restringe (uso interno)', async () => {
      stubFindOne({ _id: new Types.ObjectId().toString(), name: 'PPL' });
      const planId = new Types.ObjectId().toString();

      const result = await service.findOne(planId);

      const [filter] = routinePlanModelMock.findOne.mock.calls[0];
      expect(filter).not.toHaveProperty('$or');
      expect(filter._id).toBe(planId);
      expect(result.id).toBeDefined();
    });

    // helper local
    function stubFindOne(resolveValue: any) {
      routinePlanModelMock.findOne.mockReturnValue({
        lean: () => ({
          exec: jest.fn().mockResolvedValue(resolveValue),
        }),
      });
    }
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
