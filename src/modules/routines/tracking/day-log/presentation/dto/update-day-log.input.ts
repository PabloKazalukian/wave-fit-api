import { InputType, Field, ID, PartialType } from '@nestjs/graphql';
import { IsBoolean, IsMongoId, IsOptional } from 'class-validator';
import { CreateDayLogInput } from './create-day-log.input';

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
}
