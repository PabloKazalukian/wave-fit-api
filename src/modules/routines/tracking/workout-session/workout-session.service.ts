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
    private sessionModel: Model<WorkoutSession>,
    @InjectModel(ExercisePerformance.name)
    private exercisePerformanceModel: Model<ExercisePerformance>,
  ) {}
  create(
    createWorkoutSessionInput: CreateWorkoutSessionInput,
  ): Promise<WorkoutSession> {
    return new this.sessionModel(createWorkoutSessionInput).save();
  }

  findAllByUser(userId: string): Promise<WorkoutSession[]> {
    return this.sessionModel.find({ userId }).populate('exercises').exec();
  }

  findOne(id: string, userId: string) {
    return this.sessionModel
      .findOne({ _id: id, userId })
      .populate('exercises')
      .exec();
  }

  update(id: string, updateWorkoutSessionInput: UpdateWorkoutSessionInput) {
    return `This action updates a #${id} workoutSession`;
  }

  remove(id: string) {
    return `This action removes a #${id} workoutSession`;
  }
}
