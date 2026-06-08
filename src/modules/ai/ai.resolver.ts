import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { AiService } from './ai.service';
import { Ai } from './entities/ai.entity';
import { CreateAiInput } from './dto/create-ai.input';
import { UpdateAiInput } from './dto/update-ai.input';

@Resolver(() => Ai)
export class AiResolver {
  constructor(private readonly aiService: AiService) {}
}
