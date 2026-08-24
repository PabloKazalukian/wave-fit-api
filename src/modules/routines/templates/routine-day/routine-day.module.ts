import { Module } from '@nestjs/common';
import { RoutineDayService } from './routine-day.service';
import { RoutineDayResolver } from './routine-day.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { RoutineDay, RoutineDaySchema } from './schema/routine-day.schema';
import { ExerciseModule } from '../exercise/exercise.module';
import {
  UserTrainingPreference,
  UserTrainingPreferenceSchema,
} from 'src/modules/user/user-profile/schema/training-preference.schema';

@Module({
  imports: [
    ExerciseModule,
    MongooseModule.forFeature([
      { name: RoutineDay.name, schema: RoutineDaySchema },
      {
        name: UserTrainingPreference.name,
        schema: UserTrainingPreferenceSchema,
      },
    ]),
  ],
  providers: [RoutineDayResolver, RoutineDayService],
  exports: [RoutineDayService],
})
export class RoutineDayModule {}
