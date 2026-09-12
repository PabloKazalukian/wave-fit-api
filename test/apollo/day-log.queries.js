export const DAY_LOG_FIELDS = `
    id
    userId
    date
    planId
    routineDayId
    workoutSessionId
    exercises {
        exerciseId
        series
        sets {
            reps
            weights
        }
        notes
    }
    extraSessionIds
    status
    active
    completed
    notes
`;

export const CREATE_DAY_LOG = `
    mutation CreateDayLog($input: CreateDayLogInput!) {
        createDayLog(createDayLogInput: $input) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const DAY_LOG_FIND_ALL = `
    query dayLogFindAll($limit: Int, $offset: Int) {
        dayLogFindAll(limit: $limit, offset: $offset) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const DAY_LOG_FIND_ONE = `
    query dayLogFindOne($id: String!) {
        dayLogFindOne(id: $id) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const ACTIVE_DAY_LOG = `
    query findActiveDayLog {
        activeDayLog {
            hasActiveDay
            day {
                ${DAY_LOG_FIELDS}
            }
        }
    }
`;

export const UPDATE_DAY_LOG = `
    mutation UpdateDayLog($input: UpdateDayLogInput!) {
        updateDayLog(input: $input) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const UPDATE_DAY_LOG_STATUS = `
    mutation UpdateDayLogStatus($date: String!, $isRest: Boolean!) {
        updateDayLogStatus(date: $date, isRest: $isRest) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const ASSIGN_ROUTINE_TO_DAY_LOG = `
    mutation AssignRoutineToDayLog($routineDayId: String!, $date: String!) {
        assignRoutineToDayLog(routineDayId: $routineDayId, date: $date) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const REMOVE_WORKOUT_SESSION_FROM_DAY_LOG = `
    mutation RemoveWorkoutSessionFromDayLog($workoutSessionId: String!) {
        removeWorkoutSessionFromDayLog(workoutSessionId: $workoutSessionId) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const REMOVE_EXTRA_SESSION_FROM_DAY_LOG = `
    mutation RemoveExtraSessionFromDayLog($extraSessionId: String!) {
        removeExtraSessionFromDayLog(extraSessionId: $extraSessionId) {
            ${DAY_LOG_FIELDS}
        }
    }
`;

export const REMOVE_DAY_LOG = `
    mutation RemoveDayLog($id: String!) {
        removeDayLog(id: $id) {
            id
        }
    }
`;

export const ACTIVE_TRACKING = `
    query activeTracking {
        activeTracking {
            hasActive
            type
            week { id }
            day { id }
        }
    }
`;
