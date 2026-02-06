import {
  Resolver,
  Query,
  Mutation,
  Args,
  Int,
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
import { Types } from 'mongoose';
import { ExerciseCategory } from 'src/common/interfaces/exercise.interface';
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
  async resolveRoutineDays(@Parent() plan: RoutinePlanSchema): Promise<any[]> {
    if (!plan.routineDays || plan.routineDays.length === 0) {
      return [];
    }

    const idsToFetch: string[] = [];
    const dayMap = new Map<number, 'Rest' | string>();

    plan.routineDays.forEach((day, index) => {
      // Si es string vacío o 'Rest', es día de descanso
      if (!day || day === '' || day === 'Rest') {
        dayMap.set(index, 'Rest');
      }
      // Si es un ID válido de MongoDB
      else if (Types.ObjectId.isValid(day)) {
        const idStr = day.toString();
        idsToFetch.push(idStr);
        dayMap.set(index, idStr);
      }
      // Cualquier otro caso también se trata como descanso
      else {
        dayMap.set(index, 'Rest');
      }
    });

    let populatedDays: any[] = [];
    if (idsToFetch.length > 0) {
      populatedDays = await this.routineDayService.findByIds(idsToFetch);
    }

    const populatedMap = new Map<string, any>();
    populatedDays.forEach((day) => {
      const dayId = day.id || day._id?.toString();
      if (dayId) populatedMap.set(dayId, day);
    });

    const result: any[] = [];

    // Iterar sobre TODOS los días del plan (siempre 7)
    for (let i = 0; i < plan.routineDays.length; i++) {
      const value = dayMap.get(i);

      if (value === 'Rest') {
        result.push(this.createRestDay(i));
      } else if (value) {
        const populatedDay = populatedMap.get(value);
        if (populatedDay) {
          result.push(populatedDay);
        } else {
          // Si el ID no se encontró en la DB, poner descanso
          result.push(this.createRestDay(i));
        }
      } else {
        // Fallback: si no hay valor en el map, poner descanso
        result.push(this.createRestDay(i));
      }
    }

    return result;
  }

  private createRestDay(index: number): any {
    return {
      id: 'rest',
      _id: 'rest',
      title: 'Descanso',
      type: [ExerciseCategory.REST],
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
  removeRoutinePlan(@Args('id', { type: () => Int }) id: number) {
    return this.routinePlanService.remove(id);
  }

  @Query(() => Boolean)
  async isRoutineTitleAvailable(@Args('title') input: ValidateTitleInput) {
    const payload = await this.routinePlanService.findByTitle(input.title);
    return payload === null;
  }
}
