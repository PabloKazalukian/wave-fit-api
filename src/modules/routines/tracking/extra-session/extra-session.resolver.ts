import { Resolver, Query, Mutation, Args, Context, Int } from '@nestjs/graphql';
import { ExtraSessionService } from './extra-session.service';
import { ExtraSession } from './entities/extra-session.entity';
import { CreateExtraSessionInput } from './dto/create-extra-session.input';
import { UpdateExtraSessionInput } from './dto/update-extra-session.input';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';
import {
  BadRequestException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';
import {
  ExtraSessionDisciplineConfig,
  EXTRA_SESSION_DISCIPLINES,
} from './extra-session.catalog';

@Resolver(() => ExtraSession)
@UseGuards(GqlAuthGuard)
@UseInterceptors(AuditInterceptor)
export class ExtraSessionResolver {
  constructor(private readonly extraSessionService: ExtraSessionService) {}

  @Query(() => [ExtraSessionDisciplineConfig], { name: 'extraSessionCatalog' })
  getCatalog() {
    return Object.values(EXTRA_SESSION_DISCIPLINES);
  }

  @Mutation(() => ExtraSession)
  @Audit('CREATE_EXTRA_SESSION', 'WorkoutSession')
  createExtraSession(
    @Args('createExtraSessionInput')
    createExtraSessionInput: CreateExtraSessionInput,
    @Context() context,
  ) {
    return this.extraSessionService.create(
      createExtraSessionInput,
      context?.req?.user?.id,
    );
  }

  @Query(() => [ExtraSession], { name: 'extraSession' })
  findAll(@Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.extraSessionService.findAllByUser(context?.req?.user?.id);
  }

  @Query(() => ExtraSession, { name: 'extraSession' })
  findOne(@Args('id', { type: () => String }) id: string, @Context() context) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.extraSessionService.findOne(id, context?.req?.user?.id);
  }

  @Query(() => [ExtraSession], { name: 'extraSessionsByIds' })
  findByIds(
    @Args('ids', { type: () => [String] }) ids: string[],
    @Context() context,
  ) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.extraSessionService.findByIds(ids, context?.req?.user?.id);
  }

  @Query(() => [ExtraSession], { name: 'extraSessionsByWorkoutSession' })
  findByWorkoutSession(
    @Args('workoutSessionId', { type: () => String }) workoutSessionId: string,
    @Context() context,
  ) {
    if (!Types.ObjectId.isValid(context?.req?.user?.id)) {
      throw new BadRequestException('Invalid user id');
    }
    return this.extraSessionService.findByWorkoutSession(
      workoutSessionId,
      context?.req?.user?.id,
    );
  }

  @Mutation(() => ExtraSession)
  @Audit('UPDATE_EXTRA_SESSION', 'WorkoutSession')
  updateExtraSession(
    @Args('updateExtraSessionInput')
    updateExtraSessionInput: UpdateExtraSessionInput,
    @Context() context,
  ) {
    return this.extraSessionService.update(
      updateExtraSessionInput.id,
      updateExtraSessionInput,
      context?.req?.user?.id,
    );
  }

  @Mutation(() => Boolean)
  @Audit('REMOVE_EXTRA_SESSION', 'WorkoutSession')
  removeExtraSession(
    @Args('id', { type: () => String }) id: string,
    @Context() context,
  ) {
    return this.extraSessionService.remove(id, context?.req?.user?.id);
  }
}
