import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { Schedule } from '../entities/schedule.entity';
import { UpdateScheduleInput } from './dto/update-schedule.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => Schedule)
@UseGuards(GqlAuthGuard)
export class ScheduleResolver {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Mutation(() => Schedule)
  updateUserSchedule(
    @Args('input') input: UpdateScheduleInput,
    @Context() context,
  ) {
    return this.scheduleService.updateSchedule(
      extractUserId(context),
      input,
    );
  }

  @Query(() => Schedule, { nullable: true })
  userSchedule(@Context() context) {
    return this.scheduleService.findSchedule(extractUserId(context));
  }
}
