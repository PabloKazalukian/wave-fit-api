import { Module } from '@nestjs/common';
import { ExerciseService } from './exercise.service';
import { ExerciseResolver } from './exercise.resolver';
import { Exercise, ExerciseSchema } from './schema/exercise.schema';
import {
  UserTrainingPreference,
  UserTrainingPreferenceSchema,
} from 'src/modules/user/user-profile/schema/training-preference.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exercise.name, schema: ExerciseSchema },
      {
        name: UserTrainingPreference.name,
        schema: UserTrainingPreferenceSchema,
      },
    ]),
  ],
  providers: [ExerciseResolver, ExerciseService],
  exports: [ExerciseService],
})
export class ExerciseModule {}
