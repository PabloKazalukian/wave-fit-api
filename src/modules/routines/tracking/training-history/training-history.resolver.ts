import { Resolver, Query, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TrainingHistoryService } from './training-history.service';
import { TrainingCalendarResponse } from './presentation/entities/training-history.entity';
import { TrainingCalendarInput } from './presentation/dto/training-calendar.input';
import { GqlAuthGuard } from '../../../../modules/auth/guards/gql-auth.guard';
import { extractUserId } from 'src/common/utils/user-id.utils';

@Resolver(() => TrainingCalendarResponse)
@UseGuards(GqlAuthGuard)
export class TrainingHistoryResolver {
  constructor(private readonly trainingHistoryService: TrainingHistoryService) {}

  @Query(() => TrainingCalendarResponse, { name: 'trainingCalendar' })
  async trainingCalendar(
    @Args('input') input: TrainingCalendarInput,
    @Context() context,
  ): Promise<TrainingCalendarResponse> {
    const userId = extractUserId(context);

    return this.trainingHistoryService.getTrainingCalendar(
      userId,
      input.year,
      input.month,
      input.timezone,
    );
  }
}
