import {
  Resolver,
  Query,
  Mutation,
  Args,
  ResolveField,
  Parent,
} from '@nestjs/graphql';
import { RoutinePlanService } from './routine-plan.service';
import { RoutinePlan } from './entities/routine-plan.entity';
import { RoutinePlan as RoutinePlanSchema } from './schema/routine-plan.schema';

import {
  CreateRoutinePlanInput,
  ValidateTitleInput,
} from './dto/create-routine-plan.input';
import { UpdateRoutinePlanInput } from './dto/update-routine-plan.input';
import { RoutineDay } from '../routine-day/entities/routine-day.entity';
import { RoutineDayService } from '../routine-day/routine-day.service';
import { AuditInterceptor } from 'src/modules/audit-logs/audit-logs.interceptor';
import { UseGuards, UseInterceptors } from '@nestjs/common';
import { Audit } from 'src/modules/audit-logs/audit-logs.decorator';
import { GqlAuthGuard } from 'src/modules/auth/guards/gql-auth.guard';

@Resolver(() => RoutinePlan)
@UseInterceptors(AuditInterceptor)
export class RoutinePlanResolver {
  constructor(
    private readonly routinePlanService: RoutinePlanService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  @Mutation(() => RoutinePlan)
  @Audit('CREATE_WEEKLY_ROUTINE', 'WeeklyRoutine')
  @UseGuards(GqlAuthGuard)
  createRoutinePlan(
    @Args('createRoutinePlanInput')
    createRoutinePlanInput: CreateRoutinePlanInput,
  ) {
    return this.routinePlanService.create(createRoutinePlanInput);
  }

  @ResolveField(() => [RoutineDay], { name: 'routineDays' })
  async resolveRoutineDays(
    @Parent() plan: RoutinePlanSchema,
  ): Promise<RoutineDay[]> {
    if (!plan.week || plan.week.length === 0) {
      return [];
    }

    // Obtener solo los días que NO son descanso
    const idsToFetch = plan.week
      .filter((d) => !d.isRest && d.day)
      .map((d) => d.day!.toString());

    let populatedDays: any[] = [];

    if (idsToFetch.length > 0) {
      populatedDays = await this.routineDayService.findByIds(idsToFetch);
    }

    const populatedMap = new Map<string, any>();
    populatedDays.forEach((day) => {
      populatedMap.set(day.id || day._id.toString(), day);
    });

    // Reconstruir respetando orden
    const orderedWeek = [...plan.week].sort((a, b) => a.order - b.order);

    const result: RoutineDay[] = [];

    for (const dayEntry of orderedWeek) {
      if (dayEntry.isRest || !dayEntry.day) {
        result.push(this.createRestDay());
      } else {
        const found = populatedMap.get(dayEntry.day.toString());
        result.push(found ?? this.createRestDay());
      }
    }

    return result;
  }
  private createRestDay(): any {
    return {
      id: 'rest',
      title: 'Descanso',
      exercises: [],
    };
  }

  @Query(() => [RoutinePlan], { name: 'routinePlans' })
  routines() {
    return this.routinePlanService.findAll();
  }

  @Query(() => RoutinePlan, { name: 'routinePlan' })
  findOne(@Args('id', { type: () => String }) id: string) {
    return this.routinePlanService.findOne(id);
  }

  @Mutation(() => RoutinePlan)
  updateRoutinePlan(
    @Args('updateRoutinePlanInput')
    updateRoutinePlanInput: UpdateRoutinePlanInput,
  ) {
    return this.routinePlanService.update(
      updateRoutinePlanInput.id,
      updateRoutinePlanInput,
    );
  }

  @Mutation(() => RoutinePlan)
  removeRoutinePlan(@Args('id', { type: () => String }) id: string) {
    return this.routinePlanService.remove(id);
  }

  @Query(() => Boolean)
  async isRoutineTitleAvailable(@Args('title') input: ValidateTitleInput) {
    const payload = await this.routinePlanService.findByTitle(input.title);
    return payload === null;
  }
}
