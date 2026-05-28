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
import { getCookieWithToken } from '../../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('Remove ExtraSession (e2e)', () => {
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

  it('should remove extra session from day', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Remove ES Test 1abababa',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Remove ES Test 1bbbbccc',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Remove ES Test 1zzzz',
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

    const addResponse = await request(app.getHttpServer())
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

    expect(addResponse.status).toBe(200);
    const extraSessionId = addResponse.body.data.updateDay.extraSessionIds[0];

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeExtraSessionFromDay(date: "${dayDate}", extraSessionId: "${extraSessionId}") {
              order
              extraSessionIds
            }
          }
        `,
      });

    if (removeResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(removeResponse.body.errors, null, 2),
      );
    }

    expect(removeResponse.status).toBe(200);
    expect(
      removeResponse.body.data.removeExtraSessionFromDay.extraSessionIds,
    ).toHaveLength(0);
  });

  it('should remove extra session without losing workout exercises', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Remove ES Test 2zzz',
      category: ExerciseCategory.LEGS,
      usesWeight: false,
    })) as any;

    const ex2 = (await exerciseService.create({
      name: 'Exercise Remove ES Test 2b',
      category: ExerciseCategory.BACK,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Remove ES Test 2qqqq',
      type: [ExerciseCategory.LEGS],
      exercises: [
        { exercise: ex1.id, order: 1 },
        { exercise: ex2.id, order: 2 },
      ],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Remove ES Test 2qwa',
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
    const dayDate = day.date.split('T')[0];

    expect(day.exercises).toHaveLength(2);
    const workoutSessionId = day.workoutSessionId;

    const addExtraResponse = await request(app.getHttpServer())
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
                  discipline: "swimming"
                  duration: 45
                  intensityLevel: 4
                }
              }]
            }) {
              order
              extraSessionIds
              exercises {
                exerciseId
                series
              }
            }
          }
        `,
      });

    expect(addExtraResponse.status).toBe(200);
    const extraSessionId =
      addExtraResponse.body.data.updateDay.extraSessionIds[0];

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeExtraSessionFromDay(date: "${dayDate}", extraSessionId: "${extraSessionId}") {
              order
              workoutSessionId
              extraSessionIds
              exercises {
                exerciseId
                series
              }
            }
          }
        `,
      });

    if (removeResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(removeResponse.body.errors, null, 2),
      );
    }

    expect(removeResponse.status).toBe(200);
    expect(
      removeResponse.body.data.removeExtraSessionFromDay.extraSessionIds,
    ).toHaveLength(0);
    expect(
      removeResponse.body.data.removeExtraSessionFromDay.workoutSessionId,
    ).toBe(workoutSessionId);
    expect(
      removeResponse.body.data.removeExtraSessionFromDay.exercises,
    ).toHaveLength(2);
  });

  it('should remove one extra session and keep others', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Remove ES Test 3rere',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Remove ES Test 3ggg',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Remove ES Test 3tger',
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

    const addFirstResponse = await request(app.getHttpServer())
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

    const firstExtraSessionId =
      addFirstResponse.body.data.updateDay.extraSessionIds[0];

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

    expect(addSecondResponse.body.data.updateDay.extraSessionIds).toHaveLength(
      2,
    );

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeExtraSessionFromDay(date: "${dayDate}", extraSessionId: "${firstExtraSessionId}") {
              order
              extraSessionIds
            }
          }
        `,
      });

    expect(removeResponse.status).toBe(200);
    expect(
      removeResponse.body.data.removeExtraSessionFromDay.extraSessionIds,
    ).toHaveLength(1);
    expect(
      removeResponse.body.data.removeExtraSessionFromDay.extraSessionIds[0],
    ).not.toBe(firstExtraSessionId);
  });
});
