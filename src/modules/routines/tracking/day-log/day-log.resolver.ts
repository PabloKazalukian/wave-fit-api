import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { DayLogService } from './day-log.service';
import { DayLog } from './presentation/entities/day-log.entity';
import { CreateDayLogInput } from './presentation/dto/create-day-log.input';
import { UpdateDayLogInput } from './presentation/dto/update-day-log.input';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';
import { extractUserId } from 'src/common/utils/user-id.utils';
import { ActiveDayLogResponse } from './day-log.resolver.types';

@Resolver(() => DayLog)
@UseGuards(GqlAuthGuard)
@UseInterceptors(AuditInterceptor)
export class DayLogResolver {
  constructor(private readonly dayLogService: DayLogService) {}

  @Mutation(() => DayLog)
  @Audit('CREATE_DAY_LOG', 'DayLog')
  async createDayLog(
    @Args('createDayLogInput') createDayLogInput: CreateDayLogInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.create(createDayLogInput, userId);
  }

  @Query(() => [DayLog], { name: 'dayLogFindAll' })
  async findAll(
    @Context() context,
    @Args('limit', { type: () => Number, nullable: true, defaultValue: 5 })
    limit: number,
    @Args('offset', { type: () => Number, nullable: true, defaultValue: 0 })
    offset: number,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.findAllByUser(userId, limit, offset);
  }

  @Query(() => DayLog, { name: 'dayLogFindOne' })
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.findOne(id, userId);
  }

  @Query(() => ActiveDayLogResponse, { name: 'activeDayLog' })
  async findActiveDayLog(@Context() context) {
    const userId = extractUserId(context);
    const day = await this.dayLogService.findActiveDayLog(userId);

    if (!day) {
      return { hasActiveDay: false };
    }

    return { hasActiveDay: true, day };
  }

  @Mutation(() => DayLog)
  @Audit('UPDATE_DAY_LOG', 'DayLog')
  async updateDayLog(
    @Args('input') input: UpdateDayLogInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.update(input, userId);
  }

  @Mutation(() => DayLog, { name: 'updateDayLogStatus' })
  @Audit('UPDATE_DAY_LOG_STATUS', 'DayLog')
  async updateDayStatus(
    @Args('date', { type: () => String }) date: string,
    @Args('isRest', { type: () => Boolean }) isRest: boolean,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.updateDayStatus(date, isRest, userId);
  }

  @Mutation(() => DayLog, { name: 'assignRoutineToDayLog' })
  @Audit('ASSIGN_ROUTINE_TO_DAY', 'DayLog')
  async assignRoutineToDay(
    @Args('routineDayId', { type: () => String }) routineDayId: string,
    @Args('date', { type: () => String }) date: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.assignRoutineToDay(routineDayId, date, userId);
  }

  @Mutation(() => DayLog, { name: 'removeWorkoutSessionFromDayLog' })
  @Audit('REMOVE_WORKOUT_SESSION_FROM_DAY', 'DayLog')
  async removeWorkoutSessionFromDay(
    @Args('workoutSessionId', { type: () => String }) workoutSessionId: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.removeWorkoutSessionFromDay(
      workoutSessionId,
      userId,
    );
  }

  @Mutation(() => DayLog, { name: 'removeExtraSessionFromDayLog' })
  @Audit('REMOVE_EXTRA_SESSION_FROM_DAY', 'DayLog')
  async removeExtraSessionFromDay(
    @Args('extraSessionId', { type: () => String }) extraSessionId: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.removeExtraSessionFromDay(extraSessionId, userId);
  }

  @Mutation(() => DayLog)
  @Audit('DELETE_DAY_LOG', 'DayLog')
  async removeDayLog(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);
    return this.dayLogService.remove(id, userId);
  }
}
