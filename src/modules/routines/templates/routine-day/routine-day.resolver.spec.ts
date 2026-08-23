import { Test, TestingModule } from '@nestjs/testing';
import { RoutineDayResolver } from './routine-day.resolver';
import { RoutineDayService } from './routine-day.service';

describe('RoutineDayResolver', () => {
  let resolver: RoutineDayResolver;

  const routineDayServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByCategory: jest.fn(),
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

  it('findAll delega en findAll', () => {
    const list = [{ id: 'rd-1' }];
    routineDayServiceMock.findAll.mockReturnValue(list);

    expect(resolver.findAll()).toBe(list);
  });

  it('findOne delega con el id recibido', () => {
    routineDayServiceMock.findOne.mockReturnValue({ id: 'rd-1' });

    expect(resolver.findOne('rd-1')).toEqual({ id: 'rd-1' });
    expect(routineDayServiceMock.findOne).toHaveBeenCalledWith('rd-1');
  });

  it('routineByCategory extrae category del input', () => {
    routineDayServiceMock.findByCategory.mockReturnValue([]);

    resolver.routineByCategory({ category: 'push' } as any);

    expect(routineDayServiceMock.findByCategory).toHaveBeenCalledWith('push');
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
