import { ObjectType, Field, ID, Float } from '@nestjs/graphql';

@ObjectType()
class AvailableEquipment {
  @Field() barbell: boolean;
  @Field() squat_rack: boolean;
  @Field() power_rack: boolean;
  @Field() cables: boolean;
  @Field() smith_machine: boolean;
  @Field() leg_press: boolean;
  @Field() dumbbells: boolean;
  @Field() kettlebells: boolean;
  @Field() resistance_bands: boolean;
  @Field() pullup_bar: boolean;
  @Field() dip_bars: boolean;
  @Field() trx: boolean;
  @Field() treadmill: boolean;
  @Field() stationary_bike: boolean;
  @Field() rowing_machine: boolean;
  @Field() elliptical: boolean;
  @Field() jump_rope: boolean;
  @Field() ab_wheel: boolean;
  @Field() foam_roller: boolean;
}

@ObjectType()
export class Resource {
  @Field(() => ID)
  _id: string;

  @Field(() => ID)
  userId: string;

  @Field(() => [String])
  trainingEnvironments: string[];

  @Field(() => AvailableEquipment)
  equipment: AvailableEquipment;

  @Field(() => Float, { nullable: true })
  dumbbellMaxKg?: number;

  @Field(() => Float, { nullable: true })
  gymDistanceKm?: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
