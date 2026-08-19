import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
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
import { EventEmitter2 } from '@nestjs/event-emitter';

@Resolver(() => WorkoutSession)
@UseGuards(GqlAuthGuard)
@UseInterceptors(AuditInterceptor)
export class WorkoutSessionResolver {
  constructor(
    private readonly workoutSessionService: WorkoutSessionService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Mutation(() => WorkoutSession)
  @Audit('CREATE_WORKOUT_SESSION', 'WeeklyRoutine')
  async createWorkoutSession(
    @Args('createWorkoutSessionInput')
    createWorkoutSessionInput: CreateWorkoutSessionInput,
    @Context() context,
  ) {
    const result = await this.workoutSessionService.create(
      createWorkoutSessionInput,
      context?.req?.user?.id,
    );

    this.eventEmitter.emit('workout-session.saved', {
      userId: context?.req?.user?.id,
      triggerType: 'WORKOUT_SESSION',
      entityId: result._id.toString(),
    });

    return result;
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

  @Query(() => WorkoutSession, { name: 'workoutSessionByDate', nullable: true })
  findByDate(
    @Args('date', { type: () => String }) date: string,
    @Context() context,
  ) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.workoutSessionService.findByDate(date, context?.req?.user?.id);
  }

  @Mutation(() => WorkoutSession)
  @Audit('UPDATE_WORKOUT_SESSION', 'Tracking')
  async updateWorkoutSession(
    @Args('updateWorkoutSessionInput')
    updateWorkoutSessionInput: UpdateWorkoutSessionInput,
    @Context() context,
  ) {
    const id = updateWorkoutSessionInput.id;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid workout session id');
    }

    const result = await this.workoutSessionService.update(
      id,
      updateWorkoutSessionInput,
      context?.req?.user?.id,
    );

    this.eventEmitter.emit('workout-session.saved', {
      userId: context?.req?.user?.id,
      triggerType: 'WORKOUT_SESSION',
      entityId: id,
    });

    return result;
  }

  @Mutation(() => WorkoutSession)
  @Audit('DELETE_WORKOUT_SESSION', 'Tracking')
  removeWorkoutSession(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.workoutSessionService.remove(id, context?.req?.user?.id);
  }
}
