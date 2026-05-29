import { Types } from 'mongoose';
import { LocalDate, localDateToUtc, addDaysToLocalDate } from 'src/common/utils/date.utils';

export interface WorkoutSessionCreationData {
  _id: Types.ObjectId;
  userId: string;
  weekLogId: string;
  /** Date UTC para guardar en MongoDB — derivado de LocalDate + timezone */
  date: Date;
  routineDayId?: string;
  exercises: any[];
  status: string;
}

export class WeekLogDayDomain {
  public readonly order: number;
  public readonly date: Date;
  private _isRest: boolean;
  private _workoutSessionId: Types.ObjectId | null;
  private _extraSessionIds: string[];
  private _status: string;
  public readonly exercises: any[];

  constructor(
    order: number,
    date: Date,
    isRest: boolean,
    workoutSessionId: Types.ObjectId | null,
    extraSessionIds: string[],
    status: string,
    exercises: any[] = [],
  ) {
    this.order = order;
    this.date = date;
    this._isRest = isRest;
    this._workoutSessionId = workoutSessionId;
    this._extraSessionIds = extraSessionIds;
    this._status = status;
    this.exercises = exercises;
  }

  get isRest(): boolean {
    return this._isRest;
  }

  set isRest(value: boolean) {
    this._isRest = value;
  }

  get workoutSessionId(): Types.ObjectId | null {
    return this._workoutSessionId;
  }

  set workoutSessionId(value: Types.ObjectId | null) {
    this._workoutSessionId = value;
  }

  get extraSessionIds(): string[] {
    return this._extraSessionIds;
  }

  set extraSessionIds(value: string[]) {
    this._extraSessionIds = value;
  }

  get status(): string {
    return this._status;
  }

  set status(value: string) {
    this._status = value;
  }

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
  public readonly id: string;
  public readonly userId: string;
  public readonly startDate: Date;
  public readonly endDate: Date;
  public readonly planId: string | null;
  public readonly days: WeekLogDayDomain[];
  private _completed: boolean;
  private _active: boolean;
  private _notes?: string;

  constructor(
    id: string,
    userId: string,
    startDate: Date,
    endDate: Date,
    planId: string | null,
    days: WeekLogDayDomain[],
    completed: boolean,
    active: boolean,
    notes?: string,
  ) {
    this.id = id;
    this.userId = userId;
    this.startDate = startDate;
    this.endDate = endDate;
    this.planId = planId;
    this.days = days;
    this._completed = completed;
    this._active = active;
    this._notes = notes;
  }

  get completed(): boolean {
    return this._completed;
  }

  set completed(value: boolean) {
    this._completed = value;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    this._active = value;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  set notes(value: string | undefined) {
    this._notes = value;
  }

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
            _id: sessionObjectId,
            userId,
            weekLogId,
            date: dayUtcDate, // ✅ Date UTC derivada del LocalDate del usuario
            routineDayId: routineDay.id?.toString() || routineDay._id?.toString() || '',
            exercises,
            status: 'not_started',
          });
        }
      }

      return new WeekLogDayDomain(
        index + 1,
        dayUtcDate,
        isRestMap[index] ?? false,
        workoutSessionId,
        [],
        'pending',
      );
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
