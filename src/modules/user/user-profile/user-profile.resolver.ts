import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { UserProfileService } from './user-profile.service';
import { UserProfileContext } from './entities/user-profile-context.entity';
import { UserProfile } from './entities/user-profile.entity';
import { CreateUserProfileInput } from './dto/create-user-profile.input';
import { UpdateUserProfileInput } from './dto/update-user-profile.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import { extractUserId } from './user-profile.utils';

@Resolver()
@UseGuards(GqlAuthGuard)
export class UserProfileResolver {
  constructor(private readonly userProfileService: UserProfileService) {}

  // ── Base Profile ──

  @Mutation(() => UserProfile)
  createUserProfile(
    @Args('createUserProfileInput') input: CreateUserProfileInput,
    @Context() context,
  ) {
    return this.userProfileService.create(input, extractUserId(context));
  }

  @Query(() => [UserProfile], { name: 'userProfiles' })
  findAll() {
    return this.userProfileService.findAll();
  }

  @Query(() => UserProfile, { name: 'userProfile', nullable: true })
  findOne(@Args('id', { type: () => String }) id: string, @Context() context) {
    return this.userProfileService.findOne(id, extractUserId(context));
  }

  @Query(() => UserProfile, { name: 'myProfile', nullable: true })
  myProfile(@Context() context) {
    return this.userProfileService.findByUserId(extractUserId(context));
  }

  @Query(() => UserProfileContext, {
    name: 'userProfileContext',
    //nullable: true,
  })
  async userProfileContext(@Context() context) {
    return this.userProfileService.getFullProfileContext(
      extractUserId(context),
    );
  }

  @Mutation(() => UserProfile)
  updateUserProfile(
    @Args('updateUserProfileInput') input: UpdateUserProfileInput,
    @Context() context,
  ) {
    const userId = extractUserId(context);
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
    return this.userProfileService.upsert(input, extractUserId(context));
  }

  @Mutation(() => UserProfile)
  removeUserProfile(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.userProfileService.remove(id, extractUserId(context));
  }

  /**
   * Borra TODOS los datos de user-profile del usuario autenticado
   * (perfil, objetivos, preferencias, salud, agenda, recursos,
   * métricas de fuerza y registros de peso). Idempotente.
   */
  @Mutation(() => Boolean, { name: 'removeMyProfileData' })
  removeMyProfileData(@Context() context) {
    return this.userProfileService.removeAllProfileData(
      extractUserId(context),
    );
  }
}
