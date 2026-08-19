import { InputType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import {
  ValidateNested,
  IsArray,
  IsDateString,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';

@InputType()
class SaveTopExerciseEntryInput {
  @Field(() => Int)
  @IsNumber()
  rank: number;

  @Field(() => ID)
  @IsString()
  exerciseId: string;

  @Field()
  @IsString()
  name: string;

  @Field()
  @IsString()
  category: string;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  totalSessions: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  totalVolume: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  avgVolumePerSession: number;
}

@InputType()
export class SaveTopExercisesInput {
  @Field()
  @IsDateString()
  computedAt: string;

  @Field(() => [SaveTopExerciseEntryInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTopExerciseEntryInput)
  exercises: SaveTopExerciseEntryInput[];
}

@InputType()
class SaveTopRoutineEntryInput {
  @Field(() => Int)
  @IsNumber()
  rank: number;

  @Field(() => ID)
  @IsString()
  planId: string;

  @Field()
  @IsString()
  name: string;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  totalWeeks: number;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  totalSessions: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  @Max(100)
  adherenceRate: number;
}

@InputType()
export class SaveTopRoutinesInput {
  @Field()
  @IsDateString()
  computedAt: string;

  @Field(() => [SaveTopRoutineEntryInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTopRoutineEntryInput)
  routines: SaveTopRoutineEntryInput[];
}

@InputType()
class SavePersonalRecordEntryInput {
  @Field(() => ID)
  @IsString()
  exerciseId: string;

  @Field()
  @IsString()
  exerciseName: string;

  @Field()
  @IsString()
  category: string;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  oneRmEstimated: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  bestWeight: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  bestReps: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  bestVolume: number;

  @Field()
  @IsDateString()
  achievedAt: string;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  previousOneRm?: number | null;
}

@InputType()
export class SavePersonalRecordsInput {
  @Field()
  @IsDateString()
  computedAt: string;

  @Field(() => [SavePersonalRecordEntryInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SavePersonalRecordEntryInput)
  records: SavePersonalRecordEntryInput[];
}

@InputType()
class SaveAdherenceWeekEntryInput {
  @Field()
  @IsDateString()
  weekStartDate: string;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  totalDays: number;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  completedDays: number;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  skippedDays: number;

  @Field(() => Int)
  @IsNumber()
  @Min(0)
  pendingDays: number;

  @Field(() => Float)
  @IsNumber()
  @Min(0)
  @Max(100)
  adherencePercent: number;
}

@InputType()
export class SaveAdherenceInput {
  @Field()
  @IsDateString()
  computedAt: string;

  @Field(() => [SaveAdherenceWeekEntryInput])
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveAdherenceWeekEntryInput)
  weeks: SaveAdherenceWeekEntryInput[];
}
