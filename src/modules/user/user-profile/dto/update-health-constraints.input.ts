import { InputType, Field } from '@nestjs/graphql';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsArray,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const BODY_PART_VALUES = [
  'lower_back', 'upper_back', 'neck',
  'left_shoulder', 'right_shoulder',
  'left_knee', 'right_knee',
  'left_hip', 'right_hip',
  'left_elbow', 'right_elbow',
  'left_wrist', 'right_wrist',
  'left_ankle', 'right_ankle',
  'core', 'chest',
] as const;

const INJURY_SEVERITY_VALUES = ['mild', 'moderate', 'severe'] as const;

const MOBILITY_LEVEL_VALUES = [
  'limited', 'moderate', 'good', 'excellent',
] as const;

@InputType()
class InjuryInput {
  @Field()
  @IsString()
  @IsIn(BODY_PART_VALUES)
  bodyPart: string;

  @Field()
  @IsString()
  @IsIn(INJURY_SEVERITY_VALUES)
  severity: string;

  @Field({ defaultValue: true })
  @IsBoolean()
  isActive: boolean;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  description?: string;
}

@InputType()
export class UpdateHealthConstraintsInput {
  @Field(() => [InjuryInput], { nullable: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => InjuryInput)
  injuries?: InjuryInput[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  movementRestrictions?: string[];

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  conditions?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @IsIn(MOBILITY_LEVEL_VALUES)
  mobilityLevel?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  hasHealthcareSupervision?: boolean;
}
