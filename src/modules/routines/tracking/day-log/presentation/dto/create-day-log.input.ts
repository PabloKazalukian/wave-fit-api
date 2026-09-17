import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsString, Matches } from 'class-validator';

@InputType()
export class CreateDayLogInput {
  /**
   * Fecha del día suelto en formato "yyyy-MM-dd" (LocalDate).
   * ❌ No enviar como Date o ISO UTC — el backend necesita la fecha calendario del usuario.
   */
  @Field(() => String)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in format yyyy-MM-dd',
  })
  date: string; // LocalDate

  /**
   * Timezone IANA del usuario (ej: "America/Argentina/Buenos_Aires").
   * Se usa para convertir LocalDate a UTC al guardar en MongoDB.
   * Si no se envía, se usa 'America/Argentina/Buenos_Aires' por defecto.
   */
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  timezone?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  planId?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  routineDayId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  notes?: string;
}
