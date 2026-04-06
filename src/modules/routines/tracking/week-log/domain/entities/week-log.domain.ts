import { addDays } from 'date-fns';
import { Types } from 'mongoose';

export interface WorkoutSessionCreationData {
  _id: string;
  userId: string;
  weekLogId: string;
  date: Date;
  routineDayId?: string;
  exercises: any[];
  status: string;
}

export class WeekLogDayDomain {
  constructor(
    public readonly order: number,
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
    return new WeekLogDayDomain(
      order,
      date,
      isRest,
      workoutSessionId,
      [],
      'pending',
    );
  }
}

export class WeekLogDomain {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly planId: string | null,
    public readonly days: WeekLogDayDomain[],
    public readonly completed: boolean,
    public readonly active: boolean,
    public readonly notes?: string,
  ) {}

  /**
   * Factory method to create a new WeekLog with its initial 7 days.
   * If a plan is provided, it assigns workout sessions to non-rest days.
   */
  // static createInitial(params: {
  //   userId: string;
  //   weekLogId: string;
  //   startDate: Date;
  //   endDate: Date;
  //   planId?: string;
  //   plan?: any;
  // }): {
  //   weekLog: WeekLogDomain;
  //   sessionsToCreate: WorkoutSessionCreationData[];
  // } {
  //   const { userId, weekLogId, startDate, endDate, planId, plan } = params;
  //   const sessionsToCreate: WorkoutSessionCreationData[] = [];

  //   let isRestMap: boolean[] = new Array(7).fill(false);
  //   if (plan?.week?.length === 7) {
  //     isRestMap = plan.week.map((d: any) => d.isRest);
  //   }

  //   const days = Array.from({ length: 7 }).map((_, index) => {
  //     const currentDate = addDays(startDate, index);
  //     let workoutSessionId: string | null = null;

  //     // Logic to assign a workout session if there's a plan and it's not a rest day
  //     if (plan && plan.week && plan.week.length === 7 && !isRestMap[index]) {
  //       const planDay = plan.week[index];
  //       if (planDay && planDay.day) {
  //         const routineDay = planDay.day;

  //         // Generate session ID (this should be handled by the repository or a UUID generator,
  //         // but for consistency with the service, we keep it here or generate it in the repo).
  //         // For now, we'll let the "repository" or "use case" provide the ID if needed,
  //         // or we can generate it here if we consider it a domain responsibility.
  //         // The original service uses `new Types.ObjectId()`.

  //         // We will generate the ID in the use case or let the infra handle it.
  //         // Actually, the original service generates it here to assign it to the day.
  //         // I'll return the sessions to create separately.
  //       }
  //     }

  //     return WeekLogDayDomain.create(
  //       index + 1,
  //       currentDate,
  //       isRestMap[index] ?? false,
  //       null, // We'll update this in the use case or via a session assignment logic
  //     );
  //   });

  //   const weekLog = new WeekLogDomain(
  //     weekLogId,
  //     userId,
  //     startDate,
  //     endDate,
  //     planId || null,
  //     days,
  //     false,
  //     true,
  //   );

  //   return { weekLog, sessionsToCreate };
  // }

  // Refined method to match the service's logic exactly
  static createFromPlan(
    userId: string,
    weekLogId: string,
    startDate: Date,
    endDate: Date,
    planId: string | null,
    plan: any,
  ): { weekLog: WeekLogDomain; sessions: WorkoutSessionCreationData[] } {
    const sessionsToInsert: WorkoutSessionCreationData[] = [];
    let isRestMap: boolean[] = new Array(7).fill(false);

    if (plan?.week?.length === 7) {
      isRestMap = plan.week.map((d) => d.isRest);
    }

    const days: WeekLogDayDomain[] = Array.from({ length: 7 }).map(
      (_, index) => {
        let workoutSessionId: Types.ObjectId | null = null;

        if (plan && plan.week && plan.week.length === 7 && !isRestMap[index]) {
          const planDay = plan.week[index];
          if (planDay && planDay.day) {
            const routineDay = planDay.day;
            const exercises =
              routineDay.exercises?.map((e: any) => ({
                exerciseId: (
                  e.exercise._id ||
                  e.exercise.id ||
                  e.exercise
                ).toString(),
                series: 0,
                sets: [],
              })) || [];

            const sessionObjectId = new Types.ObjectId();
            workoutSessionId = sessionObjectId;
            sessionsToInsert.push({
              _id: sessionObjectId.toString(),
              userId,
              weekLogId,
              date: addDays(startDate, index),
              routineDayId:
                routineDay.id?.toString() || routineDay._id?.toString() || '',
              exercises,
              status: 'not_started',
            });
          }
        }

        return {
          order: index + 1,
          date: addDays(startDate, index),
          isRest: isRestMap[index] ?? false,
          workoutSessionId,
          extraSessionIds: [],
          status: 'pending',
        };
      },
    );

    const weekLog = new WeekLogDomain(
      weekLogId,
      userId,
      startDate,
      endDate,
      planId,
      days,
      false,
      true,
    );

    return { weekLog, sessions: sessionsToInsert };
  }
}
