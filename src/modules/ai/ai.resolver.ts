import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AiService } from './ai.service';
import { Ai } from './entities/ai.entity';
import { CreateAiInput } from './dto/create-ai.input';
import { UpdateAiInput } from './dto/update-ai.input';

@Resolver(() => Ai)
export class AiResolver {
  constructor(private readonly aiService: AiService) {}

  @Mutation(() => Ai)
  createAi(@Args('createAiInput') createAiInput: CreateAiInput) {
    return this.aiService.create(createAiInput);
  }

  @Query(() => [Ai], { name: 'ai' })
  findAll() {
    return this.aiService.findAll();
  }

  @Query(() => Ai, { name: 'ai' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.aiService.findOne(id);
  }

  @Mutation(() => Ai)
  updateAi(@Args('updateAiInput') updateAiInput: UpdateAiInput) {
    return this.aiService.update(updateAiInput.id, updateAiInput);
  }

  @Mutation(() => Ai)
  removeAi(@Args('id', { type: () => Int }) id: number) {
    return this.aiService.remove(id);
  }
}
