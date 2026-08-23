import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TrainingPlanService } from './training-plan.service';
import { TrainingPlan, PlanStatus } from './schema/training-plan.schema';
import { PlanGeneratorService } from './plan-generator/plan-generator.service';

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
      ],
    }).compile();

    service = module.get<TrainingPlanService>(TrainingPlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    const baseInput = {
      title: 'PPL Verano',
      focus: 'muscle_gain',
      durationWeeks: 8,
      trainingDaysPerWeek: 6,
    } as any;

    it('crea el plan con valores por defecto de fechas y tags', async () => {
      const created = makePlan({ focus: 'hypertrophy' });
      trainingPlanModelMock.create.mockResolvedValue(created);

      const result = await service.create(baseInput, USER_ID);

      expect(trainingPlanModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'PPL Verano',
          tags: [],
        }),
      );
      const args = trainingPlanModelMock.create.mock.calls[0][0];
      expect(args.startDate).toBeInstanceOf(Date);
      expect(args.endDate).toBeInstanceOf(Date);
      expect(result.focus).toBe('muscle_gain');
    });

    it('usa la startDate provista y normaliza el focus legacy', async () => {
      const created = makePlan({ focus: 'hypertrophy' });
      trainingPlanModelMock.create.mockResolvedValue(created);

      await service.create(
        { ...baseInput, startDate: '2026-02-01', tags: ['ppl'] } as any,
        USER_ID,
      );

      expect(trainingPlanModelMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: new Date('2026-02-01'),
          tags: ['ppl'],
        }),
      );
      expect(created.focus).toBe('muscle_gain');
    });
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

  describe('confirm', () => {
    it('marca el plan como confirmado', async () => {
      const plan = makePlan({ confirmed: true });
      trainingPlanModelMock.findOneAndUpdate.mockReturnValue(
        buildQueryMock(plan),
      );

      const result = await service.confirm(PLAN_ID, USER_ID);

      expect(trainingPlanModelMock.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { confirmed: true } },
        { new: true },
      );
      expect(result.confirmed).toBe(true);
    });

    it('lanza NotFoundException si el plan no existe', async () => {
      trainingPlanModelMock.findOneAndUpdate.mockReturnValue(
        buildQueryMock(null),
      );

      await expect(service.confirm(MISSING_ID, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
