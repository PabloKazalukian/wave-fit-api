import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ResourceService } from './resource.service';
import { Resource } from '../entities/resource.entity';
import { UpdateResourceInput } from './dto/update-resource.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from '../user-profile.utils';

@Resolver(() => Resource)
@UseGuards(GqlAuthGuard)
export class ResourceResolver {
  constructor(private readonly resourceService: ResourceService) {}

  @Mutation(() => Resource)
  updateUserResource(
    @Args('input') input: UpdateResourceInput,
    @Context() context,
  ) {
    return this.resourceService.updateResource(extractUserId(context), input);
  }

  @Query(() => Resource, { nullable: true })
  userResource(@Context() context) {
    return this.resourceService.findResource(extractUserId(context));
  }
}
