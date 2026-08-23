import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  HttpException,
  Logger,
} from '@nestjs/common';
import { UserProfileService } from 'src/modules/user/user-profile';
import { buildUserContextForAI } from 'src/modules/user/user-profile/user-profile.utils';
import { Goal } from '../entities/goal.entity';
import { Model } from 'mongoose';
import { AiService } from 'src/modules/ai/ai.service';
import { AI_CAUSE } from 'src/modules/ai/ai-error-causes';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { InjectModel } from '@nestjs/mongoose';
import { PlanValidatorService } from '../plan-validator/plan-validator.service';
import { buildPlanPrompts } from './plan-generator.prompt';
import { PlanGeneratorParser, ParsedPlan } from './plan-generator.parser';
import { PlanFocus } from '../schema/training-plan.schema';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import {
  WeekLogDomain,
  WeekLogDayDomain,
  WorkoutSessionCreationData,
} from 'src/modules/routines/tracking/week-log/domain/entities/week-log.domain';
import {
  todayInTimezone,
  addDaysToLocalDate,
  localDateToUtc,
  LocalDate,
} from 'src/common/utils/date.utils';
import { normalizeString } from 'src/common/utils/string.utils';
import { randomBytes } from 'crypto';

const DEFAULT_TIMEZONE = 'America/Argentina/Buenos_Aires';

export interface GeneratePlanResult {
  weekLog: WeekLogDomain;
  sessions: WorkoutSessionCreationData[];
  goalId: string;
  userProfileId: string;
  aiSnapshot: {
    contextSentToAI: Record<string, any>;
    promptUsed: string;
    modelUsed: string;
    rawResponse: Record<string, any>;
    tokensUsed?: number;
  };
  metadata: {
    title: string;
    focus: PlanFocus;
    durationWeeks: number;
    daysPerWeek: number;
  };
}

interface GenerationInFlight {
  comment: string;
  promise: Promise<GeneratePlanResult>;
}

@Injectable()
export class PlanGeneratorService {
  /**
   * Lock en memoria por userId: deduplica generaciones concurrentes.
   * Válido para deploy single-node (no hay store distribuido en el proyecto).
   */
  private readonly inFlight = new Map<string, GenerationInFlight>();
  private readonly logger = new Logger(PlanGeneratorService.name);

  constructor(
    private readonly userProfileService: UserProfileService,
    @InjectModel(Goal.name)
    private readonly goalModel: Model<Goal>,
    private readonly aiService: AiService,
    private readonly planValidator: PlanValidatorService,
    private readonly parser: PlanGeneratorParser,
    private readonly exerciseService: ExerciseService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async generatePlan(
    userId: string,
    comment: string = '',
  ): Promise<GeneratePlanResult> {
    const current = this.inFlight.get(userId);
    if (current) {
      if (current.comment === comment) {
        return current.promise;
      }
      throw new ConflictException(
        'Ya hay una generación de plan en curso para este usuario',
      );
    }

    let entry: GenerationInFlight | undefined;
    const promise = (async () => {
      try {
        return await this.doGenerate(userId, comment);
      } finally {
        if (this.inFlight.get(userId) === entry) {
          this.inFlight.delete(userId);
        }
      }
    })();
    entry = { comment, promise };
    // Registro sincrónico antes del primer await del cuerpo: cierra la brecha
    // check-then-act entre dos invocaciones que llegan en el mismo tick.
    this.inFlight.set(userId, entry);

    return promise;
  }

  private async doGenerate(
    userId: string,
    comment: string = '',
  ): Promise<GeneratePlanResult> {
    const startedAt = Date.now();
    try {
      const validation = await this.planValidator.validate(userId);

      if (!validation.valid) {
        throw new BadRequestException({
          message: `Faltan datos obligatorios para generar el plan: [${validation.missing.join(', ')}]`,
          missing: validation.missing,
          recommended: validation.recommended,
        });
      }

      const profile =
        await this.userProfileService.getFullProfileContext(userId);
      if (!profile.profile)
        throw new NotFoundException('User profile not found');

      const aiContext = buildUserContextForAI(profile);

      const goal = await this.goalModel.create({
        userId,
        contextSnapshot: aiContext,
        capturedAt: new Date(),
      });

      const exercises = await this.exerciseService.findAll();
      // Catálogo por nombre único (normalizado): a la IA solo se le envían
      // los nombres (sin ids ni categorías) para ahorrar tokens; los ids
      // se resuelven contra la DB después de parsear la respuesta.
      const catalogByName = this.buildCatalogByName(userId, exercises);

      const { systemPrompt, userPrompt } = buildPlanPrompts(
        aiContext,
        [...catalogByName.values()].map((e) => e.name),
        comment,
      );

      const providerTarget = process.env.PREFERRED_AI_PROVIDER || 'groq';

      const { rawContent, modelUsed, promptUsed, tokensUsed } =
        await this.aiService.executePrompt({
          providerName: providerTarget,
          systemPrompt,
          userPrompt,
          userId,
        });

      const { plan: parsedPlan, rawJson } =
        this.parser.parseWithRawJson(rawContent);

      // Resolución de exerciseId contra el catálogo real buscando por nombre
      // (falla rápido antes de crear WeekLog/sesiones con ejercicios rotos).
      this.resolveExercisesByName(userId, parsedPlan, catalogByName);

      const result = this.buildWeekLogFromPlan(userId, parsedPlan);

      const focus = this.resolveFocus(parsedPlan.focus, aiContext);
      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `[generatePlan] OK userId=${userId} durationMs=${durationMs} title="${parsedPlan.title}" focus=${focus} tokensUsed=${tokensUsed ?? 0}`,
      );
      this.auditLogsService.logAsync({
        action: 'TRAINING_PLAN_GENERATED',
        entity: 'TrainingPlan',
        userId,
        success: true,
        metadata: {
          title: parsedPlan.title,
          focus,
          durationWeeks: parsedPlan.durationWeeks,
          daysPerWeek: parsedPlan.daysPerWeek,
          tokensUsed,
          durationMs,
        },
      });

      return {
        ...result,
        goalId: goal._id.toString(),
        userProfileId: profile.profile._id.toString(),
        aiSnapshot: {
          contextSentToAI: aiContext,
          promptUsed,
          modelUsed,
          rawResponse: rawJson,
          tokensUsed,
        },
        metadata: {
          title: parsedPlan.title,
          focus,
          durationWeeks: parsedPlan.durationWeeks,
          daysPerWeek: parsedPlan.daysPerWeek,
        },
      };
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);

      let cause: string | undefined;
      if (error instanceof HttpException) {
        const response = error.getResponse();
        if (typeof response === 'object' && response !== null) {
          cause = (response as Record<string, any>).code;
        }
      }

      this.logger.error(
        `[generatePlan] FALLO userId=${userId}${cause ? ` causa=${cause}` : ''} durationMs=${durationMs}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.auditLogsService.logAsync({
        action: 'TRAINING_PLAN_GENERATED',
        entity: 'TrainingPlan',
        userId,
        success: false,
        errorMessage: message,
        metadata: { ...(cause && { cause }), durationMs },
      });

      throw error;
    }
  }

  /**
   * Indexa el catálogo por nombre normalizado (único). Si dos ejercicios
   * colisionan tras normalizar, gana el primero y se advierte en el log:
   * es un problema de datos del catálogo, no de la generación.
   */
  private buildCatalogByName(
    userId: string,
    catalog: Array<{ id: unknown; name: string }>,
  ): Map<string, { id: unknown; name: string }> {
    const byName = new Map<string, { id: unknown; name: string }>();

    for (const exercise of catalog) {
      const key = normalizeString(exercise.name);
      if (!key) continue;
      if (byName.has(key)) {
        this.logger.warn(
          `[generatePlan] Catálogo con nombres duplicados userId=${userId}: "${exercise.name}" colisiona con "${byName.get(key)!.name}"; se ignora el duplicado`,
        );
        continue;
      }
      byName.set(key, { id: exercise.id, name: exercise.name });
    }

    return byName;
  }

  /**
   * Resuelve el exerciseId de cada ejercicio del plan buscando su name en el
   * catálogo real (comparación por nombre normalizado). Muta el plan in-place.
   */
  private resolveExercisesByName(
    userId: string,
    plan: ParsedPlan,
    catalogByName: Map<string, { id: unknown; name: string }>,
  ): void {
    const invalidNames = new Set<string>();

    for (const day of plan.days) {
      if (day.isRest) continue;
      for (const ex of day.exercises) {
        const match = catalogByName.get(normalizeString(ex.name));
        if (!match) {
          invalidNames.add(ex.name);
          continue;
        }
        ex.exerciseId = String(match.id);
        ex.name = match.name;
      }
    }

    if (invalidNames.size === 0) return;

    const list = [...invalidNames];
    this.logger.error(
      `${AI_CAUSE.UNKNOWN_EXERCISE_NAME}: la IA devolvió ${list.length} nombres fuera del catálogo: [${list.join(', ')}]`,
    );
    throw new BadRequestException({
      message: `La IA devolvió ejercicios que no existen en el catálogo: [${list.join(', ')}]`,
      code: AI_CAUSE.UNKNOWN_EXERCISE_NAME,
      invalidExerciseNames: list,
    });
  }

  private resolveFocus(
    rawFocus: string,
    aiContext: Record<string, any>,
  ): PlanFocus {
    if (Object.values(PlanFocus).includes(rawFocus as PlanFocus)) {
      return rawFocus as PlanFocus;
    }
    const primaryGoal = aiContext?.goal?.primary as PlanFocus;
    if (Object.values(PlanFocus).includes(primaryGoal)) {
      return primaryGoal;
    }
    return PlanFocus.MAINTENANCE;
  }

  private buildWeekLogFromPlan(
    userId: string,
    plan: ParsedPlan,
  ): { weekLog: WeekLogDomain; sessions: WorkoutSessionCreationData[] } {
    const startDate: LocalDate = todayInTimezone(DEFAULT_TIMEZONE);
    const endDate: LocalDate = addDaysToLocalDate(startDate, 6);
    const weekLogId = randomBytes(12).toString('hex');

    const sessionsToInsert: WorkoutSessionCreationData[] = [];

    const days: WeekLogDayDomain[] = plan.days.map((day, index) => {
      const dayLocalDate: LocalDate = addDaysToLocalDate(startDate, index);
      const dayUtcDate: Date = localDateToUtc(dayLocalDate, DEFAULT_TIMEZONE);

      let workoutSessionId: string | null = null;
      let exercises: any[] = [];

      if (!day.isRest && day.exercises.length > 0) {
        const sessionId = randomBytes(12).toString('hex');
        workoutSessionId = sessionId;

        exercises = day.exercises.map((e) => ({
          exerciseId: e.exerciseId,
          series: 0,
          sets: [],
        }));

        sessionsToInsert.push({
          _id: sessionId,
          userId,
          weekLogId,
          date: dayUtcDate,
          exercises: day.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            series: 0,
            sets: [],
          })),
          status: 'not_started',
        });
      }

      return new WeekLogDayDomain(
        day.order,
        dayUtcDate,
        day.isRest,
        workoutSessionId,
        [],
        'pending',
        exercises,
      );
    });

    const weekLog = new WeekLogDomain(
      weekLogId,
      userId,
      localDateToUtc(startDate, DEFAULT_TIMEZONE),
      localDateToUtc(endDate, DEFAULT_TIMEZONE),
      null,
      days,
      false,
      true,
    );

    return { weekLog, sessions: sessionsToInsert };
  }
}
