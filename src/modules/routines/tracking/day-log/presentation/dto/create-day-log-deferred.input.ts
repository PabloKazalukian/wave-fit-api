import { InputType, Field, ID } from '@nestjs/graphql';
import { IsOptional, IsString, Matches } from 'class-validator';

@InputType()
export class CreateDayLogDeferredInput {
  /**
   * Fecha del día en formato "yyyy-MM-dd" (LocalDate). Solo se permite fecha PASADA.
   */
  @Field(() => String)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in format yyyy-MM-dd',
  })
  date: string;

  /**
   * Timezone IANA del usuario (ej: "America/Argentina/Buenos_Aires").
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
