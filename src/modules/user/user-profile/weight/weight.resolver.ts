import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { WeightService } from './weight.service';
import { WeightLog } from '../entities/weight-log.entity';
import { CreateWeightLogInput } from './dto/create-weight-log.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => WeightLog)
@UseGuards(GqlAuthGuard)
export class WeightResolver {
  constructor(private readonly weightService: WeightService) {}

  @Mutation(() => WeightLog)
  createWeightLog(
    @Args('input') input: CreateWeightLogInput,
    @Context() context,
  ) {
    return this.weightService.createWeightLog(extractUserId(context), input);
  }

  @Query(() => [WeightLog])
  userWeightLogs(@Context() context) {
    return this.weightService.findWeightLogs(extractUserId(context));
  }
}
