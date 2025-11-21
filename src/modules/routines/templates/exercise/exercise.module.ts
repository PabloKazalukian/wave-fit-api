import { Module } from '@nestjs/common';
import { ExerciseService } from './exercise.service';
import { ExerciseResolver } from './exercise.resolver';
import { Exercise, ExerciseSchema } from './schema/exercise.schema';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Exercise.name, schema: ExerciseSchema },
    ]),
  ],
  providers: [ExerciseResolver, ExerciseService],
  exports: [ExerciseService],
})
export class ExerciseModule {}
