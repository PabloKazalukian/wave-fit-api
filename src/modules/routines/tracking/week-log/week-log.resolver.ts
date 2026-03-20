import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { WeekLogService } from './week-log.service';
import { ActiveWeekLogResponse, WeekLog } from './entities/week-log.entity';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import {
  UpdateWeekLogDayInput,
  UpdateWeekLogInput,
} from './dto/update-week-log.input';
import {
  BadRequestException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { GqlAuthGuard } from '../../../../modules/auth/guards/gql-auth.guard';
import { Types } from 'mongoose';

@Resolver(() => WeekLog)
@UseGuards(GqlAuthGuard)
export class WeekLogResolver {
  constructor(private readonly weekLogService: WeekLogService) {}

  @Mutation(() => WeekLog)
  async createWeekLog(
    @Args('createWeekLogInput') createWeekLogInput: CreateWeekLogInput,
    @Context() context,
  ) {
    // const userId = context.req.user.id;
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }

    return this.weekLogService.create(
      createWeekLogInput,
      context?.req?.user?.id,
    );
  }

  @Query(() => [WeekLog], { name: 'findAll' })
  async findAll(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }

    return this.weekLogService.findAllByUser(context?.req?.user?.id);
  }

  @Query(() => WeekLog, { name: 'findOne' })
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.findOne(id, context?.req?.user?.id);
  }

  @Query(() => ActiveWeekLogResponse, { name: 'activeWeekLog' })
  async findActiveWeekLog(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }

    const week = await this.weekLogService.findActiveWeekLog(
      context?.req?.user?.id,
    );

    if (!week) {
      return { hasActiveWeek: false };
    }

    return { hasActiveWeek: true, week };
  }

  @Query(() => WeekLog, { name: 'currentWorkoutSession' })
  async getCurrentWorkoutSession(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.findActiveWeekLog(context?.req?.user?.id);
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
}
