import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ExerciseCategory } from '../entities/exercise.entity';

registerEnumType(ExerciseCategory, {
  name: 'ExerciseCategory',
});

@InputType()
export class CreateExerciseInput {
  @Field()
  @IsString()
  @MaxLength(64, { message: 'El nombre no debe superar los 64 caracteres' })
  @Matches(/^[a-zA-Z\s\-\/\(\)\.]+$/, {
    message:
      'El nombre solo puede contener letras, espacios y los caracteres - / ( ) .',
  })
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
