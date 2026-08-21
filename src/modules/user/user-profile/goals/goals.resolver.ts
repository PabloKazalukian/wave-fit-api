import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { Goal } from '../entities/goal.entity';
import { UpdateGoalsInput } from './dto/update-goals.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => Goal)
@UseGuards(GqlAuthGuard)
export class GoalsResolver {
  constructor(private readonly goalsService: GoalsService) {}

  @Mutation(() => Goal)
  updateUserGoals(@Args('input') input: UpdateGoalsInput, @Context() context) {
    return this.goalsService.updateGoals(extractUserId(context), input);
  }

  @Query(() => Goal, { nullable: true })
  userGoals(@Context() context) {
    return this.goalsService.findGoals(extractUserId(context));
  }
}
