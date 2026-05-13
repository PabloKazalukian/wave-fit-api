import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { ExerciseService } from '../../../src/modules/routines/templates/exercise/exercise.service';
import { RoutineDayService } from '../../../src/modules/routines/templates/routine-day/routine-day.service';
import { RoutinePlanService } from '../../../src/modules/routines/templates/routine-plan/routine-plan.service';
import { ExerciseCategory } from '../../../src/modules/routines/templates/exercise/entities/exercise.entity';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import { getCookieWithToken } from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

const DAY_FIELDS = `
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
`;

const WEEK_LOG_WITH_DAYS = `
    id
    startDate
    endDate
    days {
        order
        date
        isRest
        workoutSessionId
        status
    }
`;

const UPDATE_DAY_WORKOUT_STATUS = `
    mutation UpdateDayWorkoutStatus($input: UpdateDayWorkoutStatusInput!) {
        updateDayWorkoutStatus(input: $input) {
            ${DAY_FIELDS}
        }
    }
`;

async function closeActiveWeek(
  app: INestApplication<App>,
  authCookie: string,
) {
  const activeResponse = await request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [authCookie])
    .send({
      query: `
        query {
          activeWeekLog {
            hasActiveWeek
            week { id }
          }
        }
      `,
    });

  if (activeResponse.body.data?.activeWeekLog?.hasActiveWeek) {
    const weekId = activeResponse.body.data.activeWeekLog.week.id;
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${weekId}"
              completed: true
              active: false
            }) { id }
          }
        `,
      });
  }
}

describe('updateDayWorkoutStatus (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let exerciseService: ExerciseService;
  let routineDayService: RoutineDayService;
  let routinePlanService: RoutinePlanService;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    exerciseService = module.get<ExerciseService>(ExerciseService);
    routineDayService = module.get<RoutineDayService>(RoutineDayService);
    routinePlanService = module.get<RoutinePlanService>(RoutinePlanService);

    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser(userService);

    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
            }
        `,
      });
    authCookie = getCookieWithToken(loginResponse);

    await closeActiveWeek(app, authCookie);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  function createStartEndDates() {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    return {
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // HAPPY PATHS
  // ══════════════════════════════════════════════════════════════════════════

  it('should set a day as rest when the day has a workout session', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Bench Press UDWS',
      category: ExerciseCategory.CHEST,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Chest UDWS',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const plan = (await routinePlanService.create({
      name: 'Plan UDWS',
      description: 'Test plan',
      weekly_distribution: '1 day',
      routineDays: [day1.id, null, null, null, null, null, null] as any,
    })) as any;

    const { startDate, endDate } = createStartEndDates();

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires",
              planId: "${plan.id}"
            }) {
              ${WEEK_LOG_WITH_DAYS}
            }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toBeDefined();
    const week = createResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeDefined();
    expect(week.days[0].isRest).toBe(false);

    const dayDate = week.days[0].date.split('T')[0];

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: dayDate,
            isRest: true,
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(updateResponse.body.errors, null, 2),
      );
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDayWorkoutStatus;
    expect(updatedDay.isRest).toBe(true);
    expect(updatedDay.workoutSessionId).toBeNull();
    expect(updatedDay.status).toBe('skipped');
    expect(updatedDay.exercises).toEqual([]);
  });

  it('should set a day as rest when the day has no workout session', async () => {
    const { startDate, endDate } = createStartEndDates();

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires"
            }) {
              ${WEEK_LOG_WITH_DAYS}
            }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toBeDefined();
    const week = createResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeNull();
    expect(week.days[0].isRest).toBe(false);

    const dayDate = week.days[0].date.split('T')[0];

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: dayDate,
            isRest: true,
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(updateResponse.body.errors, null, 2),
      );
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDayWorkoutStatus;
    expect(updatedDay.isRest).toBe(true);
    expect(updatedDay.workoutSessionId).toBeNull();
    expect(updatedDay.status).toBe('skipped');
  });

  it('should unset a rest day and create a new empty workout session', async () => {
    const { startDate, endDate } = createStartEndDates();

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires"
            }) {
              ${WEEK_LOG_WITH_DAYS}
            }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    const week = createResponse.body.data.createWeekLog;
    const dayDate = week.days[0].date.split('T')[0];

    // First set as rest
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: dayDate,
            isRest: true,
          },
        },
      });

    // Then unset rest
    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: dayDate,
            isRest: false,
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(updateResponse.body.errors, null, 2),
      );
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDayWorkoutStatus;
    expect(updatedDay.isRest).toBe(false);
    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.status).toBe('pending');
    expect(updatedDay.exercises).toEqual([]);
  });

  it('should unset a rest day on a day with existing workout session', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Squat UDWS',
      category: ExerciseCategory.LEGS,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Legs UDWS',
      type: [ExerciseCategory.LEGS],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const plan = (await routinePlanService.create({
      name: 'Plan UDWS',
      description: 'Test plan',
      weekly_distribution: '1 day',
      routineDays: [day1.id, null, null, null, null, null, null] as any,
    })) as any;

    const { startDate, endDate } = createStartEndDates();

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires",
              planId: "${plan.id}"
            }) {
              ${WEEK_LOG_WITH_DAYS}
            }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    const week = createResponse.body.data.createWeekLog;
    const originalWsId = week.days[0].workoutSessionId;
    expect(originalWsId).toBeDefined();

    const dayDate = week.days[0].date.split('T')[0];

    // Set as rest first
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: dayDate,
            isRest: true,
          },
        },
      });

    // Unset rest — should create a NEW WS (the old one was deleted)
    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: dayDate,
            isRest: false,
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(updateResponse.body.errors, null, 2),
      );
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDayWorkoutStatus;
    expect(updatedDay.isRest).toBe(false);
    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.workoutSessionId).not.toBe(originalWsId);
    expect(updatedDay.status).toBe('pending');
    expect(updatedDay.exercises).toEqual([]);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // ERROR CASES
  // ══════════════════════════════════════════════════════════════════════════

  it('should fail when date format is invalid', async () => {
    const { startDate, endDate } = createStartEndDates();

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires"
            }) { id }
          }
        `,
      });

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: 'not-a-date',
            isRest: true,
          },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeDefined();
    expect(updateResponse.body.errors[0].message).toContain(
      'must be in yyyy-MM-dd format',
    );
  });

  it('should fail when date is not inside the active week log', async () => {
    const { startDate, endDate } = createStartEndDates();

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires"
            }) { id }
          }
        `,
      });

    const outsideDate = new Date();
    outsideDate.setDate(outsideDate.getDate() + 30);
    const outsideDateStr = outsideDate.toISOString().split('T')[0];

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: outsideDateStr,
            isRest: true,
          },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeDefined();
    expect(updateResponse.body.errors[0].message).toContain(
      'Day not found in week log',
    );
  });

  it('should fail when there is no active week log', async () => {
    const { startDate, endDate } = createStartEndDates();

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires"
            }) { id }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    const weekId = createResponse.body.data.createWeekLog.id;

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${weekId}"
              completed: true
              active: false
            }) { id }
          }
        `,
      });

    const todayStr = new Date().toISOString().split('T')[0];

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_WORKOUT_STATUS,
        variables: {
          input: {
            date: todayStr,
            isRest: true,
          },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeDefined();
    expect(updateResponse.body.errors[0].message).toContain(
      'No active week log',
    );
  });
});
