import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { ExerciseResolver } from './exercise.resolver';
import { ExerciseService } from './exercise.service';

describe('ExerciseResolver', () => {
  let resolver: ExerciseResolver;

  const exerciseServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByIds: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getFavoriteExerciseIds: jest.fn(),
    markFavorites: jest.fn(),
  };

  const context = {
    req: { user: { id: new Types.ObjectId().toString() } },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseResolver,
        {
          provide: ExerciseService,
          useValue: exerciseServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<ExerciseResolver>(ExerciseResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  it('createExercise delega en el servicio', () => {
    const input = { name: 'Press Banca', category: 'chest' } as any;
    exerciseServiceMock.create.mockReturnValue({ id: 'ex-1' });

    expect(resolver.createExercise(input)).toEqual({ id: 'ex-1' });
    expect(exerciseServiceMock.create).toHaveBeenCalledWith(input);
  });

  it('exercises enriquece con isFavorite usando el userId del contexto', async () => {
    const list = [{ id: 'ex-1' }, { id: 'ex-2' }];
    const favorites = new Set(['ex-2']);
    const enriched = [
      { id: 'ex-1', isFavorite: false },
      { id: 'ex-2', isFavorite: true },
    ];
    exerciseServiceMock.findAll.mockResolvedValue(list);
    exerciseServiceMock.getFavoriteExerciseIds.mockResolvedValue(favorites);
    exerciseServiceMock.markFavorites.mockReturnValue(enriched);

    const result = await resolver.exercises(context);

    expect(exerciseServiceMock.getFavoriteExerciseIds).toHaveBeenCalledWith(
      context.req.user.id,
    );
    expect(exerciseServiceMock.markFavorites).toHaveBeenCalledWith(
      list,
      favorites,
    );
    expect(result).toEqual(enriched);
  });

  it('findOne enriquece el ejercicio con isFavorite', async () => {
    const favoriteIds = new Set(['ex-1']);
    const enriched = [{ id: 'ex-1', isFavorite: true }];
    exerciseServiceMock.findOne.mockResolvedValue({ id: 'ex-1' });
    exerciseServiceMock.getFavoriteExerciseIds.mockResolvedValue(favoriteIds);
    exerciseServiceMock.markFavorites.mockReturnValue(enriched);

    const result = await resolver.findOne('ex-1', context);

    expect(exerciseServiceMock.findOne).toHaveBeenCalledWith('ex-1');
    expect(exerciseServiceMock.getFavoriteExerciseIds).toHaveBeenCalledWith(
      context.req.user.id,
    );
    expect(result).toEqual(enriched[0]);
  });

  it('findOne retorna null si el ejercicio no existe', async () => {
    exerciseServiceMock.findOne.mockResolvedValue(null);

    const result = await resolver.findOne('missing', context);

    expect(result).toBeNull();
    expect(exerciseServiceMock.getFavoriteExerciseIds).not.toHaveBeenCalled();
  });

  it('updateExercise delega con id e input', () => {
    const input = { id: 'ex-1', category: 'legs' } as any;
    exerciseServiceMock.update.mockReturnValue({ id: 'ex-1' });

    expect(resolver.updateExercise(input)).toEqual({ id: 'ex-1' });
    expect(exerciseServiceMock.update).toHaveBeenCalledWith('ex-1', input);
  });

  it('removeExercise delega en remove', () => {
    exerciseServiceMock.remove.mockReturnValue(true);

    expect(resolver.removeExercise('ex-1')).toBe(true);
    expect(exerciseServiceMock.remove).toHaveBeenCalledWith('ex-1');
  });
});
