import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { WeekLogService } from './week-log.service';
import {
  ActiveWeekLogResponse,
  WeekLog,
  WeekLogDay,
} from './presentation/entities/week-log.entity';
import { CreateWeekLogInput } from './presentation/dto/create-week-log.input';
import {
  UpdateWeekLogDayUnifiedInput,
  UpdateWeekLogInput,
} from './presentation/dto/update-week-log.input';
import { UpdateDayWorkoutStatusInput } from './presentation/dto/update-day-workout-status.input';
import {
  BadRequestException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../../../modules/auth/guards/gql-auth.guard';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';
import { extractUserId } from 'src/common/utils/user-id.utils';

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
    const userId = extractUserId(context);

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
    @Context() context,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 5 })
    limit: number,
    @Args('offset', { type: () => Int, nullable: true, defaultValue: 0 })
    offset: number,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.findAllByUser(userId, limit, offset);
  }

  @Query(() => WeekLog, { name: 'findOne' })
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.findOne(id, userId);
  }

  @Query(() => ActiveWeekLogResponse, { name: 'activeWeekLog' })
  async findActiveWeekLog(@Context() context) {
    const userId = extractUserId(context);

    const week = await this.weekLogService.findActiveWeekLog(userId);

    if (!week) {
      return { hasActiveWeek: false };
    }

    return { hasActiveWeek: true, week };
  }

  @Query(() => WeekLog, { name: 'currentWorkoutSession' })
  async getCurrentWorkoutSession(@Context() context) {
    const userId = extractUserId(context);

    return this.weekLogService.findActiveWeekLog(userId);
  }

  /**
   * Mutation unificada que crea/actualiza WorkoutSession y/o ExtraSession
   * en un día del WeekLog en una sola operación.
   */
  @Mutation(() => WeekLogDay)
  async updateDay(
    @Args('input') input: UpdateWeekLogDayUnifiedInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.updateDay(input, userId);
  }

  @Mutation(() => WeekLogDay)
  async updateDayWorkoutStatus(
    @Args('input') input: UpdateDayWorkoutStatusInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.updateDayWorkoutStatus(input, userId);
  }

  /**
   * Mutation general del WeekLog.
   * Actualiza metadata (notes, dates) y aplica reglas de negocio:
   * - completed=true → active=false (forzado)
   * - active=true → desactiva todos los demás WL del usuario
   * - days opcionales con la misma lógica de WS/ES que updateDay
   */
  @Mutation(() => WeekLog)
  async updateWeekLog(
    @Args('input') input: UpdateWeekLogInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.updateWeekLog(input, userId);
  }

  @Mutation(() => WeekLog)
  async syncWeekLogDays(
    @Args('weekLogId', { type: () => String }) weekLogId: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.syncDaysWithSessions(weekLogId, userId);
  }

  @Mutation(() => WeekLogDay)
  @Audit('ASSIGN_ROUTINE_TO_DAY', 'WeekLog')
  async assignRoutineToDay(
    @Args('routineDayId', { type: () => String }) routineDayId: string,
    @Args('date', { type: () => String }) date: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.assignRoutineToDay(routineDayId, date, userId);
  }

  @Mutation(() => WeekLogDay)
  async removeWorkoutSessionFromDay(
    @Args('workoutSessionId', { type: () => String }) workoutSessionId: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.removeWorkoutSessionFromDay(
      workoutSessionId,
      userId,
    );
  }

  @Mutation(() => WeekLogDay)
  async removeExtraSessionFromDay(
    @Args('date', { type: () => String }) date: string,
    @Args('extraSessionId', { type: () => String }) extraSessionId: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.removeExtraSessionFromDay(
      extraSessionId,
      userId,
      date,
    );
  }

  @Mutation(() => WeekLog)
  @Audit('DELETE_WEEK_LOG', 'Tracking')
  async removeWeekLog(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = extractUserId(context);

    return this.weekLogService.remove(id, userId);
  }
}
