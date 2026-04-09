/**
 * ExtraSession - Referencias de Tipos TypeScript
 * 
 * Este archivo contiene los tipos utilizados en el flujo de ExtraSession via WeekLog.
 * Ubicación: `wave-fit-api/documents/interfaces/extra-session.types.ts`
 */

// ============================================================================
// CATÁLOGO
// ============================================================================

export enum ExtraSessionCategory {
  CARDIO = 'cardio',
  STRENGTH = 'strength',
  SPORT = 'sport',
  MIND_BODY = 'mind_body',
}

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

export interface ExtraSessionDisciplineConfig {
  key: ExtraSessionDisciplineKey;
  label: string;
  category: ExtraSessionCategory;
  met: number;
}

export const EXTRA_SESSION_DISCIPLINES: Record<
  ExtraSessionDisciplineKey,
  ExtraSessionDisciplineConfig
> = {
  running: { key: 'running', label: 'Running', category: ExtraSessionCategory.CARDIO, met: 8 },
  cycling: { key: 'cycling', label: 'Ciclismo', category: ExtraSessionCategory.CARDIO, met: 7.5 },
  stationary_bike: { key: 'stationary_bike', label: 'Bicicleta fija', category: ExtraSessionCategory.CARDIO, met: 7 },
  swimming: { key: 'swimming', label: 'Natación', category: ExtraSessionCategory.CARDIO, met: 8 },
  walking: { key: 'walking', label: 'Caminata', category: ExtraSessionCategory.CARDIO, met: 3.5 },
  weightlifting: { key: 'weightlifting', label: 'Levantamiento de pesas', category: ExtraSessionCategory.STRENGTH, met: 5 },
  crossfit: { key: 'crossfit', label: 'CrossFit', category: ExtraSessionCategory.STRENGTH, met: 9 },
  football: { key: 'football', label: 'Fútbol', category: ExtraSessionCategory.SPORT, met: 8 },
  basketball: { key: 'basketball', label: 'Básquet', category: ExtraSessionCategory.SPORT, met: 7.5 },
  tennis: { key: 'tennis', label: 'Tenis', category: ExtraSessionCategory.SPORT, met: 7 },
  yoga: { key: 'yoga', label: 'Yoga', category: ExtraSessionCategory.MIND_BODY, met: 3 },
  pilates: { key: 'pilates', label: 'Pilates', category: ExtraSessionCategory.MIND_BODY, met: 3.5 },
  mobility: { key: 'mobility', label: 'Movilidad / Stretching', category: ExtraSessionCategory.MIND_BODY, met: 2.5 },
};

// ============================================================================
// INPUTS GraphQL - Via WeekLog
// ============================================================================

/**
 * Input para crear una ExtraSession SIN workoutSessionId
 * (la WS se crea automaticamente en el flujo de WeekLog)
 */
export interface CreateExtraSessionWithoutWsInput {
  date: string;                  // ISO date string
  discipline: string;             // Clave de disciplina (ej: "running")
  duration: number;              // Minutos (min: 1)
  intensityLevel: number;        // 1-5
  calories?: number;             // Opcional, override de calorías
  notes?: string;                 // Opcional
}

/**
 * Input para actualizar un día del WeekLog con una ExtraSession
 */
export interface UpdateWeekLogDayExtraSessionInput {
  order: number;                  // Día del 1-7
  extraSession: CreateExtraSessionWithoutWsInput;
}

/**
 * Input principal para la mutation updateWeekLogExtraSession
 */
export interface UpdateWeekLogExtraSessionInput {
  id: string;                     // WeekLog ID
  days: UpdateWeekLogDayExtraSessionInput[];
}

// ============================================================================
// INPUTS GraphQL - Directos (sin WeekLog)
// ============================================================================

/**
 * Input para crear ExtraSession directamente (con workoutSessionId)
 */
export interface CreateExtraSessionInput {
  workoutSessionId: string;
  date: string;
  discipline: string;
  duration: number;
  intensityLevel: number;
  calories?: number;
  notes?: string;
}

/**
 * Input para actualizar ExtraSession
 */
export interface UpdateExtraSessionInput {
  id: string;
  discipline?: string;
  date?: string;
  duration?: number;
  intensityLevel?: number;
  calories?: number;
  notes?: string;
}

// ============================================================================
// MODELOS (MongoDB / GraphQL)
// ============================================================================

/**
 * ExtraSession - Modelo completo
 */
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

/**
 * WeekLogDay - Estructura del día en WeekLog
 */
export interface WeekLogDay {
  order: number;
  date: Date;
  isRest: boolean;
  workoutSessionId?: string | null;
  extraSessionIds: string[];
  status: 'pending' | 'complete' | 'skipped';
}

/**
 * WeekLog - Estructura del registro semanal
 */
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

// ============================================================================
// EJEMPLO DE PAYLOAD
// ============================================================================

/**
 * Ejemplo de payload para mutation updateWeekLogExtraSession
 */
export const EXAMPLE_UPDATE_WEEKLOG_EXTRASESSION_PAYLOAD = {
  updateWeekLogInput: {
    id: "675f3c8b1234567890abcdef",
    days: [
      {
        order: 3,
        extraSession: {
          date: "2026-04-09T10:00:00.000Z",
          discipline: "running",
          duration: 30,
          intensityLevel: 3,
          calories: 280
        }
      }
    ]
  }
};

// ============================================================================
// FÓRMULA DE CÁLCULO DE CALORÍAS
// ============================================================================

/**
 * Calcula las calorías basadas en la fórmula MET
 * 
 * @param met - Valor MET de la disciplina
 * @param weightKg - Peso corporal (default: 70)
 * @param durationMinutes - Duración en minutos
 * @param intensityLevel - Nivel de intensidad (1-5)
 * @returns Calorías calculadas
 */
export function calculateCalories(
  met: number,
  weightKg: number = 70,
  durationMinutes: number,
  intensityLevel: number
): number {
  const hours = durationMinutes / 60;
  const intensityFactor = 1 + (intensityLevel - 3) * 0.15;
  const adjustedMet = met * intensityFactor;
  return Math.round(adjustedMet * weightKg * hours);
}

/**
 * Validar override de calorías
 * 
 * @param inputCalories - Calorías ingresadas por el usuario
 * @param calculatedCalories - Calorías calculadas por el sistema
 * @returns true si el override es válido (diferencia <= 400 kcal)
 */
export function isValidCaloriesOverride(
  inputCalories: number,
  calculatedCalories: number
): boolean {
  return Math.abs(inputCalories - calculatedCalories) <= 400;
}