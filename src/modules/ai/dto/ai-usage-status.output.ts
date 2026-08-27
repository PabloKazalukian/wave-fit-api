// modules/ai/dto/ai-usage-status.output.ts
import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class AiUsageStatusOutput {
  @Field(() => Int, { description: 'Generaciones de IA usadas hoy (ventana UTC)' })
  used: number;

  @Field(() => Int, { description: 'Límite diario de generaciones' })
  limit: number;

  @Field(() => Int, { description: 'Generaciones restantes para hoy' })
  remaining: number;

  @Field({ description: 'Momento en que se reinicia la ventana (medianoche UTC)' })
  resetAt: Date;
}
