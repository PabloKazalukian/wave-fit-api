import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { StatsService } from './stats.service';
import { Stat } from './entities/stat.entity';
import { CreateStatInput } from './dto/create-stat.input';
import { UpdateStatInput } from './dto/update-stat.input';

@Resolver(() => Stat)
export class StatsResolver {
  constructor(private readonly statsService: StatsService) {}

  @Mutation(() => Stat)
  createStat(@Args('createStatInput') createStatInput: CreateStatInput) {
    return this.statsService.create(createStatInput);
  }

  @Query(() => [Stat], { name: 'stats' })
  findAll() {
    return this.statsService.findAll();
  }

  @Query(() => Stat, { name: 'stat' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.statsService.findOne(id);
  }

  @Mutation(() => Stat)
  updateStat(@Args('updateStatInput') updateStatInput: UpdateStatInput) {
    return this.statsService.update(updateStatInput.id, updateStatInput);
  }

  @Mutation(() => Stat)
  removeStat(@Args('id', { type: () => Int }) id: number) {
    return this.statsService.remove(id);
  }
}
