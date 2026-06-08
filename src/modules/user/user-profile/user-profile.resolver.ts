import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserProfileService } from './user-profile.service';
import { UserProfile } from './entities/user-profile.entity';
import { CreateUserProfileInput } from './dto/create-user-profile.input';
import { UpdateUserProfileInput } from './dto/update-user-profile.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';

@Resolver(() => UserProfile)
@UseGuards(GqlAuthGuard)
export class UserProfileResolver {
  constructor(private readonly userProfileService: UserProfileService) {}

  @Mutation(() => UserProfile)
  createUserProfile(
    @Args('createUserProfileInput') input: CreateUserProfileInput,
    @Context() context,
  ) {
    const userId = context?.req?.user?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userProfileService.create(input, userId);
  }

  @Query(() => [UserProfile], { name: 'userProfiles' })
  findAll() {
    return this.userProfileService.findAll();
  }

  @Query(() => UserProfile, { name: 'userProfile', nullable: true })
  findOne(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = context?.req?.user?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userProfileService.findOne(id, userId);
  }

  @Query(() => UserProfile, { name: 'myProfile', nullable: true })
  myProfile(@Context() context) {
    const userId = context?.req?.user?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userProfileService.findByUserId(userId);
  }

  @Mutation(() => UserProfile)
  updateUserProfile(
    @Args('updateUserProfileInput') input: UpdateUserProfileInput,
    @Context() context,
  ) {
    const userId = context?.req?.user?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    const id = input.id;
    if (!id || !Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid profile id');
    }
    return this.userProfileService.update(id, input, userId);
  }

  @Mutation(() => UserProfile)
  upsertUserProfile(
    @Args('createUserProfileInput') input: CreateUserProfileInput,
    @Context() context,
  ) {
    const userId = context?.req?.user?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userProfileService.upsert(input, userId);
  }

  @Mutation(() => UserProfile)
  removeUserProfile(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    const userId = context?.req?.user?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.userProfileService.remove(id, userId);
  }
}
