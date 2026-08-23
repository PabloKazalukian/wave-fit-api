import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
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
    update: jest.fn(),
    remove: jest.fn(),
  };

  const routineDayServiceMock = {
    findByIds: jest.fn(),
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
  });

  describe('queries y mutations', () => {
    it('routines delega en findAll', () => {
      const plans = [{ id: 'plan-1' }];
      routinePlanServiceMock.findAll.mockReturnValue(plans);

      expect(resolver.routines()).toBe(plans);
      expect(routinePlanServiceMock.findAll).toHaveBeenCalled();
    });

    it('findOne delega en service con el id recibido', () => {
      const plan = { id: 'plan-1' };
      routinePlanServiceMock.findOne.mockReturnValue(plan);

      expect(resolver.findOne('plan-1')).toBe(plan);
      expect(routinePlanServiceMock.findOne).toHaveBeenCalledWith('plan-1');
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
