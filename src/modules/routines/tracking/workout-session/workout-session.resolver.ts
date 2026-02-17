import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutSession } from './entities/workout-session.entity';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import {
  BadRequestException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';

@Resolver(() => WorkoutSession)
@UseGuards(GqlAuthGuard)
@UseInterceptors(AuditInterceptor)
export class WorkoutSessionResolver {
  constructor(private readonly workoutSessionService: WorkoutSessionService) {}

  @Mutation(() => WorkoutSession)
  @Audit('CREATE_WORKOUT_SESSION', 'WeeklyRoutine')
  createWorkoutSession(
    @Args('createWorkoutSessionInput')
    createWorkoutSessionInput: CreateWorkoutSessionInput,
    @Context() context,
  ) {
    return this.workoutSessionService.create(
      createWorkoutSessionInput,
      context?.req?.user?.id,
    );
  }

  @Query(() => [WorkoutSession], { name: 'workoutSession' })
  findAll(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.workoutSessionService.findAllByUser(context?.req?.user?.id);
  }

  @Query(() => WorkoutSession, { name: 'workoutSession' })
  findOne(@Args('id', { type: () => String }) id: string, @Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.workoutSessionService.findOne(id, context?.req?.user?.id);
  }

  @Mutation(() => WorkoutSession)
  updateWorkoutSession(
    @Args('updateWorkoutSessionInput')
    updateWorkoutSessionInput: UpdateWorkoutSessionInput,
  ) {
    return this.workoutSessionService.update(
      updateWorkoutSessionInput.id,
      updateWorkoutSessionInput,
    );
  }

  @Mutation(() => WorkoutSession)
  removeWorkoutSession(@Args('id', { type: () => Int }) id: string) {
    return this.workoutSessionService.remove(id);
  }
}
