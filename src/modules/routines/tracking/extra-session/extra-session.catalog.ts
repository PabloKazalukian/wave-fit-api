import { ObjectType, Field, registerEnumType, Float } from '@nestjs/graphql';

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

  @Field(() => Float)
  met: number;
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
    met: 8,
  },
  cycling: {
    key: 'cycling',
    label: 'Ciclismo',
    category: ExtraSessionCategory.CARDIO,
    met: 7.5,
  },
  stationary_bike: {
    key: 'stationary_bike',
    label: 'Bicicleta fija',
    category: ExtraSessionCategory.CARDIO,
    met: 7,
  },
  swimming: {
    key: 'swimming',
    label: 'Natación',
    category: ExtraSessionCategory.CARDIO,
    met: 8,
  },
  walking: {
    key: 'walking',
    label: 'Caminata',
    category: ExtraSessionCategory.CARDIO,
    met: 3.5,
  },

  // 🔥 STRENGTH
  weightlifting: {
    key: 'weightlifting',
    label: 'Levantamiento de pesas',
    category: ExtraSessionCategory.STRENGTH,
    met: 5,
  },
  crossfit: {
    key: 'crossfit',
    label: 'CrossFit',
    category: ExtraSessionCategory.STRENGTH,
    met: 9,
  },

  // 🔥 SPORT
  football: {
    key: 'football',
    label: 'Fútbol',
    category: ExtraSessionCategory.SPORT,
    met: 8,
  },
  basketball: {
    key: 'basketball',
    label: 'Básquet',
    category: ExtraSessionCategory.SPORT,
    met: 7.5,
  },
  tennis: {
    key: 'tennis',
    label: 'Tenis',
    category: ExtraSessionCategory.SPORT,
    met: 7,
  },

  // 🔥 MIND_BODY
  yoga: {
    key: 'yoga',
    label: 'Yoga',
    category: ExtraSessionCategory.MIND_BODY,
    met: 3,
  },
  pilates: {
    key: 'pilates',
    label: 'Pilates',
    category: ExtraSessionCategory.MIND_BODY,
    met: 3.5,
  },
  mobility: {
    key: 'mobility',
    label: 'Movilidad / Stretching',
    category: ExtraSessionCategory.MIND_BODY,
    met: 2.5,
  },
};
