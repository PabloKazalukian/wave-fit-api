import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateDayLogInput } from './create-day-log.input';
import { DayLogExtraSessionInput } from './day-log-extra-session.input';

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

  /** Datos de la ExtraSession a crear (el workoutSessionId lo resuelve el UC). */
  @Field(() => DayLogExtraSessionInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => DayLogExtraSessionInput)
  extraSession?: DayLogExtraSessionInput;
}