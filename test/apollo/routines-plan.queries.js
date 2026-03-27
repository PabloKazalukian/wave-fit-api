export const GET_PLANS = `
    query {
        plans {
            id
            name
            description
            duration
        }
    }
`;

export const CREATE_ROUTINE_PLAN = `
    mutation CreateRoutinePlan($input: CreateRoutinePlanInput!) {
        createRoutinePlan(createRoutinePlanInput: $input) {
            id
            name
            description
            weekly_distribution
            routineDays {
                id
            }
            createdBy
        }
    }
`;

export const GET_ROUTINE_PLAN = `
    query GetRoutinePlan($id: String!) {
        routinePlan(id: $id) {
            id
            name
            description
            weekly_distribution
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
            createdBy
        }
    }
`;

export const IS_ROUTINE_TITLE_AVAILABLE = `
    query IsRoutineTitleAvailable($input: ValidateTitleInput!) {
        isRoutineTitleAvailable(title: $input)
    }
`;
