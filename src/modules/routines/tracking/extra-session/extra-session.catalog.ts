import { ObjectType, Field, registerEnumType, Int } from '@nestjs/graphql';

export enum ExtraSessionCategory {
  CARDIO = 'cardio',
  STRENGTH = 'strength',
  SPORT = 'sport',
  MIND_BODY = 'mind_body',
}

registerEnumType(ExtraSessionCategory, {
  name: 'ExtraSessionCategory',
});

export type ExtraSessionDisciplineKey =
  | 'running'
  | 'cycling'
  | 'stationary_bike'
  | 'swimming'
  | 'walking'
  | 'weightlifting'
  | 'crossfit'
  | 'football'
  | 'basketball'
  | 'tennis'
  | 'yoga'
  | 'pilates'
  | 'mobility';

@ObjectType()
export class ExtraSessionDisciplineConfig {
  @Field()
  key: ExtraSessionDisciplineKey;

  @Field()
  label: string;

  @Field(() => ExtraSessionCategory)
  category: ExtraSessionCategory;

  @Field(() => Int)
  avgCaloriesPerHour: number;
}

export const EXTRA_SESSION_DISCIPLINES: Record<
  ExtraSessionDisciplineKey,
  ExtraSessionDisciplineConfig
> = {
  // 🔥 CARDIO
  running: {
    key: 'running',
    label: 'Running',
    category: ExtraSessionCategory.CARDIO,
    avgCaloriesPerHour: 600,
  },
  cycling: {
    key: 'cycling',
    label: 'Ciclismo',
    category: ExtraSessionCategory.CARDIO,
    avgCaloriesPerHour: 500,
  },
  stationary_bike: {
    key: 'stationary_bike',
    label: 'Bicicleta fija',
    category: ExtraSessionCategory.CARDIO,
    avgCaloriesPerHour: 450,
  },
  swimming: {
    key: 'swimming',
    label: 'Natación',
    category: ExtraSessionCategory.CARDIO,
    avgCaloriesPerHour: 650,
  },
  walking: {
    key: 'walking',
    label: 'Caminata',
    category: ExtraSessionCategory.CARDIO,
    avgCaloriesPerHour: 250,
  },

  // 🔥 STRENGTH
  weightlifting: {
    key: 'weightlifting',
    label: 'Levantamiento de pesas',
    category: ExtraSessionCategory.STRENGTH,
    avgCaloriesPerHour: 400,
  },
  crossfit: {
    key: 'crossfit',
    label: 'CrossFit',
    category: ExtraSessionCategory.STRENGTH,
    avgCaloriesPerHour: 700,
  },

  // 🔥 SPORT
  football: {
    key: 'football',
    label: 'Fútbol',
    category: ExtraSessionCategory.SPORT,
    avgCaloriesPerHour: 700,
  },
  basketball: {
    key: 'basketball',
    label: 'Básquet',
    category: ExtraSessionCategory.SPORT,
    avgCaloriesPerHour: 650,
  },
  tennis: {
    key: 'tennis',
    label: 'Tenis',
    category: ExtraSessionCategory.SPORT,
    avgCaloriesPerHour: 600,
  },

  // 🔥 MIND_BODY
  yoga: {
    key: 'yoga',
    label: 'Yoga',
    category: ExtraSessionCategory.MIND_BODY,
    avgCaloriesPerHour: 250,
  },
  pilates: {
    key: 'pilates',
    label: 'Pilates',
    category: ExtraSessionCategory.MIND_BODY,
    avgCaloriesPerHour: 300,
  },
  mobility: {
    key: 'mobility',
    label: 'Movilidad / Stretching',
    category: ExtraSessionCategory.MIND_BODY,
    avgCaloriesPerHour: 200,
  },
};
