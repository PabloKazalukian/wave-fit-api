export interface ChartSet {
  reps: number;
  weights?: number;
}

export interface ChartExercisePerformance {
  exerciseId: string;
  series: number;
  sets: ChartSet[];
}

export interface ChartWorkoutSession {
  _id: string;
  userId: string;
  date: Date;
  status: string;
  exercises: ChartExercisePerformance[];
}

export interface ChartExercise {
  _id: string;
  name: string;
  category: string;
  usesWeight?: boolean;
}

export interface ChartWeekLogDay {
  order: number;
  date: Date;
  isRest: boolean;
  workoutSessionId?: string | null;
  extraSessionIds: string[];
  status: string;
}

export interface ChartWeekLog {
  _id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  planId?: string | null;
  completed: boolean;
  active: boolean;
  days: ChartWeekLogDay[];
}

export interface ChartDayLog {
  _id: string;
  userId: string;
  date: Date;
  planId?: string | null;
  routineDayId?: string | null;
  workoutSessionId?: string | null;
  extraSessionIds: string[];
  active: boolean;
  completed: boolean;
  status: string;
}

export interface ChartExtraSession {
  _id: string;
  userId: string;
  workoutSessionId: string;
  discipline: string;
  date: Date;
  duration: number;
  intensityLevel: number;
  calories?: number | null;
}

export interface ChartWeightLog {
  _id: string;
  userId: string;
  weightKg: number;
  loggedAt: Date;
}

export interface ChartUserProfile {
  userId: string;
  weightKg?: number | null;
}

export interface ChartRoutinePlan {
  _id: string;
  week: {
    day?: string | null;
    isRest: boolean;
    order: number;
  }[];
}

export interface ChartRoutineDay {
  _id: string;
  title: string;
  type: string[];
}