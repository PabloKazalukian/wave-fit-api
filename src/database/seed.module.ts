import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeedService } from './seed-runner';
import {
  Exercise,
  ExerciseSchema,
} from '../modules/routines/templates/exercise/schema/exercise.schema';
import {
  RoutineDay,
  RoutineDaySchema,
} from '../modules/routines/templates/routine-day/schema/routine-day.schema';
import {
  RoutinePlan,
  RoutinePlanSchema,
} from '../modules/routines/templates/routine-plan/schema/routine-plan.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exercise.name, schema: ExerciseSchema },
      { name: RoutineDay.name, schema: RoutineDaySchema },
      { name: RoutinePlan.name, schema: RoutinePlanSchema },
    ]),
  ],
  providers: [SeedService],
  exports: [SeedService],
})
export class SeedModule {}
