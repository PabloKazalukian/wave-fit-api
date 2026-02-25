import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ExerciseCategory } from '../entities/exercise.entity';

registerEnumType(ExerciseCategory, {
  name: 'ExerciseCategory',
});

@InputType()
export class CreateExerciseInput {
  @Field()
  @IsString()
  name: string;

  @Field({ nullable: true })
  @IsOptional()
  description?: string;

  @Field(() => ExerciseCategory)
  @IsEnum(ExerciseCategory)
  category: ExerciseCategory;

  // Si requiere peso (true = barra/mancuerna, false = peso corporal)
  @Field({ defaultValue: false })
  @IsBoolean()
  usesWeight: boolean;
}
