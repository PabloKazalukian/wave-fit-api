export const GET_EXERCISES = `
    query {
        exercises {
            id
            name
            category
            usesWeight
        }
    }
`;

export const CREATE_EXERCISE = `
    mutation CreateExercise($input: CreateExerciseInput!) {
        createExercise(createExerciseInput: $input) {
            id
            name
            category
            usesWeight
        }
    }
`;
