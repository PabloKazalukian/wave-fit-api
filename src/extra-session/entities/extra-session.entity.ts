import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';

@ObjectType()
export class ExtraSession {
  @Field(() => ID)
  id: string;

  @Field()
  type: string; // "cardio", "yoga", "deporte", etc.

  @Field()
  discipline: string; // "running", "bicicleta", "fútbol", etc.

  @Field(() => Float)
  duration: number; // en minutos

  @Field(() => Int)
  intensityLevel: number; // escala 1–5

  @Field(() => Float, { nullable: true })
  calories?: number;

  @Field({ nullable: true })
  notes?: string;
}
