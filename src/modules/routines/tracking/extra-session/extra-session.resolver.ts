import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { ExtraSessionService } from './extra-session.service';
import { ExtraSession } from './entities/extra-session.entity';
import { CreateExtraSessionInput } from './dto/create-extra-session.input';
import { UpdateExtraSessionInput } from './dto/update-extra-session.input';

@Resolver(() => ExtraSession)
export class ExtraSessionResolver {
  constructor(private readonly extraSessionService: ExtraSessionService) {}

  @Mutation(() => ExtraSession)
  createExtraSession(
    @Args('createExtraSessionInput')
    createExtraSessionInput: CreateExtraSessionInput,
  ) {
    return this.extraSessionService.create(createExtraSessionInput);
  }

  @Query(() => [ExtraSession], { name: 'extraSession' })
  findAll() {
    return this.extraSessionService.findAll();
  }

  @Query(() => ExtraSession, { name: 'extraSession' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.extraSessionService.findOne(id);
  }

  @Mutation(() => ExtraSession)
  updateExtraSession(
    @Args('updateExtraSessionInput')
    updateExtraSessionInput: UpdateExtraSessionInput,
  ) {
    return this.extraSessionService.update(
      updateExtraSessionInput.id,
      updateExtraSessionInput,
    );
  }

  @Mutation(() => ExtraSession)
  removeExtraSession(@Args('id', { type: () => Int }) id: number) {
    return this.extraSessionService.remove(id);
  }
}
