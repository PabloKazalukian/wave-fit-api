import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { WeekLogService } from './week-log.service';
import { WeekLog } from './entities/week-log.entity';
import { CreateWeekLogInput } from './dto/create-week-log.input';
import { UpdateWeekLogInput } from './dto/update-week-log.input';

@Resolver(() => WeekLog)
export class WeekLogResolver {
  constructor(private readonly weekLogService: WeekLogService) {}

  @Mutation(() => WeekLog)
  createWeekLog(@Args('createWeekLogInput') createWeekLogInput: CreateWeekLogInput) {
    return this.weekLogService.create(createWeekLogInput);
  }

  @Query(() => [WeekLog], { name: 'weekLog' })
  findAll() {
    return this.weekLogService.findAll();
  }

  @Query(() => WeekLog, { name: 'weekLog' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.weekLogService.findOne(id);
  }

  @Mutation(() => WeekLog)
  updateWeekLog(@Args('updateWeekLogInput') updateWeekLogInput: UpdateWeekLogInput) {
    return this.weekLogService.update(updateWeekLogInput.id, updateWeekLogInput);
  }

  @Mutation(() => WeekLog)
  removeWeekLog(@Args('id', { type: () => Int }) id: number) {
    return this.weekLogService.remove(id);
  }
}
