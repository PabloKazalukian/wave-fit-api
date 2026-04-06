import { addDays } from 'date-fns';
import { Types } from 'mongoose';

export function createInitialDaysAndSessions(
  userId: string,
  weekLogId: string,
  startDate: Date,
  plan?: any,
): {
  days: any[];
  sessionsToInsert: any[];
} {
  const sessionsToInsert: any[] = [];
  let isRestMap: boolean[] = new Array(7).fill(false);

  if (plan?.week?.length === 7) {
    isRestMap = plan.week.map((d) => d.isRest);
  }

  const days = Array.from({ length: 7 }).map((_, index) => {
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
          _id: sessionObjectId,
          userId,
          weekLogId,
          date: addDays(startDate, index),
          routineDayId: routineDay._id.toString(),
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
  });

  return { days, sessionsToInsert };
}
