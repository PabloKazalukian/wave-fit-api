export type DayLogStatus = 'pending' | 'complete' | 'skipped';

export interface WorkoutSessionCreationData {
  _id: string;
  userId: string;
  dayLogId?: string;
  /** Date UTC para guardar en MongoDB — derivado de LocalDate + timezone */
  date: Date;
  routineDayId?: string;
  exercises: any[];
  status: string;
  weekLogId?: string | null;
}

export class DayLogDomain {
  public readonly id: string;
  public readonly userId: string;
  public readonly date: Date;
  public readonly planId: string | null;
  public readonly routineDayId: string | null;
  private _workoutSessionId: string | null;
  private _extraSessionIds: string[];
  private _status: DayLogStatus;
  private _active: boolean;
  private _completed: boolean;
  private _notes?: string;
  public readonly exercises: any[];

  constructor(
    id: string,
    userId: string,
    date: Date,
    planId: string | null,
    routineDayId: string | null,
    workoutSessionId: string | null,
    extraSessionIds: string[],
    status: DayLogStatus,
    active: boolean,
    completed: boolean,
    notes?: string,
    exercises: any[] = [],
  ) {
    this.id = id;
    this.userId = userId;
    this.date = date;
    this.planId = planId;
    this.routineDayId = routineDayId;
    this._workoutSessionId = workoutSessionId;
    this._extraSessionIds = extraSessionIds;
    this._status = status;
    this._active = active;
    this._completed = completed;
    this._notes = notes;
    this.exercises = exercises;
  }

  get workoutSessionId(): string | null {
    return this._workoutSessionId;
  }

  set workoutSessionId(value: string | null) {
    this._workoutSessionId = value;
  }

  get extraSessionIds(): string[] {
    return this._extraSessionIds;
  }

  set extraSessionIds(value: string[]) {
    this._extraSessionIds = value;
  }

  get status(): DayLogStatus {
    return this._status;
  }

  set status(value: DayLogStatus) {
    this._status = value;
  }

  get active(): boolean {
    return this._active;
  }

  set active(value: boolean) {
    this._active = value;
  }

  get completed(): boolean {
    return this._completed;
  }

  set completed(value: boolean) {
    this._completed = value;
  }

  get notes(): string | undefined {
    return this._notes;
  }

  set notes(value: string | undefined) {
    this._notes = value;
  }

  static create(
    id: string,
    userId: string,
    dateUtc: Date,
    planId: string | null = null,
    routineDayId: string | null = null,
  ): DayLogDomain {
    return new DayLogDomain(
      id,
      userId,
      dateUtc,
      planId,
      routineDayId,
      null,
      [],
      'pending',
      true,
      false,
      '',
    );
  }
}
