import { Test, TestingModule } from '@nestjs/testing';
import { RoutineDayResolver } from './routine-day.resolver';
import { RoutineDayService } from './routine-day.service';

describe('RoutineDayResolver', () => {
  let resolver: RoutineDayResolver;

  const USER_ID = '64f0000000000000000000a1';
  const context = { req: { user: { id: USER_ID } } };

  const routineDayServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCategory: jest.fn(),
    findByIds: jest.fn(),
    getFavoriteRoutineDayIds: jest.fn(),
    markFavorites: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createFromWorkout: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutineDayResolver,
        {
          provide: RoutineDayService,
          useValue: routineDayServiceMock,
        },
      ],
    }).compile();

    resolver = module.get<RoutineDayResolver>(RoutineDayResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('resolveField', () => {
    it('id retorna el id del parent', () => {
      expect(resolver.id({ id: 'rd-1' } as any)).toBe('rd-1');
    });

    it('exercises retorna el array del parent', () => {
      const exercises = [{ exercise: 'ex-1', order: 1 }];
      expect(resolver.exercises({ exercises } as any)).toEqual(exercises);
    });

    it('exercises retorna vacío si el parent no trae array', () => {
      expect(resolver.exercises({} as any)).toEqual([]);
    });
  });

  it('createRoutineDay delega en el servicio', () => {
    const input = { title: 'Push' } as any;
    routineDayServiceMock.create.mockReturnValue({ id: 'rd-1' });

    expect(resolver.createRoutineDay(input)).toEqual({ id: 'rd-1' });
    expect(routineDayServiceMock.create).toHaveBeenCalledWith(input);
  });

  describe('consultas con enriquecimiento de favoritos', () => {
    it('findAll obtiene días y favoritos en paralelo y marca', async () => {
      const days = [{ id: 'rd-1' }, { id: 'rd-2' }];
      const marked = [{ id: 'rd-1', isFavorite: true }];
      routineDayServiceMock.findAll.mockResolvedValue(days);
      routineDayServiceMock.getFavoriteRoutineDayIds.mockResolvedValue(
        new Set(['rd-1']),
      );
      routineDayServiceMock.markFavorites.mockReturnValue(marked);

      const result = await resolver.findAll(context);

      expect(result).toBe(marked);
      expect(routineDayServiceMock.getFavoriteRoutineDayIds).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(routineDayServiceMock.markFavorites).toHaveBeenCalledWith(
        days,
        new Set(['rd-1']),
      );
    });

    it('findOne retorna null si el día no existe sin consultar favoritos', async () => {
      routineDayServiceMock.findOne.mockResolvedValue(null);

      const result = await resolver.findOne('missing', context);

      expect(result).toBeNull();
      expect(
        routineDayServiceMock.getFavoriteRoutineDayIds,
      ).not.toHaveBeenCalled();
    });

    it('findOne marca el día con los favoritos del usuario', async () => {
      const day = { id: 'rd-1' };
      const marked = { id: 'rd-1', isFavorite: true };
      routineDayServiceMock.findOne.mockResolvedValue(day);
      routineDayServiceMock.getFavoriteRoutineDayIds.mockResolvedValue(
        new Set(['rd-1']),
      );
      routineDayServiceMock.markFavorites.mockReturnValue([marked]);

      const result = await resolver.findOne('rd-1', context);

      expect(result).toEqual(marked);
      expect(routineDayServiceMock.findOne).toHaveBeenCalledWith('rd-1');
      expect(routineDayServiceMock.markFavorites).toHaveBeenCalledWith(
        [day],
        new Set(['rd-1']),
      );
    });

    it('routineByCategory extrae category y marca favoritos', async () => {
      const days = [{ id: 'rd-9' }];
      const marked = [{ id: 'rd-9', isFavorite: false }];
      routineDayServiceMock.findByCategory.mockResolvedValue(days);
      routineDayServiceMock.getFavoriteRoutineDayIds.mockResolvedValue(
        new Set<string>(),
      );
      routineDayServiceMock.markFavorites.mockReturnValue(marked);

      const result = await resolver.routineByCategory(
        { category: 'push' } as any,
        context,
      );

      expect(result).toBe(marked);
      expect(routineDayServiceMock.findByCategory).toHaveBeenCalledWith('push');
      expect(routineDayServiceMock.markFavorites).toHaveBeenCalledWith(
        days,
        new Set(),
      );
    });
  });

  it('updateRoutineDay delega con id e input', () => {
    const input = { id: 'rd-1', title: 'Piernas' } as any;
    routineDayServiceMock.update.mockReturnValue({ id: 'rd-1' });

    expect(resolver.updateRoutineDay(input)).toEqual({ id: 'rd-1' });
    expect(routineDayServiceMock.update).toHaveBeenCalledWith(
      'rd-1',
      input,
    );
  });

  it('removeRoutineDay delega en remove', () => {
    routineDayServiceMock.remove.mockReturnValue(true);

    expect(resolver.removeRoutineDay('rd-1')).toBe(true);
    expect(routineDayServiceMock.remove).toHaveBeenCalledWith('rd-1');
  });

  it('createRoutineByWorkout delega título y ejercicios', () => {
    routineDayServiceMock.createFromWorkout.mockReturnValue({ id: 'rd-new' });

    const result = resolver.createRoutineByWorkout('Full body', [
      'ex-1',
      'ex-2',
    ]);

    expect(result).toEqual({ id: 'rd-new' });
    expect(routineDayServiceMock.createFromWorkout).toHaveBeenCalledWith(
      'Full body',
      ['ex-1', 'ex-2'],
    );
  });
});
