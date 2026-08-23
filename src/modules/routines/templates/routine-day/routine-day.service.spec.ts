import { Test, TestingModule } from '@nestjs/testing';
import { RoutineDayService } from './routine-day.service';
import { getModelToken } from '@nestjs/mongoose';
import { RoutineDay } from './schema/routine-day.schema';
import { ExerciseService } from '../exercise/exercise.service';

describe('RoutineDayService', () => {
  let service: RoutineDayService;

  const routineDayModelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const exerciseServiceMock = {
    findByIds: jest.fn(),
  };

  const POPULATE_OPTS = { path: 'exercises.exercise', select: 'name category' };

  const leanQuery = (resolveValue: any, populateSelect = 'name category') => ({
    populate: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolveValue),
    __populateOpts: populateSelect,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutineDayService,
        {
          provide: getModelToken(RoutineDay.name),
          useValue: routineDayModelMock,
        },
        { provide: ExerciseService, useValue: exerciseServiceMock },
      ],
    }).compile();

    service = module.get<RoutineDayService>(RoutineDayService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('crea y serializa el día de rutina', async () => {
      routineDayModelMock.create.mockResolvedValue({
        _id: 'rd-1',
        title: 'Push',
        exercises: [],
      });

      const result = await service.create({ title: 'Push' } as any);

      expect(routineDayModelMock.create).toHaveBeenCalledWith({
        title: 'Push',
      });
      expect(result.id).toBe('rd-1');
    });
  });

  describe('consultas con populate de ejercicios', () => {
    it('findAll popula ejercicios y serializa el array', async () => {
      const query = leanQuery([{ _id: 'rd-1', title: 'Push', exercises: [] }]);
      routineDayModelMock.find.mockReturnValue(query);

      const result = await service.findAll();

      expect(query.populate).toHaveBeenCalledWith(POPULATE_OPTS);
      expect(result[0].id).toBe('rd-1');
    });

    it('findOne retorna null si no existe', async () => {
      routineDayModelMock.findById.mockReturnValue(leanQuery(null));

      expect(await service.findOne('missing')).toBeNull();
    });

    it('findOne popula y serializa el documento', async () => {
      routineDayModelMock.findById.mockReturnValue(
        leanQuery({ _id: 'rd-1', title: 'Pull' }),
      );

      const result = await service.findOne('rd-1');

      expect(routineDayModelMock.findById).toHaveBeenCalledWith('rd-1');
      expect(result?.id).toBe('rd-1');
    });

    it('findByCategory filtra por type', async () => {
      routineDayModelMock.find.mockReturnValue(leanQuery([]));

      await service.findByCategory('push');

      expect(routineDayModelMock.find).toHaveBeenCalledWith({ type: 'push' });
    });

    it('findByIds consulta con $in', async () => {
      routineDayModelMock.find.mockReturnValue(leanQuery([]));

      await service.findByIds(['rd-1', 'rd-2']);

      expect(routineDayModelMock.find).toHaveBeenCalledWith({
        _id: { $in: ['rd-1', 'rd-2'] },
      });
    });
  });

  describe('update / remove', () => {
    it('update popula y serializa el documento actualizado', async () => {
      routineDayModelMock.findByIdAndUpdate.mockReturnValue(
        leanQuery({ _id: 'rd-1', title: 'Piernas' }),
      );

      const result = await service.update('rd-1', { title: 'Piernas' } as any);

      expect(routineDayModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        'rd-1',
        { title: 'Piernas' },
        { new: true },
      );
      expect(result.title).toBe('Piernas');
    });

    it('update lanza error si no existe', async () => {
      routineDayModelMock.findByIdAndUpdate.mockReturnValue(leanQuery(null));

      await expect(
        service.update('missing', {} as any),
      ).rejects.toThrow('RoutineDay with id missing not found');
    });

    it('remove retorna true/false según haya eliminado', async () => {
      routineDayModelMock.findByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({ _id: 'rd-1' }),
      });
      routineDayModelMock.findByIdAndDelete.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      expect(await service.remove('rd-1')).toBe(true);
      expect(await service.remove('ghost')).toBe(false);
    });
  });

  describe('createFromWorkout', () => {
    const EX1 = '64f0000000000000000000e1';
    const EX2 = '64f0000000000000000000e2';
    const EX3 = '64f0000000000000000000e3';

    it('construye ejercicios ordenados y deriva los types del catálogo', async () => {
      exerciseServiceMock.findByIds.mockResolvedValue([
        { id: EX1, category: 'chest' },
        { id: EX2, category: 'chest' },
        { id: EX3, category: 'legs' },
      ]);
      routineDayModelMock.create.mockResolvedValue({ _id: 'rd-new' });

      const result = await service.createFromWorkout(
        'Full body',
        [EX1, EX2, EX3],
      );

      expect(exerciseServiceMock.findByIds).toHaveBeenCalledWith([
        EX1,
        EX2,
        EX3,
      ]);
      expect(routineDayModelMock.create).toHaveBeenCalledWith({
        title: 'Full body',
        exercises: [
          { exercise: expect.anything(), order: 1 },
          { exercise: expect.anything(), order: 2 },
          { exercise: expect.anything(), order: 3 },
        ],
        type: ['chest', 'legs'],
      });
      expect(result.id).toBe('rd-new');
    });

    it('omite ejercicios que no existen en el catálogo', async () => {
      exerciseServiceMock.findByIds.mockResolvedValue([
        { id: EX1, category: 'back' },
      ]);
      routineDayModelMock.create.mockResolvedValue({ _id: 'rd-new' });

      await service.createFromWorkout('Parcial', [
        EX1,
        '64f0000000000000000000ff',
      ]);

      const args = routineDayModelMock.create.mock.calls[0][0];
      expect(args.exercises).toEqual([
        { exercise: expect.anything(), order: 1 },
      ]);
      expect(args.type).toEqual(['back']);
    });
  });
});
