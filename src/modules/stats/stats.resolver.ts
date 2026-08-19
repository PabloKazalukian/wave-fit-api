import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { TopExerciseStats } from './presentation/entities/top-exercise.output';
import { TopRoutineStats } from './presentation/entities/top-routine.output';
import { PersonalRecordStats } from './presentation/entities/personal-record.output';
import { AdherenceStats } from './presentation/entities/adherence.output';
import { WorkerRawData } from './presentation/dto/worker-raw-data.output';
import {
  SaveTopExercisesInput,
  SaveTopRoutinesInput,
  SavePersonalRecordsInput,
  SaveAdherenceInput,
} from './presentation/dto/save-stats.input';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { ServiceAuthGuard } from '../auth/guards/service-auth.guard';
import { extractUserId } from '../../common/utils/user-id.utils';
import { ID } from '@nestjs/graphql';

@Resolver()
export class StatsResolver {
  constructor(private readonly statsService: StatsService) {}

  @Query(() => TopExerciseStats, { name: 'getTopExercises', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getTopExercises(@Context() context: any) {
    const userId = extractUserId(context);
    return this.statsService.getTopExercises(userId);
  }

  @Query(() => TopRoutineStats, { name: 'getTopRoutines', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getTopRoutines(@Context() context: any) {
    const userId = extractUserId(context);
    return this.statsService.getTopRoutines(userId);
  }

  @Query(() => PersonalRecordStats, {
    name: 'getPersonalRecords',
    nullable: true,
  })
  @UseGuards(GqlAuthGuard)
  async getPersonalRecords(@Context() context: any) {
    const userId = extractUserId(context);
    return this.statsService.getPersonalRecords(userId);
  }

  @Query(() => AdherenceStats, { name: 'getAdherence', nullable: true })
  @UseGuards(GqlAuthGuard)
  async getAdherence(@Context() context: any) {
    const userId = extractUserId(context);
    return this.statsService.getAdherence(userId);
  }

  @Query(() => WorkerRawData, { name: 'getRawDataForWorker' })
  @UseGuards(ServiceAuthGuard)
  async getRawDataForWorker(
    @Args('userId', { type: () => ID }) userId: string,
  ) {
    return this.statsService.getRawDataForWorker(userId);
  }

  @Mutation(() => TopExerciseStats)
  @UseGuards(ServiceAuthGuard)
  async saveTopExercises(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('input') input: SaveTopExercisesInput,
  ) {
    return this.statsService.saveTopExercises(
      userId,
      input.exercises,
      new Date(input.computedAt),
    );
  }

  @Mutation(() => TopRoutineStats)
  @UseGuards(ServiceAuthGuard)
  async saveTopRoutines(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('input') input: SaveTopRoutinesInput,
  ) {
    return this.statsService.saveTopRoutines(
      userId,
      input.routines,
      new Date(input.computedAt),
    );
  }

  @Mutation(() => PersonalRecordStats)
  @UseGuards(ServiceAuthGuard)
  async savePersonalRecords(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('input') input: SavePersonalRecordsInput,
  ) {
    return this.statsService.savePersonalRecords(
      userId,
      input.records.map((r) => ({
        ...r,
        achievedAt: new Date(r.achievedAt),
        previousOneRm: r.previousOneRm ?? null,
      })),
      new Date(input.computedAt),
    );
  }

  @Mutation(() => AdherenceStats)
  @UseGuards(ServiceAuthGuard)
  async saveAdherence(
    @Args('userId', { type: () => ID }) userId: string,
    @Args('input') input: SaveAdherenceInput,
  ) {
    return this.statsService.saveAdherence(
      userId,
      input.weeks.map((w) => ({
        ...w,
        weekStartDate: new Date(w.weekStartDate),
      })),
      new Date(input.computedAt),
    );
  }
}
