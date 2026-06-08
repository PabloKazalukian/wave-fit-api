export interface UserContextInput {
  profile?: {
    sex: string;
    birthDate: Date;
    heightCm: number;
    weightKg: number;
    bodyFatPct?: number | null;
  };
  goal?: {
    primaryGoal: string;
    secondaryGoals: string[];
    targetWeightKg?: number | null;
    timelineWeeks?: number | null;
    trainingExperience: string;
    sportSpecificity?: string | null;
  } | null;
  strengthMetrics?: Array<{
    exerciseKey: string;
    oneRmKg: number;
    confidenceLevel: string;
    measuredAt: Date;
  }>;
  resource?: {
    trainingEnvironments: string[];
    equipment: Record<string, boolean>;
    dumbbellMaxKg?: number | null;
    gymDistanceKm?: number | null;
  } | null;
  schedule?: {
    daysPerWeek: number;
    preferredDays: number[];
    sessionDurationMin: number;
    preferredTime?: string | null;
    restDayActivity: string;
  } | null;
  health?: {
    injuries: Array<{
      bodyPart: string;
      severity: string;
      isActive: boolean;
      description?: string | null;
    }>;
    movementRestrictions: string[];
    conditions: string[];
    mobilityLevel: string;
    hasHealthcareSupervision: boolean;
  } | null;
  preferences?: {
    preferredStyles: string[];
    dislikedExercises: string[];
    favoriteExercises: string[];
    cardioPreference: string;
    intensityPreference: string;
    workoutVibe?: string | null;
  } | null;
}

export function estimateOneRm(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 100) / 100;
}

export function bmrMifflinStJeor(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: string,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  const adjustment = sex === 'M' ? 5 : -161;
  return Math.round(base + adjustment);
}

//arreglar el Type de input, obtendra el profile completo.
export function buildUserContextForAI(input: any): Record<string, unknown> {
  const ctx: Record<string, unknown> = {};

  if (input.profile) {
    const ageYears = Math.floor(
      (Date.now() - new Date(input.profile.birthDate).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000),
    );
    ctx.biometrics = {
      sex: input.profile.sex,
      age: ageYears,
      heightCm: input.profile.heightCm,
      weightKg: input.profile.weightKg,
      bodyFatPct: input.profile.bodyFatPct ?? null,
      bmr: bmrMifflinStJeor(
        input.profile.weightKg,
        input.profile.heightCm,
        ageYears,
        input.profile.sex,
      ),
    };
  }

  if (input.goal) {
    ctx.goal = {
      primary: input.goal.primaryGoal,
      secondary: input.goal.secondaryGoals,
      targetWeightKg: input.goal.targetWeightKg ?? null,
      timelineWeeks: input.goal.timelineWeeks ?? null,
      experience: input.goal.trainingExperience,
      sport: input.goal.sportSpecificity ?? null,
    };
  }

  if (input.strengthMetrics && input.strengthMetrics.length > 0) {
    const latestByExercise = new Map<
      string,
      (typeof input.strengthMetrics)[0]
    >();
    for (const m of input.strengthMetrics) {
      const existing = latestByExercise.get(m.exerciseKey);
      if (!existing || m.measuredAt > existing.measuredAt) {
        latestByExercise.set(m.exerciseKey, m);
      }
    }
    ctx.strengthProfile = Object.fromEntries(
      Array.from(latestByExercise.entries()).map(([key, val]) => [
        key,
        { oneRmKg: val.oneRmKg, confidence: val.confidenceLevel },
      ]),
    );
  }

  if (input.resource) {
    ctx.resources = {
      environments: input.resource.trainingEnvironments,
      equipment: input.resource.equipment,
      dumbbellMaxKg: input.resource.dumbbellMaxKg ?? null,
      gymDistanceKm: input.resource.gymDistanceKm ?? null,
    };
  }

  if (input.schedule) {
    ctx.schedule = {
      daysPerWeek: input.schedule.daysPerWeek,
      preferredDays: input.schedule.preferredDays,
      sessionDurationMin: input.schedule.sessionDurationMin,
      preferredTime: input.schedule.preferredTime ?? null,
      restDayActivity: input.schedule.restDayActivity,
    };
  }

  if (input.health) {
    ctx.health = {
      activeInjuries: input.health.injuries.filter((i) => i.isActive),
      movementRestrictions: input.health.movementRestrictions,
      conditions: input.health.conditions,
      mobilityLevel: input.health.mobilityLevel,
      supervised: input.health.hasHealthcareSupervision,
    };
  }

  if (input.preferences) {
    ctx.preferences = {
      styles: input.preferences.preferredStyles,
      disliked: input.preferences.dislikedExercises,
      favorite: input.preferences.favoriteExercises,
      cardio: input.preferences.cardioPreference,
      intensity: input.preferences.intensityPreference,
      vibe: input.preferences.workoutVibe ?? null,
    };
  }

  return ctx;
}
