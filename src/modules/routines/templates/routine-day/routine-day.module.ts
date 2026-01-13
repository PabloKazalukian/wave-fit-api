import { Module } from '@nestjs/common';
import { RoutineDayService } from './routine-day.service';
import { RoutineDayResolver } from './routine-day.resolver';
import { MongooseModule } from '@nestjs/mongoose';
import { RoutineDay, RoutineDaySchema } from './schema/routine-day.schema';
import { ExerciseModule } from '../exercise/exercise.module';

@Module({
  imports: [
    ExerciseModule,
    MongooseModule.forFeature([
      { name: RoutineDay.name, schema: RoutineDaySchema },
    ]),
  ],
  providers: [RoutineDayResolver, RoutineDayService],
  exports: [RoutineDayService],
})
export class RoutineDayModule {}
