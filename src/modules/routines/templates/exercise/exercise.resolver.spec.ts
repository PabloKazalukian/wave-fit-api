import { Test, TestingModule } from '@nestjs/testing';
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

  it('exercises delega en findAll', () => {
    const list = [{ id: 'ex-1' }];
    exerciseServiceMock.findAll.mockReturnValue(list);

    expect(resolver.exercises()).toBe(list);
  });

  it('findOne delega con el id recibido', () => {
    exerciseServiceMock.findOne.mockReturnValue({ id: 'ex-1' });

    expect(resolver.findOne('ex-1')).toEqual({ id: 'ex-1' });
    expect(exerciseServiceMock.findOne).toHaveBeenCalledWith('ex-1');
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
