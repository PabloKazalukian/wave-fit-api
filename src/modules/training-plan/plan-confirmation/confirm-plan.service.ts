import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotImplementedException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  TrainingPlan,
  PlanConfirmationAction,
  PlanStatus,
  normalizePlanFocus,
} from '../schema/training-plan.schema';
import { PlanMaterializerService } from '../plan-materializer/plan-materializer.service';
import {
  PlanGeneratorParser,
  ParsedPlan,
} from '../plan-generator/plan-generator.parser';
import { WEEK_LOG_REPOSITORY } from 'src/modules/routines/tracking/week-log/domain/interfaces/repositories/week-log.repository.interface';
import type { IWeekLogRepository } from 'src/modules/routines/tracking/week-log/domain/interfaces/repositories/week-log.repository.interface';
import { WorkoutSessionService } from 'src/modules/routines/tracking/workout-session/workout-session.service';
import { RoutineDay as RoutineDaySchema, RoutineDayDocument } from 'src/modules/routines/templates/routine-day/schema/routine-day.schema';
import { RoutinePlan as RoutinePlanSchemaClass } from 'src/modules/routines/templates/routine-plan/schema/routine-plan.schema';
import { ExerciseCategory } from 'src/modules/routines/templates/exercise/entities/exercise.entity';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { serializeMongo } from 'src/common/utils/mongo.utils';
import { ConfirmPlanOutput } from './entities/confirm-plan.output.entity';

const FALLBACK_DAY_TYPE = ExerciseCategory.CORE;

@Injectable()
export class ConfirmPlanService {
  private readonly logger = new Logger(ConfirmPlanService.name);

  constructor(
    @InjectModel(TrainingPlan.name)
    private readonly trainingPlanModel: Model<TrainingPlan>,
    private readonly materializer: PlanMaterializerService,
    private readonly parser: PlanGeneratorParser,
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
    private readonly workoutSessionService: WorkoutSessionService,
    @InjectModel(RoutineDaySchema.name)
    private readonly routineDayModel: Model<RoutineDayDocument>,
    @InjectModel(RoutinePlanSchemaClass.name)
    private readonly routinePlanModel: Model<RoutinePlanSchemaClass>,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  /**
   * Confirma un plan generado con IA ejecutando la acción elegida.
   *
   * - create_week_log: crea la semana de tracking (solo si NO hay semana activa).
   * - create_routine_plan: crea el template RoutinePlan + RoutineDays (sin pesos).
   * - adapt_active_week: reservado (aún no implementado).
   */
  async confirm(
    userId: string,
    id: string,
    action: PlanConfirmationAction,
  ): Promise<ConfirmPlanOutput> {
    const startedAt = Date.now();
    try {
      const result = await this.doConfirm(userId, id, action);
      this.auditLogsService.logAsync({
        action: 'TRAINING_PLAN_CONFIRMED',
        entity: 'TrainingPlan',
        userId,
        success: true,
        metadata: { planId: id, confirmationAction: action, durationMs: Date.now() - startedAt },
      });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.auditLogsService.logAsync({
        action: 'TRAINING_PLAN_CONFIRMED',
        entity: 'TrainingPlan',
        userId,
        success: false,
        errorMessage: message,
        metadata: { planId: id, confirmationAction: action, durationMs: Date.now() - startedAt },
      });
      throw error;
    }
  }

  private async doConfirm(
    userId: string,
    id: string,
    action: PlanConfirmationAction,
  ): Promise<ConfirmPlanOutput> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Training plan not found');
    }

    const plan = await this.trainingPlanModel
      .findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) })
      .exec();
    if (!plan) throw new NotFoundException('Training plan not found');
    if (plan.confirmed) {
      throw new ConflictException('El plan ya fue confirmado');
    }

    switch (action) {
      case PlanConfirmationAction.CREATE_WEEK_LOG:
        return this.confirmAsWeekLog(plan, userId, action);
      case PlanConfirmationAction.CREATE_ROUTINE_PLAN:
        return this.confirmAsRoutinePlan(plan, userId, action);
      case PlanConfirmationAction.ADAPT_ACTIVE_WEEK:
      default:
        throw new NotImplementedException(
          'La adaptación de la semana activa aún no está disponible',
        );
    }
  }

  // ── Acción: crear WeekLog (my-week) ──────────────────────────────────────

  private async confirmAsWeekLog(
    plan: TrainingPlan,
    userId: string,
    action: PlanConfirmationAction,
  ): Promise<ConfirmPlanOutput> {
    const activeWeek = await this.weekLogRepository.findActive(userId);
    if (activeWeek) {
      throw new ConflictException(
        'Ya tienes una semana activa; solo puedes generar una semana desde el plan cuando no hay ninguna activa',
      );
    }

    const parsedPlan = this.parseSnapshot(plan);

    // Materializa la semana con startDate = hoy y resuelve los ejercicios
    // contra el catálogo vigente en el momento de confirmar.
    const { weekLog, sessions } = await this.materializer.materializeWeekLog(
      userId,
      parsedPlan,
    );

    if (sessions.length > 0) {
      await this.workoutSessionService.insertMany(sessions);
    }
    const created = await this.weekLogRepository.create(weekLog);

    const updated = await this.markConfirmed(plan, userId, action, {
      resultingWeekLogId: created.id,
    });

    return { trainingPlan: updated, weekLog: created, routinePlan: null };
  }

  // ── Acción: crear RoutinePlan (template sin pesos) ───────────────────────

  private async confirmAsRoutinePlan(
    plan: TrainingPlan,
    userId: string,
    action: PlanConfirmationAction,
  ): Promise<ConfirmPlanOutput> {
    const parsedPlan = this.parseSnapshot(plan);
    const metadataById =
      await this.materializer.resolveAgainstCatalog(userId, parsedPlan);

    const daysToInsert = parsedPlan.days
      .filter((day) => !day.isRest && day.exercises.length > 0)
      .map((day) => ({
        title: day.focus ? capitalize(day.focus) : `Día ${day.order}`,
        type: this.resolveDayTypes(day.exercises, metadataById),
        exercises: day.exercises.map((exercise, index) => ({
          exercise: new Types.ObjectId(exercise.exerciseId),
          order: index,
        })),
      }));

    if (daysToInsert.length === 0) {
      throw new BadRequestException(
        'El plan no contiene días de entrenamiento para generar una rutina',
      );
    }

    const insertedDays = await this.routineDayModel.insertMany(daysToInsert);

    // Reconstruye la semana de 7 días respetando el orden del plan; los
    // días insertados están alineados con el orden de filtrado anterior.
    let dayIndex = 0;
    const week = parsedPlan.days.map((day, order) => {
      if (day.isRest || day.exercises.length === 0) {
        return { day: null, isRest: true, order };
      }
      return { day: insertedDays[dayIndex++]._id, isRest: false, order };
    });

    const routinePlan = await this.routinePlanModel.create({
      name: plan.title,
      description:
        plan.description || `Rutina generada con IA (${plan.focus})`,
      weekly_distribution: `${parsedPlan.daysPerWeek} días/semana`,
      week,
      createdBy: new Types.ObjectId(userId),
      isAiGenerated: true,
      generatedFromPlanId: plan._id,
    });

    // Back-link RoutineDay → RoutinePlan (como hacen las rutinas manuales)
    const linkedDayIds = week.filter((w) => w.day).map((w) => w.day!);
    if (linkedDayIds.length > 0) {
      await this.routineDayModel
        .updateMany({ _id: { $in: linkedDayIds } }, { planId: routinePlan._id })
        .exec();
    }

    const updated = await this.markConfirmed(plan, userId, action, {
      resultingRoutinePlanId: routinePlan._id.toString(),
    });

    return {
      trainingPlan: updated,
      weekLog: null,
      routinePlan: serializeMongo(routinePlan),
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Recupera el ParsedPlan desde el snapshot de IA persistido.
   * Re-valida la estructura (7 días, ejercicios con nombre) por si el
   * documento estuviera corrupto.
   */
  private parseSnapshot(plan: TrainingPlan): ParsedPlan {
    const rawResponse = plan.aiSnapshot?.rawResponse;
    if (!rawResponse) {
      throw new ConflictException(
        'El plan no tiene snapshot de IA para materializar',
      );
    }
    return this.parser.parseWithRawJson(JSON.stringify(rawResponse)).plan;
  }

  /**
   * Categorías únicas de los ejercicios del día para RoutineDay.type.
   * Fallback a CORE si ningún ejercicio resolvió categoría (dato inválido).
   */
  private resolveDayTypes(
    exercises: Array<{ exerciseId: string }>,
    metadataById: Map<string, { name: string; category: string }>,
  ): ExerciseCategory[] {
    const types = new Set<string>();
    for (const exercise of exercises) {
      const category = metadataById.get(String(exercise.exerciseId))?.category;
      if (category) types.add(category);
    }
    if (types.size === 0) return [FALLBACK_DAY_TYPE];
    return [...types] as ExerciseCategory[];
  }

  /**
   * Marca el plan como confirmado de forma atómica: la condición
   * confirmed:false cierra la carrera de doble confirmación.
   */
  private async markConfirmed(
    plan: TrainingPlan,
    userId: string,
    action: PlanConfirmationAction,
    link: { resultingWeekLogId?: string; resultingRoutinePlanId?: string },
  ) {
    const updated = await this.trainingPlanModel
      .findOneAndUpdate(
        {
          _id: plan._id,
          userId: new Types.ObjectId(userId),
          confirmed: false,
        },
        {
          $set: {
            confirmed: true,
            status: PlanStatus.ACTIVE,
            confirmedAction: action,
            ...link,
          },
        },
        { new: true },
      )
      .exec();
    if (!updated) {
      throw new ConflictException('El plan ya fue confirmado');
    }
    updated.focus = normalizePlanFocus(updated.focus as string);
    return updated;
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
