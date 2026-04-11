import { InputType, Field, Int } from '@nestjs/graphql';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateWorkoutSessionInput } from '../../../workout-session/dto/update-workout-session.input';

// ─── ExtraSession data (sin workoutSessionId; lo resuelve el UseCase) ─────────
@InputType()
export class CreateExtraSessionWithoutWsInput {
  @Field()
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  discipline: string;

  @Field(() => Int)
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  duration: number;

  @Field(() => Int)
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(5)
  intensityLevel: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Day input unificado (usado por updateDay y updateWeekLog) ─────────────────
@InputType()
export class UpdateDayInput {
  /** Identificador del día dentro del WeekLog (1-7) */
  @Field(() => Int)
  order: number;

  /**
   * ID de un WorkoutSession ya existente en DB para vincular al crear el ES.
   * Prioridad: day.workoutSessionId > workoutSessionId > crear nuevo WS vacío.
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsMongoId()
  workoutSessionId?: string;

  /** Datos del WorkoutSession a crear/actualizar en este day. */
  @Field(() => UpdateWorkoutSessionInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateWorkoutSessionInput)
  workoutSession?: UpdateWorkoutSessionInput;

  /** Datos de la ExtraSession a crear (el workoutSessionId lo resuelve el UC). */
  @Field(() => CreateExtraSessionWithoutWsInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateExtraSessionWithoutWsInput)
  extraSession?: CreateExtraSessionWithoutWsInput;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  isRest?: boolean;
}

// ─── Input del mutation updateDay ─────────────────────────────────────────────
@InputType()
export class UpdateWeekLogDayUnifiedInput {
  @Field(() => String)
  @IsMongoId()
  id: string;

  @Field(() => [UpdateDayInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDayInput)
  days: UpdateDayInput[];
}

// ─── Input del mutation updateWeekLog (general) ───────────────────────────────
@InputType()
export class UpdateWeekLogInput {
  @Field(() => String)
  @IsMongoId()
  id: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;

  /** Si completed = true, el UC fuerza active = false automáticamente. */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  /**
   * Si active = true, el UC desactiva todos los demás WL del usuario.
   * Es ignorado si completed = true (que siempre impone active = false).
   */
  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  /** Days opcionales con la misma lógica de WS/ES que updateDay. */
  @Field(() => [UpdateDayInput], { nullable: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateDayInput)
  days?: UpdateDayInput[];
}
