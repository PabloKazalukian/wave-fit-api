import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDayLogInput } from './create-day-log.input';
import { DayLogExtraSessionInput } from './day-log-extra-session.input';
import { UpdateWorkoutSessionInput } from '../../../workout-session/dto/update-workout-session.input';

@InputType()
export class UpdateDayLogInput extends PartialType(CreateDayLogInput) {
  @Field(() => ID)
  @IsMongoId()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  /**
   * ID de un WorkoutSession ya existente para vincular al crear la ExtraSession.
   * Prioridad: dayLog.workoutSessionId > workoutSessionId > crear WS vacío.
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  workoutSessionId?: string;

  /**
   * Datos del WorkoutSession principal a crear/actualizar (parity con updateWeekDay).
   * Si el day-log ya tiene WS, se actualiza; si no, se crea con el back-reference dayLogId.
   */
  @Field(() => UpdateWorkoutSessionInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateWorkoutSessionInput)
  workoutSession?: UpdateWorkoutSessionInput;

  /** Datos de la ExtraSession a crear (el workoutSessionId lo resuelve el UC). */
  @Field(() => DayLogExtraSessionInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayLogExtraSessionInput)
  extraSession?: DayLogExtraSessionInput;

  /**
   * Estado de display (`pending | complete | skipped`). Es un dato 100% del front:
   * se persiste tal cual y NO tiene efectos colaterales (no toca `completed`,
   * `active` ni el WorkoutSession). El cierre del day-log se maneja con `completed`.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsIn(['pending', 'complete', 'skipped'])
  status?: string;
}