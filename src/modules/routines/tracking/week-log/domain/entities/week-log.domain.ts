import { Types } from 'mongoose';
import { LocalDate, localDateToUtc, addDaysToLocalDate } from 'src/common/utils/date.utils';

export interface WorkoutSessionCreationData {
  _id: string;
  userId: string;
  weekLogId: string;
  /** Date UTC para guardar en MongoDB — derivado de LocalDate + timezone */
  date: Date;
  routineDayId?: string;
  exercises: any[];
  status: string;
}

export class WeekLogDayDomain {
  constructor(
    public readonly order: number,
    /** Date UTC almacenado en MongoDB */
    public readonly date: Date,
    public readonly isRest: boolean,
    public workoutSessionId: Types.ObjectId | null,
    public readonly extraSessionIds: string[],
    public status: string,
  ) {}

  static create(
    order: number,
    date: Date,
    isRest: boolean,
    workoutSessionId: Types.ObjectId | null = null,
  ): WeekLogDayDomain {
    return new WeekLogDayDomain(order, date, isRest, workoutSessionId, [], 'pending');
  }
}

export class WeekLogDomain {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    /** Date UTC almacenado en MongoDB — derivado de startDate LocalDate + timezone */
    public readonly startDate: Date,
    /** Date UTC almacenado en MongoDB */
    public readonly endDate: Date,
    public readonly planId: string | null,
    public readonly days: WeekLogDayDomain[],
    public readonly completed: boolean,
    public readonly active: boolean,
    public readonly notes?: string,
  ) {}

  /**
   * Factory method — crea el WeekLog + WorkoutSessions iniciales.
   *
   * @param startDate LocalDate "yyyy-MM-dd" (fecha calendario del usuario)
   * @param endDate   LocalDate "yyyy-MM-dd"
   * @param timezone  IANA timezone del usuario (ej: "America/Argentina/Buenos_Aires")
   *
   * Almacenamiento:
   *   - startDate/endDate en MongoDB: Date UTC = inicio del día en la timezone del usuario
   *   - days[].date en MongoDB: Date UTC del inicio del día para cada día de la semana
   *   - Los WorkoutSession.date también se guardan como Date UTC
   */
  static createFromPlan(
    userId: string,
    weekLogId: string,
    startDate: LocalDate,
    endDate: LocalDate,
    timezone: string,
    planId: string | null,
    plan: any,
  ): { weekLog: WeekLogDomain; sessions: WorkoutSessionCreationData[] } {
    const sessionsToInsert: WorkoutSessionCreationData[] = [];
    let isRestMap: boolean[] = new Array(7).fill(false);

    if (plan?.week?.length === 7) {
      isRestMap = plan.week.map((d) => d.isRest);
    }

    const days: WeekLogDayDomain[] = Array.from({ length: 7 }).map((_, index) => {
      // Avanzar N días desde startDate como LocalDate, luego convertir a UTC para Mongo
      const dayLocalDate: LocalDate = addDaysToLocalDate(startDate, index);
      const dayUtcDate: Date = localDateToUtc(dayLocalDate, timezone);

      let workoutSessionId: Types.ObjectId | null = null;

      if (plan && plan.week && plan.week.length === 7 && !isRestMap[index]) {
        const planDay = plan.week[index];
        if (planDay && planDay.day) {
          const routineDay = planDay.day;
          const exercises =
            routineDay.exercises?.map((e: any) => ({
              exerciseId: (e.exercise._id || e.exercise.id || e.exercise).toString(),
              series: 0,
              sets: [],
            })) || [];

          const sessionObjectId = new Types.ObjectId();
          workoutSessionId = sessionObjectId;
          sessionsToInsert.push({
            _id: sessionObjectId.toString(),
            userId,
            weekLogId,
            date: dayUtcDate, // ✅ Date UTC derivada del LocalDate del usuario
            routineDayId: routineDay.id?.toString() || routineDay._id?.toString() || '',
            exercises,
            status: 'not_started',
          });
        }
      }

      return {
        order: index + 1,
        date: dayUtcDate, // ✅ Date UTC para Mongo
        isRest: isRestMap[index] ?? false,
        workoutSessionId,
        extraSessionIds: [],
        status: 'pending',
      };
    });

    const weekLog = new WeekLogDomain(
      weekLogId,
      userId,
      localDateToUtc(startDate, timezone), // ✅ startDate como Date UTC para Mongo
      localDateToUtc(endDate, timezone),   // ✅ endDate como Date UTC para Mongo
      planId,
      days,
      false,
      true,
    );

    return { weekLog, sessions: sessionsToInsert };
  }
}
