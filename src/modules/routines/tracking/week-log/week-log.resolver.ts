import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { WeekLogService } from './week-log.service';
import {
  ActiveWeekLogResponse,
  WeekLog,
} from './presentation/entities/week-log.entity';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import {
  UpdateWeekLogDayInput,
  UpdateWeekLogInput,
} from './presentation/dto/update-week-log.input';
import { RemoveWorkoutSessionFromDayInput } from './presentation/dto/remove-workout-session-from-day.input';
import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../../../modules/auth/guards/gql-auth.guard';
import { Types } from 'mongoose';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';

@Resolver(() => WeekLog)
@UseGuards(GqlAuthGuard)
@UseInterceptors(AuditInterceptor)
export class WeekLogResolver {
  constructor(private readonly weekLogService: WeekLogService) {}

  @Mutation(() => WeekLog)
  async createWeekLog(
    @Args('createWeekLogInput') createWeekLogInput: CreateWeekLogInput,
    @Context() context,
  ) {
    const userId =
      context?.req?.user?._id?.toString() ||
      context?.req?.user?.id ||
      context?.req?.user?.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const createdWeekLog = await this.weekLogService.create(
      createWeekLogInput,
      userId,
    );

    if (!createdWeekLog) {
      throw new BadRequestException('Failed to create week log');
    }

    return this.weekLogService.findOne(createdWeekLog.id, userId);
  }

  @Query(() => [WeekLog], { name: 'findAll' })
  async findAll(
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 5 })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
    @Context() context,
  ) {
    const userId =
      context?.req?.user?._id?.toString() ||
      context?.req?.user?.id ||
      context?.req?.user?.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    return this.weekLogService.findAllByUser(userId, limit, offset);
  }

  @Query(() => WeekLog, { name: 'findOne' })
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId =
      context?.req?.user?._id?.toString() ||
      context?.req?.user?.id ||
      context?.req?.user?.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.findOne(id, userId);
  }

  @Query(() => ActiveWeekLogResponse, { name: 'activeWeekLog' })
  async findActiveWeekLog(@Context() context) {
    const userId =
      context?.req?.user?._id?.toString() ||
      context?.req?.user?.id ||
      context?.req?.user?.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }

    const week = await this.weekLogService.findActiveWeekLog(userId);

    if (!week) {
      return { hasActiveWeek: false };
    }

    return { hasActiveWeek: true, week };
  }

  @Query(() => WeekLog, { name: 'currentWorkoutSession' })
  async getCurrentWorkoutSession(@Context() context) {
    const userId =
      context?.req?.user?._id?.toString() ||
      context?.req?.user?.id ||
      context?.req?.user?.userId;

    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.findActiveWeekLog(userId);
  }

  @Mutation(() => WeekLog)
  async updateWeekLog(
    @Args('updateWeekLogInput') updateWeekLogInput: UpdateWeekLogInput,
    @Context() context,
  ) {
    const userId = context.req.user?.id || context.req.user?.userId;

    if (!userId) {
      throw new UnauthorizedException('User not authenticated');
    }

    if (!updateWeekLogInput.id) {
      throw new BadRequestException('Week log id is required');
    }

    return this.weekLogService.update(
      updateWeekLogInput.id,
      updateWeekLogInput,
      userId,
    );
  }

  @Mutation(() => WeekLog)
  async updateWeekLogDay(
    @Args('input') input: UpdateWeekLogDayInput,
    @Context() context,
  ) {
    const userId = context.req.user?.id;

    return this.weekLogService.updateDay(input, userId);
  }

  @Mutation(() => WeekLog)
  async syncWeekLogDays(
    @Args('weekLogId', { type: () => String }) weekLogId: string,
    @Context() context,
  ) {
    const userId = context.req.user?.id;
    return this.weekLogService.syncDaysWithSessions(weekLogId, userId);
  }

  @Mutation(() => WeekLog)
  async removeWeekLog(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.weekLogService.remove(id);
  }

  @Mutation(() => WeekLog)
  @Audit('ASSIGN_ROUTINE_TO_DAY', 'WeekLog')
  async assignRoutineToDay(
    @Args('routineDayId', { type: () => String }) routineDayId: string,
    @Args('date', { type: () => String }) date: string,
    @Context() context,
  ) {
    const userId =
      context?.req?.user?._id?.toString() ||
      context?.req?.user?.id ||
      context?.req?.user?.userId;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.assignRoutineToDay(routineDayId, date, userId);
  }

  @Mutation(() => WeekLog)
  async removeWorkoutSessionFromDay(
    @Args('input') input: RemoveWorkoutSessionFromDayInput,
    @Context() context,
  ) {
    const userId = context.req.user?.id;
    return this.weekLogService.removeWorkoutSessionFromDay(
      input.workoutSessionId,
      userId,
    );
  }
}
