export const WEEK_LOG_DAY_TYPE = {
  order: expect.any(Number),
  date: expect.any(String),
  isRest: expect.any(Boolean),
  workoutSessionId: expect.anything(),
  extraSessionIds: expect.any(Array),
  status: expect.any(String),
};

export const WEEK_LOG_TYPE = {
  id: expect.any(String),
  userId: expect.any(String),
  startDate: expect.any(String),
  endDate: expect.any(String),
  planId: expect.anything(),
  notes: expect.anything(),
  completed: expect.any(Boolean),
  active: expect.any(Boolean),
  days: expect.arrayContaining([expect.objectContaining(WEEK_LOG_DAY_TYPE)]),
};

export const ACTIVE_WEEK_LOG_RESPONSE_TYPE = {
  hasActiveWeek: expect.any(Boolean),
  week: expect.anything(),
};

export const WEEK_LOG_FIELDS = `
  id
  userId
  startDate
  endDate
  planId
  notes
  completed
  active
  days {
    order
    date
    isRest
    workoutSessionId
    exercises {
      exerciseId
      series
      sets {
        weights
        reps
      }
      notes
    }
    extraSessionIds
    status
  }
`;
