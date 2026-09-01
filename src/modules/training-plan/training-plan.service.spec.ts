import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlan, PlanStatus } from './schema/training-plan.schema';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';
import { PlanModifierService } from './plan-modifier/plan-modifier.service';

describe('TrainingPlanService', () => {
  let service: TrainingPlanService;

  const trainingPlanModelMock = {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  };

  const planGeneratorServiceMock = {
    generatePlan: jest.fn(),
  };

  const planModifierServiceMock = {
    modifyPlan: jest.fn(),
  };

  const USER_ID = '507f1f77bcf86cd799439011';
  const PLAN_ID = '64f000000000000000000010';
  const MISSING_ID = '64f000000000000000000099';

  const makePlan = (overrides: Partial<any> = {}) => ({
    _id: PLAN_ID,
    focus: 'hypertrophy',
    ...overrides,
  });

  const buildQueryMock = (resolveValue: any) => {
    const query = {
      sort: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(resolveValue),
    };
    return query;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrainingPlanService,
        {
          provide: getModelToken(TrainingPlan.name),
          useValue: trainingPlanModelMock,
        },
        {
          provide: PlanGeneratorService,
          useValue: planGeneratorServiceMock,
        },
        {
          provide: PlanModifierService,
          useValue: planModifierServiceMock,
        },
      ],
    }).compile();

    service = module.get<TrainingPlanService>(TrainingPlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('pagina, cuenta y normaliza el focus de cada plan', async () => {
      const plans = [makePlan(), makePlan({ focus: 'sport_specific' })];
      trainingPlanModelMock.find.mockReturnValue(buildQueryMock(plans));
      trainingPlanModelMock.countDocuments.mockResolvedValue(15);

      const result = await service.findAll(USER_ID, 5, 10);

      expect(trainingPlanModelMock.find).toHaveBeenCalled();
      expect(result.items[0].focus).toBe('muscle_gain');
      expect(result.items[1].focus).toBe('strength');
      expect(result.total).toBe(15);
      expect(result.totalPages).toBe(3);
    });

    it('redondea hacia arriba con resto en totalPages', async () => {
      trainingPlanModelMock.find.mockReturnValue(buildQueryMock([]));
      trainingPlanModelMock.countDocuments.mockResolvedValue(11);

      const result = await service.findAll(USER_ID, 5, 0);

      expect(result.totalPages).toBe(3);
    });
  });

  describe('findOne', () => {
    it('retorna el plan con focus normalizado', async () => {
      trainingPlanModelMock.findOne.mockReturnValue(
        buildQueryMock(makePlan({ focus: 'general' })),
      );

      const result = await service.findOne(PLAN_ID, USER_ID);

      expect(trainingPlanModelMock.findOne).toHaveBeenCalled();
      expect(result.focus).toBe('maintenance');
    });

    it('lanza NotFoundException si no existe o es de otro usuario', async () => {
      trainingPlanModelMock.findOne.mockReturnValue(buildQueryMock(null));

      await expect(service.findOne(MISSING_ID, USER_ID)).rejects.toThrow(
        new NotFoundException('Training plan not found'),
      );
    });
  });

  describe('update', () => {
    it('actualiza y normaliza el focus', async () => {
      trainingPlanModelMock.findOneAndUpdate.mockReturnValue(
        buildQueryMock(makePlan({ focus: 'unknown_focus' })),
      );

      const result = await service.update(
        PLAN_ID,
        { id: PLAN_ID } as any,
        USER_ID,
      );

      expect(trainingPlanModelMock.findOneAndUpdate).toHaveBeenCalled();
      expect(result.focus).toBe('maintenance');
    });

    it('lanza NotFoundException si el plan no existe', async () => {
      trainingPlanModelMock.findOneAndUpdate.mockReturnValue(
        buildQueryMock(null),
      );

      await expect(
        service.update(MISSING_ID, { id: MISSING_ID } as any, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('elimina y retorna el plan', async () => {
      const plan = makePlan();
      trainingPlanModelMock.findOneAndDelete.mockReturnValue(
        buildQueryMock(plan),
      );

      const result = await service.remove(PLAN_ID, USER_ID);

      expect(result).toBe(plan);
    });

    it('lanza NotFoundException si no hay nada que eliminar', async () => {
      trainingPlanModelMock.findOneAndDelete.mockReturnValue(
        buildQueryMock(null),
      );

      await expect(service.remove(MISSING_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('generate', () => {
    const startDate = new Date('2026-01-05T00:00:00Z');

    const generationResult = {
      weekLog: { startDate },
      userProfileId: '64f000000000000000000001',
      goalId: '64f000000000000000000002',
      metadata: {
        title: 'PPL Hipertrofia',
        focus: 'muscle_gain',
        durationWeeks: 8,
        daysPerWeek: 6,
      },
      aiSnapshot: { promptUsed: 'x', rawContent: 'y' },
    } as any;

    it('crea un plan DRAFT sin confirmar con endDate calculado', async () => {
      const created = makePlan({ focus: 'muscle_gain' });
      trainingPlanModelMock.create.mockResolvedValue(created);
      planGeneratorServiceMock.generatePlan.mockResolvedValue(
        generationResult,
      );

      const result = await service.generate(USER_ID);

      expect(planGeneratorServiceMock.generatePlan).toHaveBeenCalledWith(
        USER_ID,
        '',
      );

      const expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + 8 * 7);

      const args = trainingPlanModelMock.create.mock.calls[0][0];
      expect(args.status).toBe(PlanStatus.DRAFT);
      expect(args.confirmed).toBe(false);
      expect(args.endDate).toEqual(expectedEndDate);
      expect(args.durationWeeks).toBe(8);
      expect(args.trainingDaysPerWeek).toBe(6);
      expect(args.aiSnapshot).toBe(generationResult.aiSnapshot);
      expect(result.focus).toBe('muscle_gain');
    });

    it('propaga el comentario del usuario al generador', async () => {
      trainingPlanModelMock.create.mockResolvedValue(makePlan());
      planGeneratorServiceMock.generatePlan.mockResolvedValue(generationResult);

      await service.generate(USER_ID, 'quiero más volumen');

      expect(planGeneratorServiceMock.generatePlan).toHaveBeenCalledWith(
        USER_ID,
        'quiero más volumen',
      );
    });
  });

  describe('modify', () => {
    const startDate = new Date('2026-01-05T00:00:00Z');

    const modifyResult = {
      weekLog: { startDate },
      userProfileId: '64f000000000000000000001',
      goalId: '64f000000000000000000002',
      metadata: {
        title: 'PPL Modificado',
        focus: 'muscle_gain',
        durationWeeks: 8,
        daysPerWeek: 6,
      },
      aiSnapshot: { promptUsed: 'y', rawContent: 'z' },
    } as any;

    const withQueryMock = (resolveValue: any) => ({
      exec: jest.fn().mockResolvedValue(resolveValue),
    });

    it('modifica el MISMO documento, incrementa version y actualiza aiSnapshot', async () => {
      trainingPlanModelMock.findOne.mockReturnValue(
        withQueryMock(makePlan({ confirmed: false, version: 2, aiSnapshot: { rawResponse: {} } })),
      );
      planModifierServiceMock.modifyPlan.mockResolvedValue(modifyResult);

      const updatedPlan = makePlan({
        focus: 'muscle_gain',
        version: 3,
        aiSnapshot: modifyResult.aiSnapshot,
      });
      trainingPlanModelMock.findOneAndUpdate.mockReturnValue(
        withQueryMock(updatedPlan),
      );

      const result = await service.modify(USER_ID, PLAN_ID, 'cambia el día 2');

      expect(planModifierServiceMock.modifyPlan).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ _id: PLAN_ID }),
        'cambia el día 2',
      );

      const setArgs = trainingPlanModelMock.findOneAndUpdate.mock.calls[0][1]
        .$set;
      expect(setArgs.title).toBe('PPL Modificado');
      expect(setArgs.aiSnapshot).toBe(modifyResult.aiSnapshot);
      expect(setArgs.version).toBe(3);
      expect(result.focus).toBe('muscle_gain');
    });

    it('lanza ConflictException si el plan ya fue confirmado', async () => {
      trainingPlanModelMock.findOne.mockReturnValue(
        withQueryMock(makePlan({ confirmed: true })),
      );

      await expect(service.modify(USER_ID, PLAN_ID, 'cambia')).rejects.toThrow(
        'El plan ya fue confirmado y no puede modificarse',
      );
      expect(planModifierServiceMock.modifyPlan).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el plan no existe o es de otro usuario', async () => {
      trainingPlanModelMock.findOne.mockReturnValue(withQueryMock(null));

      await expect(service.modify(USER_ID, MISSING_ID, 'cambia')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
