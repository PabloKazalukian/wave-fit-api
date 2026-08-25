import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ConfirmPlanService } from './confirm-plan.service';
import { TrainingPlan } from '../schema/training-plan.schema';
import { PlanConfirmationAction, PlanStatus } from '../schema/training-plan.schema';
import { PlanMaterializerService } from '../plan-materializer/plan-materializer.service';
import { PlanGeneratorParser } from '../plan-generator/plan-generator.parser';
import { WEEK_LOG_REPOSITORY } from 'src/modules/routines/tracking/week-log/domain/interfaces/repositories/week-log.repository.interface';
import { WorkoutSessionService } from '../../routines/tracking/workout-session/workout-session.service';
import { RoutineDay } from '../../routines/templates/routine-day/schema/routine-day.schema';
import { RoutinePlan } from '../../routines/templates/routine-plan/schema/routine-plan.schema';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';

describe('ConfirmPlanService', () => {
  let service: ConfirmPlanService;

  const USER_ID = '507f1f77bcf86cd799439011';
  const PLAN_ID = '64f000000000000000000010';
  const EXERCISE_ID = '64f9aabbccddeeff00112233';

  const trainingPlanModelMock = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  const materializerMock = {
    materializeWeekLog: jest.fn(),
    resolveAgainstCatalog: jest.fn(),
  };

  const weekLogRepositoryMock = {
    findActive: jest.fn(),
    create: jest.fn(),
  };

  const workoutSessionServiceMock = {
    insertMany: jest.fn(),
  };

  const routineDayModelMock = {
    insertMany: jest.fn(),
    updateMany: jest.fn(),
  };

  const routinePlanModelMock = {
    create: jest.fn(),
  };

  const auditLogsServiceMock = {
    logAsync: jest.fn(),
  };

  // ── Builders ──────────────────────────────────────────────────────────────

  /** Snapshot IA: 3 días de entreno y 4 de descanso */
  const buildRawResponse = () => ({
    title: 'PPL IA',
    focus: 'muscle_gain',
    durationWeeks: 4,
    daysPerWeek: 3,
    days: [
      { order: 1, isRest: false, focus: 'push', exercises: [{ name: 'Press Banca', plannedSets: 4 }, { name: 'Press Inclinado', plannedSets: 3 }] },
      { order: 2, isRest: true, focus: null, exercises: [] },
      { order: 3, isRest: false, focus: 'pull', exercises: [{ name: 'Dominadas', plannedSets: 4 }] },
      { order: 4, isRest: true, focus: null, exercises: [] },
      { order: 5, isRest: true, focus: null, exercises: [] },
      { order: 6, isRest: false, focus: 'legs', exercises: [{ name: 'Sentadilla', plannedSets: 5 }] },
      { order: 7, isRest: true, focus: null, exercises: [] },
    ],
  });

  const makePlanDoc = (overrides: Partial<any> = {}) => ({
    _id: new Types.ObjectId(PLAN_ID),
    userId: new Types.ObjectId(USER_ID),
    title: 'PPL IA',
    focus: 'muscle_gain',
    description: null,
    confirmed: false,
    status: 'draft',
    aiSnapshot: { rawResponse: buildRawResponse() },
    __confirmedAction: null,
    ...overrides,
  });

  const stubFindOne = (doc: any) => {
    trainingPlanModelMock.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  const stubFindOneAndUpdate = (doc: any) => {
    trainingPlanModelMock.findOneAndUpdate.mockReturnValue({
      exec: jest.fn().mockResolvedValue(doc),
    });
  };

  const makeUpdatedDoc = (overrides: Partial<any> = {}) => ({
    ...makePlanDoc(),
    confirmed: true,
    status: PlanStatus.ACTIVE,
    focus: 'muscle_gain',
    ...overrides,
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    routineDayModelMock.updateMany.mockReturnValue({
      exec: jest.fn().mockResolvedValue({}),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConfirmPlanService,
        { provide: getModelToken(TrainingPlan.name), useValue: trainingPlanModelMock },
        { provide: PlanMaterializerService, useValue: materializerMock },
        PlanGeneratorParser,
        { provide: WEEK_LOG_REPOSITORY, useValue: weekLogRepositoryMock },
        { provide: WorkoutSessionService, useValue: workoutSessionServiceMock },
        { provide: getModelToken(RoutineDay.name), useValue: routineDayModelMock },
        { provide: getModelToken(RoutinePlan.name), useValue: routinePlanModelMock },
        { provide: AuditLogsService, useValue: auditLogsServiceMock },
      ],
    }).compile();

    service = module.get<ConfirmPlanService>(ConfirmPlanService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Validaciones comunes ────────────────────────────────────────────────

  describe('validaciones previas', () => {
    it('lanza NotFoundException si el id es inválido sin tocar la DB', async () => {
      await expect(
        service.confirm(USER_ID, 'id-invalido', PlanConfirmationAction.CREATE_WEEK_LOG),
      ).rejects.toThrow(NotFoundException);

      expect(trainingPlanModelMock.findOne).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException si el plan no existe o es de otro usuario', async () => {
      stubFindOne(null);

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.CREATE_WEEK_LOG),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el plan ya fue confirmado (doble confirmación)', async () => {
      stubFindOne(makePlanDoc({ confirmed: true }));

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.CREATE_ROUTINE_PLAN),
      ).rejects.toThrow(ConflictException);

      expect(materializerMock.resolveAgainstCatalog).not.toHaveBeenCalled();
    });

    it('ADAPT_ACTIVE_WEEK queda como stub con NotImplementedException', async () => {
      stubFindOne(makePlanDoc());

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.ADAPT_ACTIVE_WEEK),
      ).rejects.toThrow(NotImplementedException);
    });

    it('audita el fallo de la confirmación', async () => {
      stubFindOne(makePlanDoc({ confirmed: true }));

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.CREATE_WEEK_LOG),
      ).rejects.toThrow(ConflictException);

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_CONFIRMED',
          success: false,
          userId: USER_ID,
        }),
      );
    });
  });

  // ── Acción CREATE_WEEK_LOG ───────────────────────────────────────────────

  describe('CREATE_WEEK_LOG', () => {
    it('crea la semana + sesiones y linkea el plan', async () => {
      const planDoc = makePlanDoc();
      stubFindOne(planDoc);

      weekLogRepositoryMock.findActive.mockResolvedValue(null);

      const weekLog = { id: 'weeklog-id' };
      const sessions = [
        { _id: 's1', userId: USER_ID, weekLogId: 'weeklog-id' },
        { _id: 's2', userId: USER_ID, weekLogId: 'weeklog-id' },
        { _id: 's3', userId: USER_ID, weekLogId: 'weeklog-id' },
      ];
      materializerMock.materializeWeekLog.mockResolvedValue({ weekLog, sessions });

      weekLogRepositoryMock.create.mockResolvedValue(weekLog);

      const updatedDoc = makeUpdatedDoc({
        resultingWeekLogId: weekLog.id,
        confirmedAction: PlanConfirmationAction.CREATE_WEEK_LOG,
      });
      stubFindOneAndUpdate(updatedDoc);

      const result = await service.confirm(
        USER_ID,
        PLAN_ID,
        PlanConfirmationAction.CREATE_WEEK_LOG,
      );

      // materializa desde el snapshot persistido
      expect(materializerMock.materializeWeekLog).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ title: 'PPL IA', durationWeeks: 4 }),
      );

      // inserta sesiones antes del weekLog
      expect(workoutSessionServiceMock.insertMany).toHaveBeenCalledWith(sessions);
      expect(weekLogRepositoryMock.create).toHaveBeenCalledWith(weekLog);

      // actualización atómica con condición confirmed:false
      expect(trainingPlanModelMock.findOneAndUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ _id: planDoc._id, confirmed: false }),
        expect.objectContaining({
          $set: expect.objectContaining({
            confirmed: true,
            status: PlanStatus.ACTIVE,
            resultingWeekLogId: weekLog.id,
          }),
        }),
        { new: true },
      );

      expect(result.trainingPlan).toBe(updatedDoc);
      expect(result.weekLog).toBe(weekLog);
      expect(result.routinePlan).toBeNull();

      expect(auditLogsServiceMock.logAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRAINING_PLAN_CONFIRMED',
          success: true,
          metadata: expect.objectContaining({
            confirmationAction: PlanConfirmationAction.CREATE_WEEK_LOG,
          }),
        }),
      );
    });

    it('rechaza con ConflictException si ya existe una semana activa', async () => {
      stubFindOne(makePlanDoc());
      weekLogRepositoryMock.findActive.mockResolvedValue({ id: 'semana-activa' });

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.CREATE_WEEK_LOG),
      ).rejects.toThrow(ConflictException);

      expect(workoutSessionServiceMock.insertMany).not.toHaveBeenCalled();
      expect(weekLogRepositoryMock.create).not.toHaveBeenCalled();
      expect(trainingPlanModelMock.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('rechaza si el snapshot de IA no existe en el documento', async () => {
      stubFindOne(makePlanDoc({ aiSnapshot: { rawResponse: null } }));

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.CREATE_WEEK_LOG),
      ).rejects.toThrow(ConflictException);

      expect(materializerMock.materializeWeekLog).not.toHaveBeenCalled();
    });
  });

  // ── Acción CREATE_ROUTINE_PLAN ───────────────────────────────────────────

  describe('CREATE_ROUTINE_PLAN', () => {
    const DAY_ID_1 = new Types.ObjectId();
    const DAY_ID_2 = new Types.ObjectId();
    const DAY_ID_3 = new Types.ObjectId();

    const stubTemplateResolution = () => {
      materializerMock.resolveAgainstCatalog.mockImplementation(
        async (_userId: string, plan: any) => {
          for (const day of plan.days) {
            for (const ex of day.exercises) ex.exerciseId = EXERCISE_ID;
          }
          return new Map([
            [EXERCISE_ID, { name: 'Press Banca', category: 'chest' }],
          ]);
        },
      );
    };

    it('crea RoutineDays (sin pesos) + RoutinePlan marcado como IA', async () => {
      const planDoc = makePlanDoc();
      stubFindOne(planDoc);
      stubTemplateResolution();

      const insertedDays = [
        { _id: DAY_ID_1 },
        { _id: DAY_ID_2 },
        { _id: DAY_ID_3 },
      ];
      routineDayModelMock.insertMany.mockResolvedValue(insertedDays);

      const routinePlanDoc = {
        _id: new Types.ObjectId(),
        name: 'PPL IA',
        description: 'Rutina generada con IA (muscle_gain)',
        isAiGenerated: true,
        createdBy: new Types.ObjectId(USER_ID),
        week: [],
      };
      routinePlanModelMock.create.mockResolvedValue(routinePlanDoc);

      const updatedDoc = makeUpdatedDoc({
        resultingRoutinePlanId: routinePlanDoc._id.toString(),
        confirmedAction: PlanConfirmationAction.CREATE_ROUTINE_PLAN,
      });
      stubFindOneAndUpdate(updatedDoc);

      const result = await service.confirm(
        USER_ID,
        PLAN_ID,
        PlanConfirmationAction.CREATE_ROUTINE_PLAN,
      );

      // 3 RoutineDays, solo ejercicios con id y orden (sin pesos)
      const insertedArg = routineDayModelMock.insertMany.mock.calls[0][0];
      expect(insertedArg).toHaveLength(3);
      expect(insertedArg[0].title).toBe('Push');
      expect(insertedArg[0].type).toEqual(['chest']);
      expect(insertedArg[0].exercises).toEqual([
        { exercise: new Types.ObjectId(EXERCISE_ID), order: 0 },
        { exercise: new Types.ObjectId(EXERCISE_ID), order: 1 },
      ]);

      // semana de 7 entradas: descanso los días sin rutina
      const createdArg = routinePlanModelMock.create.mock.calls[0][0];
      expect(createdArg.week).toHaveLength(7);
      expect(createdArg.week.filter((w: any) => w.isRest)).toHaveLength(4);
      expect(createdArg.week[0]).toEqual({ day: DAY_ID_1, isRest: false, order: 0 });
      expect(createdArg.week[1]).toEqual({ day: null, isRest: true, order: 1 });
      expect(createdArg.name).toBe('PPL IA');
      expect(createdArg.createdBy).toEqual(new Types.ObjectId(USER_ID));
      expect(createdArg.isAiGenerated).toBe(true);
      expect(createdArg.generatedFromPlanId).toEqual(planDoc._id);

      // back-link días → plan
      expect(routineDayModelMock.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [DAY_ID_1, DAY_ID_2, DAY_ID_3] } },
        { planId: routinePlanDoc._id },
      );

      // plan actualizado con la referencia al template
      expect(trainingPlanModelMock.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({
            confirmed: true,
            resultingRoutinePlanId: routinePlanDoc._id.toString(),
          }),
        }),
        { new: true },
      );

      expect(result.trainingPlan).toBe(updatedDoc);
      expect(result.routinePlan).toBeDefined();
      expect(result.weekLog).toBeNull();
    });

    it('rechaza si el snapshot no tiene días de entrenamiento', async () => {
      const raw = buildRawResponse();
      raw.days.forEach((d) => {
        d.isRest = true;
        d.exercises = [];
      });
      stubFindOne(makePlanDoc({ aiSnapshot: { rawResponse: raw } }));

      await expect(
        service.confirm(USER_ID, PLAN_ID, PlanConfirmationAction.CREATE_ROUTINE_PLAN),
      ).rejects.toThrow(BadRequestException);

      expect(routineDayModelMock.insertMany).not.toHaveBeenCalled();
    });
  });
});
