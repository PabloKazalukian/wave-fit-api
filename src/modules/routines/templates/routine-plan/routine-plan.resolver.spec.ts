import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { RoutinePlanResolver } from './routine-plan.resolver';
import { RoutinePlanService } from './routine-plan.service';
import { RoutineDayService } from '../routine-day/routine-day.service';
import { AuditLogsService } from '../../../audit-logs/audit-logs.service';

describe('RoutinePlanResolver', () => {
  let resolver: RoutinePlanResolver;

  const routinePlanServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    findByTitle: jest.fn(),
    findByIds: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getFavoriteRoutineIds: jest.fn(),
    markFavorites: jest.fn(),
  };

  const context = {
    req: { user: { id: new Types.ObjectId().toString() } },
  };

  const routineDayServiceMock = {
    findByIds: jest.fn(),
    getFavoriteRoutineDayIds: jest.fn(),
    markFavorites: jest.fn(),
  };

  const mockAuditLogsService = {
    logAsync: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
    getAllAndOverride: jest.fn(),
  };

  const planDay = (id: string, order: number, isRest = false) => ({
    day: isRest ? undefined : id,
    isRest,
    order,
  });

  const routineDay = (id: string, title: string) => ({
    id,
    title,
    exercises: [],
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutinePlanResolver,
        {
          provide: RoutinePlanService,
          useValue: routinePlanServiceMock,
        },
        {
          provide: RoutineDayService,
          useValue: routineDayServiceMock,
        },
        {
          provide: AuditLogsService,
          useValue: mockAuditLogsService,
        },
        {
          provide: Reflector,
          useValue: mockReflector,
        },
      ],
    }).compile();

    resolver = module.get<RoutinePlanResolver>(RoutinePlanResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('resolveRoutineDays', () => {
    it('retorna vacío si el plan no tiene week', async () => {
      const result = await resolver.resolveRoutineDays({} as any);
      expect(result).toEqual([]);
      expect(routineDayServiceMock.findByIds).not.toHaveBeenCalled();
    });

    it('retorna vacío si week está vacío', async () => {
      const result = await resolver.resolveRoutineDays({
        week: [],
      } as any);
      expect(result).toEqual([]);
      expect(routineDayServiceMock.findByIds).not.toHaveBeenCalled();
    });

    it('solo consulta los días que no son descanso', async () => {
      routineDayServiceMock.findByIds.mockResolvedValue([
        routineDay('day-1', 'Push'),
      ]);

      await resolver.resolveRoutineDays({
        week: [planDay('rest-0', 1, true), planDay('day-1', 2)],
      } as any);

      expect(routineDayServiceMock.findByIds).toHaveBeenCalledWith(['day-1']);
    });

    it('reconstruye la semana respetando el orden', async () => {
      routineDayServiceMock.findByIds.mockResolvedValue([
        routineDay('day-b', 'Pull'),
        routineDay('day-a', 'Push'),
      ]);

      const result = await resolver.resolveRoutineDays({
        week: [planDay('day-b', 2), planDay('day-a', 1)],
      } as any);

      expect(result.map((d: any) => d.title)).toEqual(['Push', 'Pull']);
    });

    it('inserta día de descanso placeholder para entradas rest', async () => {
      const result = await resolver.resolveRoutineDays({
        week: [planDay(null, 1, true)],
      } as any);

      expect(result).toEqual([
        { id: 'rest', title: 'Descanso', exercises: [] },
      ]);
      expect(routineDayServiceMock.findByIds).not.toHaveBeenCalled();
    });

    it('usa placeholder de descanso cuando el día no se encuentra en DB', async () => {
      routineDayServiceMock.findByIds.mockResolvedValue([]);

      const result = await resolver.resolveRoutineDays({
        week: [planDay('missing-day', 1)],
      } as any);

      expect(result).toEqual([
        { id: 'rest', title: 'Descanso', exercises: [] },
      ]);
    });

    it('marca los días anidados con favoritos cuando hay usuario en el contexto', async () => {
      const days = [routineDay('day-a', 'Push'), routineDay('day-b', 'Pull')];
      const marked = [
        { ...days[0], isFavorite: false },
        { ...days[1], isFavorite: true },
      ];
      routineDayServiceMock.findByIds.mockResolvedValue(days);
      routineDayServiceMock.getFavoriteRoutineDayIds.mockResolvedValue(
        new Set(['day-b']),
      );
      routineDayServiceMock.markFavorites.mockReturnValue(marked);

      const result = await resolver.resolveRoutineDays(
        { week: [planDay('day-a', 1), planDay('day-b', 2)] } as any,
        context,
      );

      expect(result).toBe(marked);
      expect(routineDayServiceMock.getFavoriteRoutineDayIds).toHaveBeenCalledWith(
        String(context.req.user.id),
      );
      expect(routineDayServiceMock.markFavorites).toHaveBeenCalledWith(
        expect.any(Array),
        new Set(['day-b']),
      );
    });
  });

  describe('queries y mutations', () => {
    it('routines enriquece con isFavorite usando el userId del contexto', async () => {
      const plans = [{ id: 'plan-1' }, { id: 'plan-2' }];
      const favorites = new Set(['plan-2']);
      const enriched = [
        { id: 'plan-1', isFavorite: false },
        { id: 'plan-2', isFavorite: true },
      ];
      routinePlanServiceMock.findAll.mockResolvedValue(plans);
      routinePlanServiceMock.getFavoriteRoutineIds.mockResolvedValue(favorites);
      routinePlanServiceMock.markFavorites.mockReturnValue(enriched);

      const result = await resolver.routines(context);

      expect(routinePlanServiceMock.getFavoriteRoutineIds).toHaveBeenCalledWith(
        context.req.user.id,
      );
      expect(routinePlanServiceMock.markFavorites).toHaveBeenCalledWith(
        plans,
        favorites,
      );
      expect(result).toEqual(enriched);
    });

    it('findOne enriquece el plan con isFavorite', async () => {
      const favorites = new Set(['plan-1']);
      const enriched = [{ id: 'plan-1', isFavorite: true }];
      routinePlanServiceMock.findOne.mockResolvedValue({ id: 'plan-1' });
      routinePlanServiceMock.getFavoriteRoutineIds.mockResolvedValue(favorites);
      routinePlanServiceMock.markFavorites.mockReturnValue(enriched);

      const result = await resolver.findOne('plan-1', context);

      expect(routinePlanServiceMock.findOne).toHaveBeenCalledWith('plan-1');
      expect(result).toEqual(enriched[0]);
    });

    it('createRoutinePlan delega en create', () => {
      const input = { name: 'PPL', description: 'desc' } as any;
      routinePlanServiceMock.create.mockReturnValue({ id: 'new' });

      expect(resolver.createRoutinePlan(input)).toEqual({ id: 'new' });
      expect(routinePlanServiceMock.create).toHaveBeenCalledWith(input);
    });

    it('updateRoutinePlan delega en update con id e input', () => {
      const input = { id: 'plan-1', name: 'Upper' } as any;
      routinePlanServiceMock.update.mockReturnValue({ id: 'plan-1' });

      expect(resolver.updateRoutinePlan(input)).toEqual({ id: 'plan-1' });
      expect(routinePlanServiceMock.update).toHaveBeenCalledWith(
        'plan-1',
        input,
      );
    });

    it('removeRoutinePlan delega en remove', () => {
      routinePlanServiceMock.remove.mockReturnValue({ id: 'plan-1' });

      expect(resolver.removeRoutinePlan('plan-1')).toEqual({ id: 'plan-1' });
      expect(routinePlanServiceMock.remove).toHaveBeenCalledWith('plan-1');
    });

    it('isRoutineTitleAvailable retorna true si el título no existe', async () => {
      routinePlanServiceMock.findByTitle.mockResolvedValue(null);

      const result = await resolver.isRoutineTitleAvailable({
        title: 'Libre',
      });
      expect(result).toBe(true);
      expect(routinePlanServiceMock.findByTitle).toHaveBeenCalledWith('Libre');
    });

    it('isRoutineTitleAvailable retorna false si el título existe', async () => {
      routinePlanServiceMock.findByTitle.mockResolvedValue({ id: 'x' });

      const result = await resolver.isRoutineTitleAvailable({
        title: 'Ocupado',
      });
      expect(result).toBe(false);
    });
  });
});
