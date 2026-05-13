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

describe('Update ExtraSession (e2e)', () => {
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

  it('should update extra session directly', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Update ES Test 1',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Update ES Test 1',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Update ES Test 1',
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

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateExtraSession(updateExtraSessionInput: {
              id: "${extraSessionId}"
              discipline: "cycling"
              duration: 60
              intensityLevel: 4
            }) {
              id
              discipline
              duration
              intensityLevel
              category
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
    expect(updateResponse.body.data.updateExtraSession.id).toBe(extraSessionId);
    expect(updateResponse.body.data.updateExtraSession.discipline).toBe(
      'cycling',
    );
    expect(updateResponse.body.data.updateExtraSession.duration).toBe(60);
    expect(updateResponse.body.data.updateExtraSession.intensityLevel).toBe(4);
    expect(updateResponse.body.data.updateExtraSession.category).toBe('CARDIO');
  });

  it('should update extra session without affecting workout session', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Update ES Test 2',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const ex2 = (await exerciseService.create({
      name: 'Exercise Update ES Test 2b',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Update ES Test 2',
      type: [ExerciseCategory.CHEST],
      exercises: [
        { exercise: ex1.id, order: 1 },
        { exercise: ex2.id, order: 2 },
      ],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Update ES Test 2',
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
    const workoutSessionId = day.workoutSessionId;
    const exercisesBefore = day.exercises;

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
                  discipline: "weightlifting"
                  duration: 45
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

    const extraSessionId =
      addExtraResponse.body.data.updateDay.extraSessionIds[0];

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateExtraSession(updateExtraSessionInput: {
              id: "${extraSessionId}"
              discipline: "crossfit"
              duration: 30
              intensityLevel: 5
            }) {
              id
              discipline
              duration
              intensityLevel
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
                days {
                  order
                  workoutSessionId
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
    expect(updatedDay.workoutSessionId).toBe(workoutSessionId);
    expect(updatedDay.exercises).toHaveLength(2);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex1.id);
    expect(updatedDay.exercises[1].exerciseId).toBe(ex2.id);
  });

  it('should update extra session notes', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Update ES Test 3',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Update ES Test 3',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Update ES Test 3',
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

    const extraSessionId = addResponse.body.data.updateDay.extraSessionIds[0];

    const updateNotesResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateExtraSession(updateExtraSessionInput: {
              id: "${extraSessionId}"
              notes: "Morning run, felt great!"
            }) {
              id
              notes
              discipline
            }
          }
        `,
      });

    expect(updateNotesResponse.status).toBe(200);
    expect(updateNotesResponse.body.data.updateExtraSession.notes).toBe(
      'Morning run, felt great!',
    );
    expect(updateNotesResponse.body.data.updateExtraSession.discipline).toBe(
      'running',
    );
  });

  it('should update extra session calories', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Exercise Update ES Test 4',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Day Update ES Test 4',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Plan Update ES Test 4',
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
                  discipline: "swimming"
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

    const extraSessionId = addResponse.body.data.updateDay.extraSessionIds[0];

    const updateCaloriesResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateExtraSession(updateExtraSessionInput: {
              id: "${extraSessionId}"
              calories: 400
            }) {
              id
              calories
              discipline
            }
          }
        `,
      });

    expect(updateCaloriesResponse.status).toBe(200);
    expect(updateCaloriesResponse.body.data.updateExtraSession.calories).toBe(
      400,
    );
  });
});
