export class TopExerciseEntryDomain {
  constructor(
    public readonly rank: number,
    public readonly exerciseId: string,
    public readonly name: string,
    public readonly category: string,
    public readonly totalSessions: number,
    public readonly totalVolume: number,
    public readonly avgVolumePerSession: number,
  ) {}
}

export class TopRoutineEntryDomain {
  constructor(
    public readonly rank: number,
    public readonly planId: string,
    public readonly name: string,
    public readonly totalWeeks: number,
    public readonly totalSessions: number,
    public readonly adherenceRate: number,
  ) {}
}

export class PersonalRecordEntryDomain {
  constructor(
    public readonly exerciseId: string,
    public readonly exerciseName: string,
    public readonly category: string,
    public readonly oneRmEstimated: number,
    public readonly bestWeight: number,
    public readonly bestReps: number,
    public readonly bestVolume: number,
    public readonly achievedAt: Date,
    public readonly previousOneRm: number | null,
  ) {}
}

export class AdherenceWeekDomain {
  constructor(
    public readonly weekStartDate: Date,
    public readonly totalDays: number,
    public readonly completedDays: number,
    public readonly skippedDays: number,
    public readonly pendingDays: number,
    public readonly adherencePercent: number,
  ) {}
}

export class UserTopExerciseDomain {
  constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly computedAt: Date,
    public readonly exercises: TopExerciseEntryDomain[],
  ) {}
}

export class UserTopRoutineDomain {
  constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly computedAt: Date,
    public readonly routines: TopRoutineEntryDomain[],
  ) {}
}

export class UserPersonalRecordDomain {
  constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly computedAt: Date,
    public readonly records: PersonalRecordEntryDomain[],
  ) {}
}

export class UserAdherenceDomain {
  constructor(
    public readonly id: string | null,
    public readonly userId: string,
    public readonly computedAt: Date,
    public readonly weeks: AdherenceWeekDomain[],
  ) {}
}

export interface RawWorkoutSessionData {
  _id: string;
  userId: string;
  date: Date;
  routineDayId?: string;
  status: string;
  exercises: {
    exerciseId: string;
    series: number;
    sets: { reps: number; weights?: number }[];
  }[];
}

export interface RawWeekLogData {
  _id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  planId?: string;
  completed: boolean;
  days: {
    order: number;
    date: Date;
    isRest: boolean;
    status: string;
  }[];
}

export interface RawExerciseData {
  _id: string;
  name: string;
  category: string;
  usesWeight: boolean;
}

export interface RawRoutinePlanData {
  _id: string;
  name: string;
  description: string;
  createdBy?: string;
}

export interface RawStrengthMetricData {
  _id: string;
  exerciseKey: string;
  oneRmKg: number;
  measuredAt: Date;
}

export interface WorkerRawDataDomain {
  workoutSessions: RawWorkoutSessionData[];
  weekLogs: RawWeekLogData[];
  exercises: RawExerciseData[];
  routinePlans: RawRoutinePlanData[];
  strengthMetrics: RawStrengthMetricData[];
}
