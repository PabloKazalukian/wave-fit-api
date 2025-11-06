import { Module } from '@nestjs/common';
import { WorkoutSessionService } from './workout-session.service';
import { WorkoutSessionResolver } from './workout-session.resolver';

@Module({
  providers: [WorkoutSessionResolver, WorkoutSessionService],
})
export class WorkoutSessionModule {}
