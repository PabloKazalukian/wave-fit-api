import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { WeekLogService } from './week-log.service';
import { WeekLog } from './entities/week-log.entity';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';
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

  @Query(() => [WeekLog], { name: 'weekLog' })
  async findAll(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }

    return this.weekLogService.findAllByUser(context?.req?.user?.id);
  }

  @Query(() => WeekLog, { name: 'weekLog' })
  async findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.findOne(id, context?.req?.user?.id);
  }

  @Query(() => WeekLog, { name: 'activeWeekLog' })
  async findActiveWeekLog(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.weekLogService.findActiveWeekLog(context?.req?.user?.id);
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

    return this.weekLogService.update(
      updateWeekLogInput.id,
      updateWeekLogInput,
      userId,
    );
  }

  @Mutation(() => WeekLog)
  async removeWeekLog(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.weekLogService.remove(id);
  }
}
