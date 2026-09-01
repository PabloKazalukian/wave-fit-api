import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { UserProfileService } from 'src/modules/user/user-profile';
import { buildUserContextForAI } from 'src/modules/user/user-profile/user-profile.utils';
import { AiService } from 'src/modules/ai/ai.service';
import { AuditLogsService } from 'src/modules/audit-logs/audit-logs.service';
import { PlanValidatorService } from '../plan-validator/plan-validator.service';
import { PlanGeneratorParser } from '../plan-generator/plan-generator.parser';
import { buildModifyPlanPrompts } from './plan-modifier.prompt';
import { PlanFocus } from '../schema/training-plan.schema';
import { ExerciseService } from 'src/modules/routines/templates/exercise/exercise.service';
import { PlanMaterializerService } from '../plan-materializer/plan-materializer.service';
import { Goal } from '../entities/goal.entity';
import { TrainingPlan } from '../schema/training-plan.schema';
import type { GeneratePlanResult } from '../plan-generator/plan-generator.service';

interface ModificationInFlight {
  comment: string;
  promise: Promise<GeneratePlanResult>;
}

@Injectable()
export class PlanModifierService {
  /**
   * Lock en memoria por userId: deduplica modificaciones concurrentes.
   * Mismo patrón que PlanGeneratorService (single-node).
   */
  private readonly inFlight = new Map<string, ModificationInFlight>();
  private readonly logger = new Logger(PlanModifierService.name);

  constructor(
    private readonly userProfileService: UserProfileService,
    @InjectModel(Goal.name)
    private readonly goalModel: Model<Goal>,
    private readonly aiService: AiService,
    private readonly planValidator: PlanValidatorService,
    private readonly parser: PlanGeneratorParser,
    private readonly exerciseService: ExerciseService,
    private readonly auditLogsService: AuditLogsService,
    private readonly materializer: PlanMaterializerService,
  ) {}

  /**
   * Modifica un plan vigente: reenvía a la IA el plan actual + el contexto del
   * usuario + el comentario de cambio, y devuelve el nuevo resultado listo para
   * sobrescribir lo que haya en `aiSnapshot`/metadatos del mismo documento.
   */
  async modifyPlan(
    userId: string,
    plan: TrainingPlan,
    comment: string,
  ): Promise<GeneratePlanResult> {
    const current = this.inFlight.get(userId);
    if (current) {
      if (current.comment === comment) {
        return current.promise;
      }
      throw new ConflictException(
        'Ya hay una modificación de plan en curso para este usuario',
      );
    }

    let entry: ModificationInFlight | undefined;
    const promise = (async () => {
      try {
        return await this.doModify(userId, plan, comment);
      } finally {
        if (this.inFlight.get(userId) === entry) {
          this.inFlight.delete(userId);
        }
      }
    })();
    entry = { comment, promise };
    this.inFlight.set(userId, entry);

    return promise;
  }

  private async doModify(
    userId: string,
    plan: TrainingPlan,
    comment: string,
  ): Promise<GeneratePlanResult> {
    const startedAt = Date.now();
    try {
      const validation = await this.planValidator.validate(userId);

      if (!validation.valid) {
        throw new BadRequestException({
          message: `Faltan datos obligatorios para modificar el plan: [${validation.missing.join(', ')}]`,
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
      const exerciseNames = this.materializer.buildUniqueCatalogNames(
        userId,
        exercises,
      );

      const snapshot = plan.aiSnapshot?.rawResponse;
      if (!snapshot) {
        throw new ConflictException(
          'El plan no tiene snapshot de IA para modificar',
        );
      }
      const currentPlan = this.parser.parseWithRawJson(
        JSON.stringify(snapshot),
      ).plan;

      const { systemPrompt, userPrompt } = buildModifyPlanPrompts(
        aiContext,
        exerciseNames,
        currentPlan as unknown as Record<string, any>,
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

      const result = await this.materializer.materializeWeekLog(
        userId,
        parsedPlan,
      );

      const focus = this.resolveFocus(parsedPlan.focus, aiContext);
      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `[modifyPlan] OK userId=${userId} planId=${plan._id} durationMs=${durationMs} title="${parsedPlan.title}" focus=${focus} tokensUsed=${tokensUsed ?? 0}`,
      );
      this.auditLogsService.logAsync({
        action: 'TRAINING_PLAN_MODIFIED',
        entity: 'TrainingPlan',
        userId,
        success: true,
        metadata: {
          planId: plan._id,
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
        `[modifyPlan] FALLO userId=${userId} planId=${plan._id}${cause ? ` causa=${cause}` : ''} durationMs=${durationMs}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.auditLogsService.logAsync({
        action: 'TRAINING_PLAN_MODIFIED',
        entity: 'TrainingPlan',
        userId,
        success: false,
        errorMessage: message,
        metadata: { ...(plan && { planId: plan._id }), ...(cause && { cause }), durationMs },
      });

      throw error;
    }
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
}
