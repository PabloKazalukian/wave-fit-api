import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExerciseService } from './exercise.service';
import { getModelToken } from '@nestjs/mongoose';
import { Exercise } from './schema/exercise.schema';

describe('ExerciseService', () => {
  let service: ExerciseService;

  const exerciseModelMock = {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const leanQuery = (resolveValue: any) => ({
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolveValue),
  });

  const existing = (id: string, name: string, normalizedName: string) => ({
    _id: id,
    name,
    normalizedName,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExerciseService,
        {
          provide: getModelToken(Exercise.name),
          useValue: exerciseModelMock,
        },
      ],
    }).compile();

    service = module.get<ExerciseService>(ExerciseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const input = { name: 'Press Banca', category: 'chest' } as any;

    it('normaliza el nombre y crea el ejercicio', async () => {
      exerciseModelMock.findOne.mockReturnValue(leanQuery(null));
      exerciseModelMock.find.mockReturnValue(leanQuery([]));
      exerciseModelMock.create.mockResolvedValue({
        _id: 'ex-1',
        name: 'Press Banca',
        normalizedName: 'press banca',
        category: 'chest',
      });

      const result = await service.create(input);

      expect(exerciseModelMock.findOne).toHaveBeenCalledWith({
        normalizedName: 'press banca',
      });
      expect(exerciseModelMock.create).toHaveBeenCalledWith({
        name: 'Press Banca',
        category: 'chest',
        normalizedName: 'press banca',
      });
      expect(result.id).toBe('ex-1');
      expect(result._id).toBeUndefined();
    });

    it('respeta el id provisto en el input', async () => {
      exerciseModelMock.findOne.mockReturnValue(leanQuery(null));
      exerciseModelMock.find.mockReturnValue(leanQuery([]));
      exerciseModelMock.create.mockResolvedValue({ _id: 'custom-id' });

      await service.create({ ...input, id: 'custom-id' } as any);

      expect(exerciseModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({ _id: 'custom-id' }),
      );
    });

    it('rechaza duplicado exacto por nombre normalizado', async () => {
      exerciseModelMock.findOne.mockReturnValue(
        leanQuery(existing('ex-1', 'press banca', 'press banca')),
      );

      await expect(service.create(input)).rejects.toThrow(BadRequestException);
      try {
        await service.create(input);
      } catch (e) {
        expect((e as BadRequestException).getResponse()).toMatchObject({
          code: 'DUPLICATE_NAME',
        });
      }
      expect(exerciseModelMock.create).not.toHaveBeenCalled();
    });

    it('rechaza nombres similares a ejercicios existentes', async () => {
      exerciseModelMock.findOne.mockReturnValue(leanQuery(null));
      exerciseModelMock.find.mockReturnValue(
        leanQuery([existing('ex-2', 'Press Plano', 'press plano')]),
      );

      // "Pres Plano" dista 1 de "press plano"
      await expect(
        service.create({ name: 'Pres Plano' } as any),
      ).rejects.toThrow(/muy similar/);
      expect(exerciseModelMock.create).not.toHaveBeenCalled();
    });

    it('permite nombres opuestos aunque sean parecidos (pull/push)', async () => {
      exerciseModelMock.findOne.mockReturnValue(leanQuery(null));
      exerciseModelMock.find.mockReturnValue(
        leanQuery([existing('ex-3', 'Push Up', 'push up')]),
      );
      exerciseModelMock.create.mockResolvedValue({ _id: 'ex-4' });

      // "Pull Up" dista 2 de "push up" pero son opuestos → permitido
      await expect(
        service.create({ name: 'Pull Up' } as any),
      ).resolves.toBeDefined();
    });
  });

  describe('consultas', () => {
    it('findAll serializa el array completo', async () => {
      exerciseModelMock.find.mockReturnValue(
        leanQuery([{ _id: 'ex-1', name: 'A' }]),
      );

      const result = await service.findAll();

      expect(result[0].id).toBe('ex-1');
    });

    it('findByIds consulta con $in y serializa', async () => {
      exerciseModelMock.find.mockReturnValue(
        leanQuery([{ _id: 'ex-1', name: 'A' }]),
      );

      const result = await service.findByIds(['ex-1', 'ex-2']);

      expect(exerciseModelMock.find).toHaveBeenCalledWith({
        _id: { $in: ['ex-1', 'ex-2'] },
      });
      expect(result).toHaveLength(1);
    });

    it('findOne retorna null si no existe', async () => {
      exerciseModelMock.findById.mockReturnValue(leanQuery(null));

      const result = await service.findOne('missing');

      expect(result).toBeNull();
    });

    it('findOne serializa el documento encontrado', async () => {
      exerciseModelMock.findById.mockReturnValue(
        leanQuery({ _id: 'ex-9', name: 'Remo' }),
      );

      const result = await service.findOne('ex-9');

      expect(result?.id).toBe('ex-9');
    });
  });

  describe('update', () => {
    it('actualiza sin validar similitud si no cambia el nombre', async () => {
      exerciseModelMock.findByIdAndUpdate.mockReturnValue(
        leanQuery({ _id: 'ex-1', category: 'legs' }),
      );

      const result = await service.update('ex-1', {
        category: 'legs',
      } as any);

      expect(exerciseModelMock.findByIdAndUpdate).toHaveBeenCalledWith(
        'ex-1',
        { category: 'legs' },
        { new: true },
      );
      expect(result.category).toBe('legs');
    });

    it('valida similitud excluyendo el propio documento al cambiar nombre', async () => {
      exerciseModelMock.find.mockReturnValue(
        leanQuery([existing('ex-2', 'Sentadilla', 'sentadilla')]),
      );

      await expect(
        service.update('ex-1', { name: 'Sentadillas' } as any),
      ).rejects.toThrow(/muy similar/);
      expect(exerciseModelMock.find).toHaveBeenCalledWith({
        _id: { $ne: 'ex-1' },
      });
      expect(exerciseModelMock.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it('lanza error si el ejercicio no existe', async () => {
      exerciseModelMock.findByIdAndUpdate.mockReturnValue(leanQuery(null));

      await expect(
        service.update('missing', { category: 'x' } as any),
      ).rejects.toThrow('Exercise with id missing not found');
    });
  });

  describe('remove', () => {
    it('retorna true si eliminó un documento', async () => {
      exerciseModelMock.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ _id: 'ex-1' }),
      });

      expect(await service.remove('ex-1')).toBe(true);
    });

    it('retorna false si no había nada que eliminar', async () => {
      exerciseModelMock.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      expect(await service.remove('ghost')).toBe(false);
    });
  });
});
