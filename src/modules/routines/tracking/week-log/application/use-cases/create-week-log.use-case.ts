import { Inject, Injectable, ForbiddenException, forwardRef } from '@nestjs/common';
import { Types } from 'mongoose';
import { differenceInLocalDays, isValidLocalDate } from 'src/common/utils/date.utils';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { CreateWeekLogInput } from '../../presentation/dto/create-week-log.input';
import { WeekLogDomain } from '../../domain/entities/week-log.domain';
import { WeekLogValidator } from '../validators/week-log.validator';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';
import { WorkoutSessionService } from '../../../workout-session/workout-session.service';

@Injectable()
export class CreateWeekLogUseCase {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
    private readonly validator: WeekLogValidator,
    private routinePlanService: RoutinePlanService,
    @Inject(forwardRef(() => WorkoutSessionService))
    private workoutSessionService: WorkoutSessionService,
  ) {}

  async execute(
    input: CreateWeekLogInput,
    userId: string,
  ): Promise<WeekLogDomain | null> {
    const { startDate, endDate, planId, timezone } = input;

    // 1. Validate LocalDate format
    if (!isValidLocalDate(startDate) || !isValidLocalDate(endDate)) {
      throw new ForbiddenException('startDate and endDate must be in yyyy-MM-dd format');
    }

    // 2. Validate week is exactly 7 days (calendar-safe — no timezone needed here)
    if (differenceInLocalDays(endDate, startDate) !== 6) {
      throw new ForbiddenException('Week must be exactly 7 days');
    }

    // 3. Validate no active week exists
    await this.validator.validateCreation(input, userId);

    // 4. Fetch Plan if necessary
    let plan: any = null;
    if (planId) {
      plan = await this.routinePlanService.findOneWithDays(planId);
    }

    // 5. Domain Logic: Create the initial structure
    const weekLogId = new Types.ObjectId().toString();
    const { weekLog, sessions } = WeekLogDomain.createFromPlan(
      userId,
      weekLogId,
      startDate,    // LocalDate "yyyy-MM-dd"
      endDate,      // LocalDate "yyyy-MM-dd"
      timezone,     // IANA timezone para convertir a UTC en el dominio
      planId || null,
      plan,
    );

    if (sessions.length > 0) {
      await this.workoutSessionService.insertMany(sessions);
    }

    // 6. Persistence
    let newWeekLog;
    try {
      newWeekLog = await this.weekLogRepository.create(weekLog);
    } catch (err) {
      console.error('DEBUG usecase create error:', err.message, err.stack?.split('\n').slice(0,5).join('\n'));
      throw err;
    }

    if (!newWeekLog) {
      console.error('DEBUG usecase create returned null');
      return null;
    }

    // 7. Return the created week log (populated)
    const result = await this.weekLogRepository.findOne(newWeekLog.id, userId);
    if (!result) {
      console.error('DEBUG usecase findOne returned null for id=%s userId=%s', newWeekLog.id, userId);
    }
    return result;
  }
}
