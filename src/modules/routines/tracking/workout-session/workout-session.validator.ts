import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { WeekLogDomain } from '../week-log/domain/entities/week-log.domain';
import { WorkoutSession } from './schema/workout-session.schema';
import { CreateWorkoutSessionInput } from './dto/create-workout-session.input';
import { UpdateWorkoutSessionInput } from './dto/update-workout-session.input';

@Injectable()
export class WorkoutSessionValidator {
  async validateCreation(
    input: CreateWorkoutSessionInput,
    userId: string,
    weekLog: WeekLogDomain | null,
  ) {
    if (weekLog) {
      this.validateOwnership(weekLog, userId);
      this.validateDateInsideWeek(input.date, weekLog);
    }
    this.validateExercises(input.exercises);
  }

  private validateOwnership(weekLog: WeekLogDomain, userId: string) {
    if (weekLog.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to add sessions to this WeekLog',
      );
    }
  }

  private validateDateInsideWeek(date: Date | string, weekLog: WeekLogDomain) {
    const sessionDate = new Date(date);

    if (sessionDate < weekLog.startDate || sessionDate > weekLog.endDate) {
      throw new BadRequestException(
        'Session date must be within the WeekLog date range',
      );
    }
  }

  private validateExercises(exercises: { exerciseId: string; series: number; sets: any[] }[]) {
    for (const exercise of exercises) {
      if (exercise.series !== exercise.sets.length) {
        throw new BadRequestException(
          `Exercise ${exercise.exerciseId}: series must match sets length`,
        );
      }
    }
  }

  async validateUpdateWorkoutSession(
    input: UpdateWorkoutSessionInput,
    userId: string,
    existingSession: WorkoutSession,
  ) {
    if (existingSession.userId.toString() !== userId) {
      throw new ForbiddenException(
        'You do not have permission to update this workout session',
      );
    }

    if (input.exercises) {
      this.validateExercises(input.exercises as any);
    }
  }
}
