import { Injectable } from '@nestjs/common';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';

@Injectable()
export class WorkoutSessionService {
  create(createWorkoutSessionInput: CreateWorkoutSessionInput) {
    return 'This action adds a new workoutSession';
  }

  findAll() {
    return `This action returns all workoutSession`;
  }

  findOne(id: number) {
    return `This action returns a #${id} workoutSession`;
  }

  update(id: number, updateWorkoutSessionInput: UpdateWorkoutSessionInput) {
    return `This action updates a #${id} workoutSession`;
  }

  remove(id: number) {
    return `This action removes a #${id} workoutSession`;
  }
}
