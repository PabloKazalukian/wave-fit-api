import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { DayLogService } from './day-log.service';
import { UpdateDayLogInput } from './presentation/dto/update-day-log.input';
import { DayLog } from './presentation/entities/day-log.entity';

@Resolver(() => DayLog)
export class DayLogResolver {
  constructor(private readonly dayLogService: DayLogService) {}

  @Mutation(() => DayLog)
  createDayLog() {
    return this.dayLogService.create();
  }

  @Query(() => [DayLog], { name: 'dayLog' })
  findAll() {
    return this.dayLogService.findAll();
  }

  @Query(() => DayLog, { name: 'dayLog' })
  findOne(@Args('id', { type: () => Int }) id: number) {
    return this.dayLogService.findOne(id);
  }

  @Mutation(() => DayLog)
  updateDayLog(
    @Args('updateDayLogInput') updateDayLogInput: UpdateDayLogInput,
  ) {
    return this.dayLogService.update(updateDayLogInput.id);
  }

  @Mutation(() => DayLog)
  removeDayLog(@Args('id', { type: () => Int }) id: number) {
    return this.dayLogService.remove(id);
  }
}
