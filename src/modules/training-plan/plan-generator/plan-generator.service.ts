import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserProfileService } from 'src/modules/user/user-profile';
import { buildUserContextForAI } from 'src/modules/user/user-profile/user-profile.utils';
import { Goal } from '../entities/goal.entity';
import { Model } from 'mongoose';
import { AiService } from 'src/modules/ai/ai.service';
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

@Injectable()
export class PlanGeneratorService {
  constructor(
    private readonly userProfileService: UserProfileService,
    @InjectModel(Goal.name)
    private readonly goalModel: Model<Goal>,
    private readonly aiService: AiService,
    private readonly planValidator: PlanValidatorService,
    private readonly parser: PlanGeneratorParser,
    private readonly exerciseService: ExerciseService,
  ) {}

  async generatePlan(userId: string, comment: string = ''): Promise<GeneratePlanResult> {
    const validation = await this.planValidator.validate(userId);
    if (!validation.valid) {
      throw new BadRequestException({
        message: `Faltan datos obligatorios para generar el plan: [${validation.missing.join(', ')}]`,
        missing: validation.missing,
        recommended: validation.recommended,
      });
    }

    const profile = await this.userProfileService.getFullProfileContext(userId);
    if (!profile.profile) throw new NotFoundException('User profile not found');

    const aiContext = buildUserContextForAI(profile);

    const goal = await this.goalModel.create({
      userId,
      contextSnapshot: aiContext,
      capturedAt: new Date(),
    });

    const exercises = await this.exerciseService.findAll();
    const exercisesForAI = exercises.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
    }));

    const { systemPrompt, userPrompt } = buildPlanPrompts(
      aiContext,
      exercisesForAI,
      comment,
    );

    const providerTarget = process.env.PREFERRED_AI_PROVIDER || 'groq';

    const { rawContent, modelUsed, promptUsed, tokensUsed } =
      await this.aiService.executePrompt({
        providerName: providerTarget,
        systemPrompt,
        userPrompt,
      });

    const parsedPlan = this.parser.parse(rawContent);

    const result = this.buildWeekLogFromPlan(userId, parsedPlan);

    return {
      ...result,
      goalId: goal._id.toString(),
      userProfileId: profile.profile._id.toString(),
      aiSnapshot: {
        contextSentToAI: aiContext,
        promptUsed,
        modelUsed,
        rawResponse: JSON.parse(rawContent),
        tokensUsed,
      },
      metadata: {
        title: parsedPlan.title,
        focus: this.resolveFocus(parsedPlan.focus, aiContext),
        durationWeeks: parsedPlan.durationWeeks,
        daysPerWeek: parsedPlan.daysPerWeek,
      },
    };
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
