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

export const FIND_ACTIVE_WEEK_LOG = `
    query findActiveWeekLog {
        activeWeekLog {
            hasActiveWeek
            week {
                id
                startDate
                endDate
                userId
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
                planId
                notes
                completed
            }
        }
    }
`;

export const CREATE_WORKOUT_SESSION = `
    mutation CreateWorkoutSession($input: CreateWorkoutSessionInput!) {
        createWorkoutSession(createWorkoutSessionInput: $input) {
            weekLogId
            date
            routineDayId
            exercises {
                exerciseId
                series
                sets {
                    weights
                    reps
                }
                notes
            }
            status
            notes
        }
    }
`;

export const CREATE_WEEK_LOG = `
    mutation CreateWeekLog($input: CreateWeekLogInput!) {
        createWeekLog(createWeekLogInput: $input) {
            id
            startDate
            endDate
            userId
            days {
                order
                date
                isRest
                workoutSessionId
                extraSessionIds
                status
            }
            planId
            notes
            completed
        }
    }
`;

export const UPDATE_WEEK_LOG = `
    mutation UpdateWeekLog($updateWeekLogInput: UpdateWeekLogInput!) {
        updateWeekLog(input: $updateWeekLogInput) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const UPDATE_WEEK_LOG_DAY = `
    mutation UpdateWeekLogDay($input: UpdateWeekLogInput!) {
        updateWeekLog(input: $input) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const SYNC_WEEK_LOG_DAYS = `
    mutation SyncWeekLogDays($weekLogId: String!) {
        syncWeekLogDays(weekLogId: $weekLogId) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const ASSIGN_ROUTINE_TO_DAY = `
    mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
        assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const REMOVE_WORKOUT_SESSION_FROM_DAY = `
    mutation RemoveWorkoutSessionFromDay($input: RemoveWorkoutSessionFromDayInput!) {
        removeWorkoutSessionFromDay(input: $input) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const FIND_ALL_TRACKING_BY_USER = `
    query findAll {
        findAll {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const FIND_BY_ID = `
    query findOne($id: String!) {
        findOne(id: $id) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const CURRENT_WORKOUT_SESSION = `
    query currentWorkoutSession {
        currentWorkoutSession {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const UPDATE_DAY = `
    mutation UpdateDay($input: UpdateWeekLogDayUnifiedInput!) {
        updateDay(input: $input) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const UPDATE_WEEK_LOG_WORKOUT_SESSION = `
    mutation UpdateWeekLogWorkoutSession($input: UpdateWeekLogWorkoutSessionInput!) {
        updateWeekLogWorkoutSession(updateWeekLogInput: $input) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const UPDATE_WEEK_LOG_EXTRA_SESSION = `
    mutation UpdateWeekLogExtraSession($input: UpdateWeekLogExtraSessionInput!) {
        updateWeekLogExtraSession(updateWeekLogInput: $input) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const REMOVE_WEEK_LOG = `
    mutation RemoveWeekLog($id: String!) {
        removeWeekLog(id: $id) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;

export const CREATE_EXTRA_SESSION = `
    mutation CreateExtraSession($input: UpdateWeekLogDayUnifiedInput!) {
        updateDay(input: $input) {
            ${WEEK_LOG_FIELDS}
        }
    }
`;
