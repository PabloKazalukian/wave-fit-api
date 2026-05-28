import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../../utils/app-test.module';
import {
  closeInMongodConnection,
  clearDatabase,
} from '../../../utils/db-handler';
import { UserService } from '../../../../src/modules/user/user.service';
import { ExerciseService } from '../../../../src/modules/routines/templates/exercise/exercise.service';
import { RoutineDayService } from '../../../../src/modules/routines/templates/routine-day/routine-day.service';
import { RoutinePlanService } from '../../../../src/modules/routines/templates/routine-plan/routine-plan.service';
import { ExerciseCategory } from '../../../../src/modules/routines/templates/exercise/entities/exercise.entity';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../../fixtures/user.fixture';
import {
  getCookieWithToken,
  getActiveWeekLog,
} from '../../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('Add ExtraSession (e2e)', () => {
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

  async function completeActiveWeek() {
    const activeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            activeWeekLog {
              hasActiveWeek
              week {
                id
              }
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
              }) {
                id
              }
            }
          `,
        });
    }
  }

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

    await completeActiveWeek();
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should add extra session to day with existing workout', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Add ES asdas2 Test 1',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Add ES Test 1',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Add ES Test 1bb',
      description: 'Test plan',
      weekly_distribution: '1 day',
      routineDays: routineDaysIds as any,
    })) as any;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const createWlResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().split('T')[0]}",
              endDate: "${endOfWeek.toISOString().split('T')[0]}",
              timezone: "America/Argentina/Buenos_Aires",
              planId: "${plan.id}"
            }) {
              id
              days {
                order
                date
                workoutSessionId
                extraSessionIds
                exercises {
                  exerciseId
                }
              }
            }
          }
        `,
      });

    expect(createWlResponse.status).toBe(200);
    const week = createWlResponse.body.data.createWeekLog;
    const day = week.days[0];
    expect(day.workoutSessionId).toBeDefined();
    expect(day.extraSessionIds).toEqual([]);
    const dayDate = day.date.split('T')[0];

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDay(input: {
              id: "${week.id}"
              days: [{
                order: 1
                extraSession: {
                  date: "${dayDate}"
                  discipline: "running"
                  duration: 30
                  intensityLevel: 3
                }
              }]
            }) {
              order
              workoutSessionId
              extraSessionIds
              exercises {
                exerciseId
              }
            }
          }
        `,
      });

    if (updateResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(updateResponse.body.errors, null, 2),
      );
    }

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.updateDay.extraSessionIds).toHaveLength(1);
    expect(updateResponse.body.data.updateDay.workoutSessionId).toBeDefined();
    expect(updateResponse.body.data.updateDay.exercises).toHaveLength(1);
  });

  it('should add extra session without losing existing exercises', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Add ES Test 2aaaa',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Add ES Test 2bb',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Add ES Test 2ccc',
      description: 'Test plan',
      weekly_distribution: '1 day',
      routineDays: routineDaysIds as any,
    })) as any;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const createWlResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().split('T')[0]}",
              endDate: "${endOfWeek.toISOString().split('T')[0]}",
              timezone: "America/Argentina/Buenos_Aires",
              planId: "${plan.id}"
            }) {
              id
              days {
                order
                date
                workoutSessionId
                exercises {
                  exerciseId
                  series
                }
              }
            }
          }
        `,
      });

    expect(createWlResponse.status).toBe(200);
    const week = createWlResponse.body.data.createWeekLog;
    const day = week.days[0];
    expect(day.workoutSessionId).toBeDefined();
    expect(day.exercises).toHaveLength(1);
    expect(day.exercises[0].exerciseId).toBe(ex1.id);

    const workoutSessionId = day.workoutSessionId;
    const dayDate = day.date.split('T')[0];

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDay(input: {
              id: "${week.id}"
              days: [{
                order: 1
                extraSession: {
                  date: "${dayDate}"
                  discipline: "cycling"
                  duration: 45
                  intensityLevel: 4
                }
              }]
            }) {
              order
              extraSessionIds
            }
          }
        `,
      });

    const verifyResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            activeWeekLog {
              hasActiveWeek
              week {
                id
                days {
                  order
                  workoutSessionId
                  extraSessionIds
                  exercises {
                    exerciseId
                    series
                  }
                }
              }
            }
          }
        `,
      });

    expect(verifyResponse.status).toBe(200);
    const updatedDay = verifyResponse.body.data.activeWeekLog.week.days.find(
      (d: any) => d.order === 1,
    );
    expect(updatedDay.extraSessionIds).toHaveLength(1);
    expect(updatedDay.exercises).toHaveLength(1);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex1.id);
    expect(updatedDay.workoutSessionId).toBe(workoutSessionId);
  });

  it('should add multiple extra sessions to same day', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Add ES Test 3aabba',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Add ES Test 3 bbb',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Add ES Test 3ccb',
      description: 'Test plan',
      weekly_distribution: '1 day',
      routineDays: routineDaysIds as any,
    })) as any;

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const createWlResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().split('T')[0]}",
              endDate: "${endOfWeek.toISOString().split('T')[0]}",
              timezone: "America/Argentina/Buenos_Aires",
              planId: "${plan.id}"
            }) {
              id
              days {
                order
                date
              }
            }
          }
        `,
      });

    const week = createWlResponse.body.data.createWeekLog;
    const day = week.days[0];
    const dayDate = day.date.split('T')[0];

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDay(input: {
              id: "${week.id}"
              days: [{
                order: 1
                extraSession: {
                  date: "${dayDate}"
                  discipline: "running"
                  duration: 30
                  intensityLevel: 3
                }
              }]
            }) {
              order
              extraSessionIds
            }
          }
        `,
      });

    const addSecondResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDay(input: {
              id: "${week.id}"
              days: [{
                order: 1
                extraSession: {
                  date: "${dayDate}"
                  discipline: "yoga"
                  duration: 60
                  intensityLevel: 2
                }
              }]
            }) {
              order
              extraSessionIds
            }
          }
        `,
      });

    if (addSecondResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(addSecondResponse.body.errors, null, 2),
      );
    }

    expect(addSecondResponse.status).toBe(200);
    expect(addSecondResponse.body.data.updateDay.extraSessionIds).toHaveLength(
      2,
    );
  });
});
