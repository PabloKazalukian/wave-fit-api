export const USER_PROFILE_FIELDS = `
    id
    userId
    gender
    birthDate
    heightCm
    weightKg
    bodyFatPct
    unitsPreference
    createdAt
    updatedAt
`;

export const GOAL_FIELDS = `
    _id
    userId
    primaryGoal
    secondaryGoals
    targetWeightKg
    timelineWeeks
    trainingExperience
    sportSpecificity
    isActive
    createdAt
    updatedAt
`;

export const HEALTH_CONSTRAINT_FIELDS = `
    _id
    userId
    injuries {
        bodyPart
        severity
        isActive
        description
    }
    movementRestrictions
    conditions
    mobilityLevel
    hasHealthcareSupervision
    createdAt
    updatedAt
`;

export const SCHEDULE_FIELDS = `
    _id
    userId
    daysPerWeek
    preferredDays
    sessionDurationMin
    preferredTime
    restDayActivity
    createdAt
    updatedAt
`;

export const TRAINING_PREFERENCE_FIELDS = `
    _id
    userId
    preferredStyles
    dislikedExercises
    favoriteExercises
    cardioPreference
    intensityPreference
    workoutVibe
    createdAt
    updatedAt
`;

export const RESOURCE_FIELDS = `
    _id
    userId
    trainingEnvironments
    equipment {
        barbell
        squat_rack
        power_rack
        cables
        smith_machine
        leg_press
        dumbbells
        kettlebells
        resistance_bands
        pullup_bar
        dip_bars
        trx
        treadmill
        stationary_bike
        rowing_machine
        elliptical
        jump_rope
        ab_wheel
        foam_roller
    }
    dumbbellMaxKg
    gymDistanceKm
    createdAt
    updatedAt
`;

export const STRENGTH_METRIC_FIELDS = `
    _id
    userId
    exerciseKey
    oneRmKg
    repsAtWeight {
        weightKg
        reps
    }
    confidenceLevel
    measuredAt
    notes
    createdAt
    updatedAt
`;

export const WEIGHT_LOG_FIELDS = `
    _id
    userId
    weightKg
    bodyFatPct
    loggedAt
    notes
    createdAt
    updatedAt
`;

export const USER_PROFILE_CONTEXT_FIELDS = `
    profile {
        ${USER_PROFILE_FIELDS}
    }
    goal {
        ${GOAL_FIELDS}
    }
    healthConstraints {
        ${HEALTH_CONSTRAINT_FIELDS}
    }
    schedule {
        ${SCHEDULE_FIELDS}
    }
    trainingPreferences {
        ${TRAINING_PREFERENCE_FIELDS}
    }
    resources {
        ${RESOURCE_FIELDS}
    }
    strengthMetrics {
        ${STRENGTH_METRIC_FIELDS}
    }
    weightLogs {
        ${WEIGHT_LOG_FIELDS}
    }
`;

// ── Queries ──

export const FIND_ALL_USER_PROFILES = `
    query userProfiles {
        userProfiles {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const FIND_USER_PROFILE = `
    query userProfile($id: String!) {
        userProfile(id: $id) {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const MY_PROFILE = `
    query myProfile {
        myProfile {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const USER_PROFILE_CONTEXT = `
    query userProfileContext {
        userProfileContext {
            ${USER_PROFILE_CONTEXT_FIELDS}
        }
    }
`;

export const USER_GOALS = `
    query userGoals {
        userGoals {
            ${GOAL_FIELDS}
        }
    }
`;

export const USER_HEALTH_CONSTRAINTS = `
    query userHealthConstraints {
        userHealthConstraints {
            ${HEALTH_CONSTRAINT_FIELDS}
        }
    }
`;

export const USER_SCHEDULE = `
    query userSchedule {
        userSchedule {
            ${SCHEDULE_FIELDS}
        }
    }
`;

export const USER_TRAINING_PREFERENCE = `
    query userTrainingPreference {
        userTrainingPreference {
            ${TRAINING_PREFERENCE_FIELDS}
        }
    }
`;

export const USER_RESOURCE = `
    query userResource {
        userResource {
            ${RESOURCE_FIELDS}
        }
    }
`;

export const USER_STRENGTH_METRICS = `
    query userStrengthMetrics {
        userStrengthMetrics {
            ${STRENGTH_METRIC_FIELDS}
        }
    }
`;

export const USER_WEIGHT_LOGS = `
    query userWeightLogs {
        userWeightLogs {
            ${WEIGHT_LOG_FIELDS}
        }
    }
`;

// ── Mutations ──

export const CREATE_USER_PROFILE = `
    mutation CreateUserProfile($input: CreateUserProfileInput!) {
        createUserProfile(createUserProfileInput: $input) {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const UPDATE_USER_PROFILE = `
    mutation UpdateUserProfile($input: UpdateUserProfileInput!) {
        updateUserProfile(updateUserProfileInput: $input) {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const UPSERT_USER_PROFILE = `
    mutation UpsertUserProfile($input: CreateUserProfileInput!) {
        upsertUserProfile(createUserProfileInput: $input) {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const REMOVE_USER_PROFILE = `
    mutation RemoveUserProfile($id: String!) {
        removeUserProfile(id: $id) {
            ${USER_PROFILE_FIELDS}
        }
    }
`;

export const UPDATE_USER_GOALS = `
    mutation UpdateUserGoals($input: UpdateGoalsInput!) {
        updateUserGoals(input: $input) {
            ${GOAL_FIELDS}
        }
    }
`;

export const UPDATE_USER_HEALTH_CONSTRAINTS = `
    mutation UpdateUserHealthConstraints($input: UpdateHealthConstraintsInput!) {
        updateUserHealthConstraints(input: $input) {
            ${HEALTH_CONSTRAINT_FIELDS}
        }
    }
`;

export const UPDATE_USER_SCHEDULE = `
    mutation UpdateUserSchedule($input: UpdateScheduleInput!) {
        updateUserSchedule(input: $input) {
            ${SCHEDULE_FIELDS}
        }
    }
`;

export const UPDATE_USER_TRAINING_PREFERENCE = `
    mutation UpdateUserTrainingPreference($input: UpdateTrainingPreferenceInput!) {
        updateUserTrainingPreference(input: $input) {
            ${TRAINING_PREFERENCE_FIELDS}
        }
    }
`;

export const UPDATE_USER_RESOURCE = `
    mutation UpdateUserResource($input: UpdateResourceInput!) {
        updateUserResource(input: $input) {
            ${RESOURCE_FIELDS}
        }
    }
`;

export const CREATE_USER_STRENGTH_METRIC = `
    mutation CreateUserStrengthMetric($input: CreateStrengthMetricInput!) {
        createUserStrengthMetric(input: $input) {
            ${STRENGTH_METRIC_FIELDS}
        }
    }
`;

export const REMOVE_USER_STRENGTH_METRIC = `
    mutation RemoveUserStrengthMetric($id: String!) {
        removeUserStrengthMetric(id: $id) {
            ${STRENGTH_METRIC_FIELDS}
        }
    }
`;

export const CREATE_WEIGHT_LOG = `
    mutation CreateWeightLog($input: CreateWeightLogInput!) {
        createWeightLog(input: $input) {
            ${WEIGHT_LOG_FIELDS}
        }
    }
`;
