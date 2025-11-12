import { Module } from '@nestjs/common';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutSessionResolver } from './workout-session.resolver';
import {
  WorkoutSession,
  WorkoutSessionSchema,
} from './schema/workout-session.schema';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ExercisePerformance,
  ExercisePerformanceSchema,
} from './schema/exercise-performance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WorkoutSession.name, schema: WorkoutSessionSchema },
      { name: ExercisePerformance.name, schema: ExercisePerformanceSchema },
    ]),
  ],
  providers: [WorkoutSessionResolver, WorkoutSessionService],
})
export class WorkoutSessionModule {}
