import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { WeekLogService } from '../../../src/modules/routines/tracking/week-log/week-log.service';
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
        extraSessionIds
        exercises {
            exerciseId
        }
        status
    }
`;

const UPDATE_DAY_MUTATION = `
    mutation UpdateDay($input: UpdateWeekLogDayUnifiedInput!) {
        updateDay(input: $input) {
            ${DAY_FIELDS}
        }
    }
`;

async function closeActiveWeek(app: INestApplication<App>, authCookie: string) {
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

describe('updateDay (update-day-log) (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let weekLogService: WeekLogService;
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
    weekLogService = module.get<WeekLogService>(WeekLogService);
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

  it('should update a workout session in a week-log day via updateDay', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Bench UDL',
      category: ExerciseCategory.CHEST,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Chest UDL',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const plan = (await routinePlanService.create({
      name: 'Plan UDL',
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

    if (createResponse.body.errors) {
      console.log('createWeekLog errors:', JSON.stringify(createResponse.body.errors, null, 2));
    }
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toBeDefined();
    const week = createResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeDefined();

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_MUTATION,
        variables: {
          input: {
            id: week.id,
            days: [
              {
                order: 1,
                workoutSession: {
                  status: 'not_started',
                  exercises: [
                    {
                      exerciseId: ex1.id,
                      series: 1,
                      sets: [{ weights: 50, reps: 10 }],
                    },
                  ],
                },
              },
            ],
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log('updateDay errors:', JSON.stringify(updateResponse.body.errors, null, 2));
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDay;
    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.isRest).toBe(false);
    expect(updatedDay.exercises).toHaveLength(1);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex1.id.toString());
    expect(updatedDay.exercises[0].series).toBe(1);
    expect(updatedDay.exercises[0].sets).toHaveLength(1);
  });

  it('should replace an existing workout session with different exercises via updateDay', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Push UDL',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const ex2 = (await exerciseService.create({
      name: 'Deadlift UDL',
      category: ExerciseCategory.BACK,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Push UDL',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const day2 = (await routineDayService.create({
      title: 'Back UDL',
      type: [ExerciseCategory.BACK],
      exercises: [{ exercise: ex2.id, order: 1 }],
    })) as any;

    const plan = (await routinePlanService.create({
      name: 'Replace UDL',
      description: 'Test plan',
      weekly_distribution: '2 days',
      routineDays: [day1.id, day2.id, null, null, null, null, null] as any,
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

    if (createResponse.body.errors) {
      console.log('createWeekLog errors:', JSON.stringify(createResponse.body.errors, null, 2));
    }
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toBeDefined();
    const week = createResponse.body.data.createWeekLog;

    expect(week.days[0].workoutSessionId).toBeDefined();
    const originalWsId = week.days[0].workoutSessionId;

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_MUTATION,
        variables: {
          input: {
            id: week.id,
            days: [
              {
                order: 1,
                workoutSession: {
                  status: 'not_started',
                  exercises: [
                    {
                      exerciseId: ex2.id,
                      series: 2,
                      sets: [
                        { weights: 60, reps: 8 },
                        { weights: 70, reps: 6 },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log('updateDay errors:', JSON.stringify(updateResponse.body.errors, null, 2));
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDay;
    expect(updatedDay.workoutSessionId).toBe(originalWsId);
    expect(updatedDay.exercises).toHaveLength(1);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex2.id.toString());
    expect(updatedDay.exercises[0].series).toBe(2);
    expect(updatedDay.exercises[0].sets).toHaveLength(2);
  });

  it('should set a day as rest day via updateDay', async () => {
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

    if (createResponse.body.errors) {
      console.log('createWeekLog errors:', JSON.stringify(createResponse.body.errors, null, 2));
    }
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toBeDefined();
    const week = createResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeNull();
    expect(week.days[0].isRest).toBe(false);

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_MUTATION,
        variables: {
          input: {
            id: week.id,
            days: [
              {
                order: 1,
                isRest: true,
                status: 'skipped',
              },
            ],
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log('updateDay errors:', JSON.stringify(updateResponse.body.errors, null, 2));
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDay;
    expect(updatedDay.isRest).toBe(true);
    expect(updatedDay.workoutSessionId).toBeNull();
    expect(updatedDay.status).toBe('skipped');
  });

  it('should update workout session and add extra session to a day via updateDay', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Push Up Cmb',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const ex2 = (await exerciseService.create({
      name: 'Pull Up Cmb',
      category: ExerciseCategory.BACK,
      usesWeight: false,
    })) as any;

    const ex3 = (await exerciseService.create({
      name: 'Squat Cmb',
      category: ExerciseCategory.LEGS,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Push Cmb',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const day2 = (await routineDayService.create({
      title: 'Pull Cmb',
      type: [ExerciseCategory.BACK],
      exercises: [{ exercise: ex2.id, order: 1 }],
    })) as any;

    const plan = (await routinePlanService.create({
      name: 'Combined Cmb',
      description: 'Test plan',
      weekly_distribution: '2 days',
      routineDays: [day1.id, day2.id, null, null, null, null, null] as any,
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

    if (createResponse.body.errors) {
      console.log('createWeekLog errors:', JSON.stringify(createResponse.body.errors, null, 2));
    }
    expect(createResponse.status).toBe(200);
    expect(createResponse.body.data).toBeDefined();
    const week = createResponse.body.data.createWeekLog;

    const day1Data = week.days[0];
    expect(day1Data.workoutSessionId).toBeDefined();
    expect(day1Data.exercises[0].exerciseId).toBe(ex1.id.toString());
    expect(day1Data.extraSessionIds).toEqual([]);

    const day1Date = day1Data.date.split('T')[0];

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_MUTATION,
        variables: {
          input: {
            id: week.id,
            days: [
              {
                order: 1,
                workoutSession: {
                  status: 'not_started',
                  exercises: [
                    {
                      exerciseId: ex3.id,
                      series: 1,
                      sets: [{ weights: 80, reps: 6 }],
                      notes: 'Replaced with Squat',
                    },
                  ],
                },
                extraSession: {
                  date: day1Date,
                  discipline: 'running',
                  duration: 30,
                  intensityLevel: 3,
                },
              },
            ],
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log('updateDay errors:', JSON.stringify(updateResponse.body.errors, null, 2));
    }

    expect(updateResponse.status).toBe(200);
    const updatedDay = updateResponse.body.data.updateDay;
    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.exercises).toHaveLength(1);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex3.id.toString());
    expect(updatedDay.extraSessionIds).toHaveLength(1);
  });
});
