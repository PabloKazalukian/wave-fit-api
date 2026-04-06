import { Inject, Injectable, ForbiddenException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { differenceInDays } from 'date-fns';
import type { IWeekLogRepository } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { WEEK_LOG_REPOSITORY } from '../../domain/interfaces/repositories/week-log.repository.interface';
import { CreateWeekLogInput } from '../../presentation/dto/create-week-log.input';
import { WeekLogDomain } from '../../domain/entities/week-log.domain';
import { WeekLogValidator } from '../validators/week-log.validator';
import { RoutinePlanService } from 'src/modules/routines/templates/routine-plan/routine-plan.service';
import { InjectModel } from '@nestjs/mongoose';
import { WorkoutSession } from '../../../workout-session/schema/workout-session.schema';

@Injectable()
export class CreateWeekLogUseCase {
  constructor(
    @Inject(WEEK_LOG_REPOSITORY)
    private readonly weekLogRepository: IWeekLogRepository,
    private readonly validator: WeekLogValidator,
    private routinePlanService: RoutinePlanService,
    @InjectModel(WorkoutSession.name)
    private workoutSessionModel: Model<WorkoutSession>,
  ) {}

  async execute(
    input: CreateWeekLogInput,
    userId: string,
  ): Promise<WeekLogDomain | null> {
    const { startDate, endDate, planId } = input;

    await this.validator.validateCreation(input, new Types.ObjectId(userId));

    // 1. Validation (Business Rules)
    if (differenceInDays(endDate, startDate) !== 6) {
      throw new ForbiddenException('Week must be exactly 7 days');
    }

    // 2. Fetch Plan if necessary
    let plan: any = null;
    if (planId) {
      plan = await this.routinePlanService.findOneWithDays(planId);
      console.log('plan', plan, planId);
    }

    // 3. Domain Logic: Create the initial structure
    const weekLogId = new Types.ObjectId().toString();
    const { weekLog, sessions } = WeekLogDomain.createFromPlan(
      userId,
      weekLogId,
      startDate,
      endDate,
      planId || null,
      plan,
    );

    if (sessions.length > 0) {
      await this.workoutSessionModel.insertMany(sessions);
    }

    // 4. Persistence
    const newWeekLog = await this.weekLogRepository.create(weekLog);

    // 5. Return the created week log (populated)
    const result = await this.weekLogRepository.findOne(newWeekLog.id, userId);
    return result;
  }
}
