export declare enum ExtraSessionCategory {
    CARDIO = "cardio",
    STRENGTH = "strength",
    SPORT = "sport",
    MIND_BODY = "mind_body"
}
export type ExtraSessionDisciplineKey = 'running' | 'cycling' | 'stationary_bike' | 'swimming' | 'walking' | 'weightlifting' | 'crossfit' | 'football' | 'basketball' | 'tennis' | 'yoga' | 'pilates' | 'mobility';
export interface ExtraSessionDisciplineConfig {
    key: ExtraSessionDisciplineKey;
    label: string;
    category: ExtraSessionCategory;
    met: number;
}
export declare const EXTRA_SESSION_DISCIPLINES: Record<ExtraSessionDisciplineKey, ExtraSessionDisciplineConfig>;
export interface CreateExtraSessionWithoutWsInput {
    date: string;
    discipline: string;
    duration: number;
    intensityLevel: number;
    calories?: number;
    notes?: string;
}
export interface UpdateWeekLogDayExtraSessionInput {
    order: number;
    extraSession: CreateExtraSessionWithoutWsInput;
}
export interface UpdateWeekLogExtraSessionInput {
    id: string;
    days: UpdateWeekLogDayExtraSessionInput[];
}
export interface CreateExtraSessionInput {
    workoutSessionId: string;
    date: string;
    discipline: string;
    duration: number;
    intensityLevel: number;
    calories?: number;
    notes?: string;
}
export interface UpdateExtraSessionInput {
    id: string;
    discipline?: string;
    date?: string;
    duration?: number;
    intensityLevel?: number;
    calories?: number;
    notes?: string;
}
export interface ExtraSession {
    id: string;
    userId: string;
    workoutSessionId: string;
    category: ExtraSessionCategory;
    discipline: string;
    date: string | Date;
    duration: number;
    intensityLevel: number;
    calories?: number;
    notes?: string;
}
export interface WeekLogDay {
    order: number;
    date: Date;
    isRest: boolean;
    workoutSessionId?: string | null;
    extraSessionIds: string[];
    status: 'pending' | 'complete' | 'skipped';
}
export interface WeekLog {
    id: string;
    userId: string;
    startDate: Date;
    endDate: Date;
    planId?: string;
    days: WeekLogDay[];
    completed: boolean;
    active: boolean;
    notes?: string;
}
export declare const EXAMPLE_UPDATE_WEEKLOG_EXTRASESSION_PAYLOAD: {
    updateWeekLogInput: {
        id: string;
        days: {
            order: number;
            extraSession: {
                date: string;
                discipline: string;
                duration: number;
                intensityLevel: number;
                calories: number;
            };
        }[];
    };
};
export declare function calculateCalories(met: number, weightKg: number | undefined, durationMinutes: number, intensityLevel: number): number;
export declare function isValidCaloriesOverride(inputCalories: number, calculatedCalories: number): boolean;
