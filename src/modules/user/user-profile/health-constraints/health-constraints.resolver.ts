import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { HealthConstraintsService } from './health-constraints.service';
import { HealthConstraint } from '../entities/health-constraint.entity';
import { UpdateHealthConstraintsInput } from './dto/update-health-constraints.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => HealthConstraint)
@UseGuards(GqlAuthGuard)
export class HealthConstraintsResolver {
  constructor(
    private readonly healthConstraintsService: HealthConstraintsService,
  ) {}

  @Mutation(() => HealthConstraint)
  updateUserHealthConstraints(
    @Args('input') input: UpdateHealthConstraintsInput,
    @Context() context,
  ) {
    return this.healthConstraintsService.updateHealthConstraints(
      extractUserId(context),
      input,
    );
  }

  @Query(() => HealthConstraint, { nullable: true })
  userHealthConstraints(@Context() context) {
    return this.healthConstraintsService.findHealthConstraints(
      extractUserId(context),
    );
  }
}
