import { InputType, Field } from '@nestjs/graphql';
import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

@InputType()
export class UpdateDayWorkoutStatusInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  date: string;

  @Field()
  @IsNotEmpty()
  @IsBoolean()
  isRest: boolean;
}
