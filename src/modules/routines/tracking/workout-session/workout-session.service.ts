import { Injectable } from '@nestjs/common';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';
import { WorkoutSession } from './schema/workout-session.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ExercisePerformance } from './schema/exercise-performance.schema';

@Injectable()
export class WorkoutSessionService {
  constructor(
    @InjectModel(WorkoutSession.name)
    private routinePlanModel: Model<WorkoutSession>,
    @InjectModel(ExercisePerformance.name)
    private exercisePerformanceModel: Model<ExercisePerformance>,
  ) {}
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
