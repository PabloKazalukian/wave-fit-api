import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsString, Matches } from 'class-validator';

@InputType()
export class CreateWeekLogInput {
  /**
   * Fecha de inicio de la semana en formato "yyyy-MM-dd" (LocalDate).
   * ❌ No enviar como Date o ISO UTC — el backend necesita la fecha calendario del usuario.
   */
  @Field(() => String)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be in format yyyy-MM-dd',
  })
  startDate: string; // LocalDate

  /**
   * Fecha de fin de la semana en formato "yyyy-MM-dd" (LocalDate).
   */
  @Field(() => String)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must be in format yyyy-MM-dd',
  })
  endDate: string; // LocalDate

  /**
   * Timezone IANA del usuario (ej: "America/Argentina/Buenos_Aires").
   * Se usa para convertir LocalDate a UTC al guardar en MongoDB.
   */
  @Field(() => String)
  @IsString()
  timezone: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  planId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
