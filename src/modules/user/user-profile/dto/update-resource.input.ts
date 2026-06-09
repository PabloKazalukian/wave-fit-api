import { InputType, Field, Float } from '@nestjs/graphql';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsArray,
  IsIn,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const TRAINING_ENVIRONMENT_VALUES = [
  'gym', 'home', 'outdoor', 'hotel', 'crossfit_box',
] as const;

@InputType()
class AvailableEquipmentInput {
  @Field({ nullable: true }) @IsOptional() @IsBoolean() barbell?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() squat_rack?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() power_rack?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() cables?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() smith_machine?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() leg_press?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() dumbbells?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() kettlebells?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() resistance_bands?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() pullup_bar?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() dip_bars?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() trx?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() treadmill?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() stationary_bike?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() rowing_machine?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() elliptical?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() jump_rope?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() ab_wheel?: boolean;
  @Field({ nullable: true }) @IsOptional() @IsBoolean() foam_roller?: boolean;
}

@InputType()
export class UpdateResourceInput {
  @Field(() => [String])
  @IsArray()
  @IsString({ each: true })
  @IsIn(TRAINING_ENVIRONMENT_VALUES, { each: true })
  @ArrayMinSize(1)
  trainingEnvironments: string[];

  @Field(() => AvailableEquipmentInput, { nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => AvailableEquipmentInput)
  equipment?: AvailableEquipmentInput;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  dumbbellMaxKg?: number;

  @Field(() => Float, { nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gymDistanceKm?: number;
}
