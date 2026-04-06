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
import {
  WEEK_LOG_FIELDS,
  UPDATE_WEEK_LOG,
  ASSIGN_ROUTINE_TO_DAY,
  REMOVE_WORKOUT_SESSION_FROM_DAY,
} from '../../apollo/week-log.queries';
import {
  getCookieWithToken,
  createWeekLog,
  getActiveWeekLog,
} from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('UpdateWeekLog (e2e)', () => {
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

    await createWeekLog(app, authCookie);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should complete the week', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);

    expect(activeWeekResponse.status).toBe(200);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    expect(week).toBeDefined();
    expect(week.completed).toBe(false);

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_WEEK_LOG,
        variables: {
          updateWeekLogInput: {
            id: week.id,
            userId: week.userId,
            startDate: week.startDate
              ? week.startDate.replace('Z', '')
              : undefined,
            endDate: week.endDate ? week.endDate.replace('Z', '') : undefined,
            days: week.days.map(({ date, exercises, ...rest }: any) => rest),
            completed: true,
            active: false,
          },
        },
      });

    // if (updateResponse.body.errors) {
    //   console.log(
    //     'GraphQL Errors:',
    //     JSON.stringify(updateResponse.body.errors, null, 2),
    //   );
    // }
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.updateWeekLog.completed).toBe(true);
    expect(updateResponse.body.data.updateWeekLog.days.length).toBe(7);
  });

  it('should assign a different routine to a day', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    if (activeWeekResponse.body.data.activeWeekLog.hasActiveWeek) {
      const week = activeWeekResponse.body.data.activeWeekLog.week;
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', [authCookie])
        .send({
          query: UPDATE_WEEK_LOG,
          variables: {
            updateWeekLogInput: {
              id: week.id,
              userId: week.userId,
              completed: true,
              active: false,
            },
          },
        });
    }

    const ex1 = (await exerciseService.create({
      name: 'Push Up',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const ex2 = (await exerciseService.create({
      name: 'Squat',
      category: ExerciseCategory.LEGS,
      usesWeight: false,
    })) as any;

    const ex3 = (await exerciseService.create({
      name: 'Pull Up',
      category: ExerciseCategory.BACK,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Upper Body',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const day2 = (await routineDayService.create({
      title: 'Lower Body',
      type: [ExerciseCategory.LEGS],
      exercises: [{ exercise: ex2.id, order: 1 }],
    })) as any;

    const day3 = (await routineDayService.create({
      title: 'Full Body',
      type: [ExerciseCategory.BACK],
      exercises: [{ exercise: ex3.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, day2.id, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Test Plan',
      description: 'A test plan',
      weekly_distribution: '2 days',
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
              startDate: "${startOfWeek.toISOString()}",
              endDate: "${endOfWeek.toISOString()}",
              planId: "${plan.id}"
            }) {
              id
              startDate
              endDate
              planId
              days {
                order
                date
                isRest
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
    expect(createWlResponse.body.data.createWeekLog.planId).toBe(plan.id);

    const week = createWlResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeDefined();

    const firstDayFullDate = week.days[0].date;
    const firstDayDateOnly = firstDayFullDate.split('T')[0];

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: ASSIGN_ROUTINE_TO_DAY,
        variables: {
          routineDayId: day3.id,
          date: firstDayDateOnly,
        },
      });

    // if (assignResponse.body.errors) {
    //   console.log(
    //     'GraphQL Errors:',
    //     JSON.stringify(assignResponse.body.errors, null, 2),
    //   );
    // }

    expect(assignResponse.status).toBe(200);
    expect(
      assignResponse.body.data.assignRoutineToDay.days[0].workoutSessionId,
    ).toBeDefined();
  });

  it('should remove workout session from day', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    if (activeWeekResponse.body.data.activeWeekLog.hasActiveWeek) {
      const week = activeWeekResponse.body.data.activeWeekLog.week;
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', [authCookie])
        .send({
          query: UPDATE_WEEK_LOG,
          variables: {
            updateWeekLogInput: {
              id: week.id,
              userId: week.userId,
              completed: true,
              active: false,
            },
          },
        });
    }

    const ex1 = (await exerciseService.create({
      name: 'Bench Press',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Chest Day',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, null, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Test Plan',
      description: 'A test plan',
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
              startDate: "${startOfWeek.toISOString()}",
              endDate: "${endOfWeek.toISOString()}",
              planId: "${plan.id}"
            }) {
              id
              planId
              days {
                order
                workoutSessionId
                status
              }
            }
          }
        `,
      });

    expect(createWlResponse.status).toBe(200);
    const week = createWlResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeDefined();
    expect(week.days[0].status).toBe('pending');

    const workoutSessionId = week.days[0].workoutSessionId;

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: REMOVE_WORKOUT_SESSION_FROM_DAY,
        variables: {
          input: {
            workoutSessionId: workoutSessionId,
          },
        },
      });

    // if (removeResponse.body.errors) {
    //   console.log(
    //     'GraphQL Errors:',
    //     JSON.stringify(removeResponse.body.errors, null, 2),
    //   );
    // }

    expect(removeResponse.status).toBe(200);
    expect(
      removeResponse.body.data.removeWorkoutSessionFromDay.days[0]
        .workoutSessionId,
    ).toBeNull();
    expect(
      removeResponse.body.data.removeWorkoutSessionFromDay.days[0].status,
    ).toBe('pending');
  });

  it('should fail when assigning routine to day that already has workout session', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    if (activeWeekResponse.body.data.activeWeekLog.hasActiveWeek) {
      const week = activeWeekResponse.body.data.activeWeekLog.week;
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', [authCookie])
        .send({
          query: UPDATE_WEEK_LOG,
          variables: {
            updateWeekLogInput: {
              id: week.id,
              userId: week.userId,
              completed: true,
              active: false,
            },
          },
        });
    }

    const ex1 = (await exerciseService.create({
      name: 'Dumbbell Curl',
      category: ExerciseCategory.BICEPS,
      usesWeight: false,
    })) as any;

    const ex2 = (await exerciseService.create({
      name: 'Tricep Extension',
      category: ExerciseCategory.TRICEPS,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Biceps',
      type: [ExerciseCategory.BICEPS],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const day2 = (await routineDayService.create({
      title: 'Triceps',
      type: [ExerciseCategory.TRICEPS],
      exercises: [{ exercise: ex2.id, order: 1 }],
    })) as any;

    const routineDaysIds = [day1.id, day2.id, null, null, null, null, null];

    const plan = (await routinePlanService.create({
      name: 'Arms Plan',
      description: 'Arms test plan',
      weekly_distribution: '2 days',
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
              startDate: "${startOfWeek.toISOString()}",
              endDate: "${endOfWeek.toISOString()}",
              planId: "${plan.id}"
            }) {
              id
              userId
              startDate
              endDate
              planId
              days {
                order
                date
                workoutSessionId
              }
            }
          }
        `,
      });

    expect(createWlResponse.status).toBe(200);
    const week = createWlResponse.body.data.createWeekLog;
    const originalWorkoutSessionId = week.days[1].workoutSessionId;

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_WEEK_LOG,
        variables: {
          updateWeekLogInput: {
            id: week.id,
            userId: week.userId,
            startDate: week.startDate
              ? week.startDate.replace('Z', '')
              : undefined,
            endDate: week.endDate ? week.endDate.replace('Z', '') : undefined,
            days: [
              { order: 1, workoutSessionId: null },
              {
                order: 2,
                workoutSession: {
                  id: '69d4320e2542b4c262114433',
                },
              },
            ],
          },
        },
      });

    // if (updateResponse.body.errors) {
    //   console.log(
    //     'GraphQL Errors:',
    //     JSON.stringify(updateResponse.body.errors, null, 2),
    //   );
    // }

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeDefined();
    expect(updateResponse.body.errors[0].message).toContain(
      'already has a WorkoutSession',
    );
  });
});
