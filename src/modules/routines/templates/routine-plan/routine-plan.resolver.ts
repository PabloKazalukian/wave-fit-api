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

@Resolver(() => RoutinePlan)
export class RoutinePlanResolver {
  constructor(
    private readonly routinePlanService: RoutinePlanService,
    private readonly routineDayService: RoutineDayService,
  ) {}

  @Mutation(() => RoutinePlan)
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

    // Paso 1: Identificar qué posiciones tienen ObjectIds y cuáles "Rest"
    const idsToFetch: string[] = [];
    const dayMap = new Map<number, 'Rest' | string>(); // posición → tipo

    plan.routineDays.forEach((day, index) => {
      if (typeof day === 'string' && day === 'Rest') {
        dayMap.set(index, 'Rest');
      } else if (day && Types.ObjectId.isValid(day)) {
        const idStr = day.toString();
        idsToFetch.push(idStr);
        dayMap.set(index, idStr);
      }
    });

    // Paso 2: Hacer populate solo de los ObjectIds válidos
    let populatedDays: any[] = [];
    if (idsToFetch.length > 0) {
      populatedDays = await this.routineDayService.findByIds(idsToFetch);
    }

    // Crear Map para acceso rápido por ID
    const populatedMap = new Map<string, any>();
    populatedDays.forEach((day) => {
      // Mongoose Document tiene _id, GraphQL tiene id
      const dayId = day.id || day._id?.toString();
      if (dayId) {
        populatedMap.set(dayId, day);
      }
    });

    // Paso 3: Reconstruir array en orden original
    const result: any[] = [];

    for (let i = 0; i < plan.routineDays.length; i++) {
      const value = dayMap.get(i);

      if (value === 'Rest') {
        // Crear objeto especial para día de descanso
        result.push(this.createRestDay(i));
      } else if (value) {
        // Buscar el documento populado
        const populatedDay = populatedMap.get(value);
        if (populatedDay) {
          result.push(populatedDay);
        } else {
          // Si no se encontró, usar Rest como fallback
          console.warn(`RoutineDay ${value} no encontrado en DB`);
          result.push(this.createRestDay(i));
        }
      }
    }

    return result;
  }

  /**
   * Crea un objeto RoutineDay especial para días de descanso
   */
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
