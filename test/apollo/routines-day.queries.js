export const GET_ROUTINE_DAYS = `
    query {
        routineDays {
            id
            title
            type
            exercises {
                order
                exercise {
                    id
                    name
                    category
                }
            }
        }
    }
`;

export const GET_ROUTINE_DAY = `
    query GetRoutineDay($id: String!) {
        routineDay(id: $id) {
            id
            title
            type
            exercises {
                order
                exercise {
                    id
                    name
                    category
                }
            }
        }
    }
`;

export const GET_ROUTINE_PLANS = `
    query {
        routinePlans {
            id
        }
    }
`;

export const GET_ROUTINES_BY_CATEGORY = `
    query GetRoutines($category: ExerciseCategory!) {
        routinesByCategory(input: { category: $category }) {
            id
            title
            type
        }
    }
`;

export const CREATE_ROUTINE_DAY = `
    mutation createRoutineDay($createRoutineDayInput: CreateRoutineDayInput!) {
        createRoutineDay(createRoutineDayInput: $createRoutineDayInput) {
            id
            title
            type
        }
    }
`;
