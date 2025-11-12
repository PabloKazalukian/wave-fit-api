import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutSession } from './entities/workout-session.entity';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';

@Resolver(() => WorkoutSession)
export class WorkoutSessionResolver {
  constructor(private readonly workoutSessionService: WorkoutSessionService) {}

  @Mutation(() => WorkoutSession)
  createWorkoutSession(@Args('createWorkoutSessionInput') createWorkoutSessionInput: CreateWorkoutSessionInput) {
    return this.workoutSessionService.create(createWorkoutSessionInput);
  }

  @Query(() => [WorkoutSession], { name: 'workoutSession' })
  findAll() {
    return this.workoutSessionService.findAll();
  }

  @Query(() => WorkoutSession, { name: 'workoutSession' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.workoutSessionService.findOne(id);
  }

  @Mutation(() => WorkoutSession)
  updateWorkoutSession(@Args('updateWorkoutSessionInput') updateWorkoutSessionInput: UpdateWorkoutSessionInput) {
    return this.workoutSessionService.update(updateWorkoutSessionInput.id, updateWorkoutSessionInput);
  }

  @Mutation(() => WorkoutSession)
  removeWorkoutSession(@Args('id', { type: () => Int }) id: number) {
    return this.workoutSessionService.remove(id);
  }
}
