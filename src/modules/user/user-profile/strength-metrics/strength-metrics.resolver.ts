import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { StrengthMetricsService } from './strength-metrics.service';
import { StrengthMetric } from '../entities/strength-metric.entity';
import { CreateStrengthMetricInput } from './dto/create-strength-metric.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => StrengthMetric)
@UseGuards(GqlAuthGuard)
export class StrengthMetricsResolver {
  constructor(private readonly strengthMetricsService: StrengthMetricsService) {}

  @Mutation(() => StrengthMetric)
  createUserStrengthMetric(
    @Args('input') input: CreateStrengthMetricInput,
    @Context() context,
  ) {
    return this.strengthMetricsService.createStrengthMetric(
      extractUserId(context),
      input,
    );
  }

  @Mutation(() => StrengthMetric)
  removeUserStrengthMetric(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.strengthMetricsService.removeStrengthMetric(
      extractUserId(context),
      id,
    );
  }

  @Query(() => [StrengthMetric])
  userStrengthMetrics(@Context() context) {
    return this.strengthMetricsService.findStrengthMetrics(
      extractUserId(context),
    );
  }
}
