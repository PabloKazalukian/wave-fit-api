import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WeekLog } from '../week-log/schema/week-log.schema';
import { ExercisePerformance } from './schema/exercise-performance.schema';
import { WorkoutSession } from './schema/workout-session.schema';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { Model, Types } from 'mongoose';

@Injectable()
export class WorkoutSessionValidator {
  async validateCreation(
    input: CreateWorkoutSessionInput,
    userId: string,
    weekLog: WeekLog,
    sessionModel: Model<WorkoutSession>,
  ) {
    this.validateOwnership(weekLog, userId);
    this.validateDateInsideWeek(input.date, weekLog);
    // await this.validateNoDuplicate(
    //   input.weekLogId,
    //   userId,
    //   input.date,
    //   sessionModel,
    // );
    this.validateExercises(input.exercises);
  }

  private validateOwnership(weekLog: WeekLog, userId: string) {
    if (weekLog.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to add sessions to this WeekLog',
      );
    }
  }

  private validateDateInsideWeek(date: Date | string, weekLog: WeekLog) {
    const sessionDate = new Date(date);

    if (sessionDate < weekLog.startDate || sessionDate > weekLog.endDate) {
      throw new BadRequestException(
        'Session date must be within the WeekLog date range',
      );
    }
  }

  private async validateNoDuplicate(
    weekLogId: string,
    userId: string,
    date: Date | string,
    sessionModel: Model<WorkoutSession>,
  ) {
    const existing = await sessionModel.findOne({
      userId: new Types.ObjectId(userId),
      weekLogId: new Types.ObjectId(weekLogId),
      date: new Date(date),
    });

    if (existing) {
      throw new BadRequestException(
        'A workout session already exists for this date',
      );
    }
  }

  private validateExercises(exercises: ExercisePerformance[]) {
    for (const exercise of exercises) {
      if (exercise.series !== exercise.sets.length) {
        throw new BadRequestException(
          `Exercise ${exercise.exerciseId}: series must match sets length`,
        );
      }
    }
  }
}
