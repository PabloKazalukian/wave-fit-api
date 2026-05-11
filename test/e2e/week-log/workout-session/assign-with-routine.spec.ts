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
import { WeekLogService } from '../../../../src/modules/routines/tracking/week-log/week-log.service';
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
  createWeekLog,
  getActiveWeekLog,
} from '../../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

const WEEK_LOG_DAY_FIELDS = `
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

const WEEK_LOG_FIELDS = `
    id
    userId
    startDate
    endDate
    planId
    notes
    completed
    active
    days {
        ${WEEK_LOG_DAY_FIELDS}
    }
`;

describe('assignRoutineToDay (e2e)', () => {
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

  it('should assign a RoutineDay to a day without workout-session and create new one', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    expect(activeWeekResponse.status).toBe(200);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    expect(week).toBeDefined();

    const ex1 = (await exerciseService.create({
      name: 'Bench Press',
      category: ExerciseCategory.CHEST,
      usesWeight: true,
    })) as any;
    const ex2 = (await exerciseService.create({
      name: 'Incline Dumbbell Press',
      category: ExerciseCategory.CHEST,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Chest Day',
      type: [ExerciseCategory.CHEST],
      exercises: [
        { exercise: ex1.id, order: 1 },
        { exercise: ex2.id, order: 2 },
      ],
    })) as any;

    const firstDayDate = week.days[0].date;
    const firstDayDateOnly = firstDayDate.split('T')[0];

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
              workoutSessionId
              isRest
              status
              exercises {
                exerciseId
                series
                sets {
                  weights
                  reps
                }
              }
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: firstDayDateOnly,
        },
      });

    if (assignResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(assignResponse.body.errors, null, 2),
      );
    }

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.data).toBeDefined();
    expect(assignResponse.body.data.assignRoutineToDay).toBeDefined();

    const updatedDay = assignResponse.body.data.assignRoutineToDay;

    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.isRest).toBe(false);
    expect(updatedDay.status).toBe('pending');

    expect(updatedDay.exercises).toBeDefined();
    expect(updatedDay.exercises.length).toBe(2);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex1.id.toString());
    expect(updatedDay.exercises[0].series).toBe(0);
    expect(updatedDay.exercises[0].sets).toEqual([]);
    expect(updatedDay.exercises[1].exerciseId).toBe(ex2.id.toString());
    expect(updatedDay.exercises[1].series).toBe(0);
  });

  it('should assign a RoutineDay to a day that already has workout-session and update it', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    expect(activeWeekResponse.status).toBe(200);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    expect(week).toBeDefined();

    const ex1 = (await exerciseService.create({
      name: 'Squat',
      category: ExerciseCategory.LEGS,
      usesWeight: true,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Legs Day',
      type: [ExerciseCategory.LEGS],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const firstDayDate = week.days[0].date;
    const firstDayDateOnly = firstDayDate.split('T')[0];

    const assignResponse1 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
              workoutSessionId
              exercises {
                exerciseId
                series
              }
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: firstDayDateOnly,
        },
      });

    expect(assignResponse1.status).toBe(200);
    expect(assignResponse1.body.data).toBeDefined();

    const firstWorkoutSessionId =
      assignResponse1.body.data.assignRoutineToDay.workoutSessionId;
    expect(firstWorkoutSessionId).toBeDefined();

    const ex2 = (await exerciseService.create({
      name: 'Deadlift',
      category: ExerciseCategory.BACK,
      usesWeight: true,
    })) as any;

    const ex3 = (await exerciseService.create({
      name: 'Pull Up',
      category: ExerciseCategory.BACK,
      usesWeight: false,
    })) as any;

    const day2 = (await routineDayService.create({
      title: 'Back Day',
      type: [ExerciseCategory.BACK],
      exercises: [
        { exercise: ex2.id, order: 1 },
        { exercise: ex3.id, order: 2 },
      ],
    })) as any;

    const assignResponse2 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
              workoutSessionId
              exercises {
                exerciseId
                series
                sets {
                  weights
                  reps
                }
              }
            }
          }
        `,
        variables: {
          routineDayId: day2.id,
          date: firstDayDateOnly,
        },
      });

    if (assignResponse2.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(assignResponse2.body.errors, null, 2),
      );
    }

    expect(assignResponse2.status).toBe(200);
    expect(assignResponse2.body.data).toBeDefined();

    const updatedDay = assignResponse2.body.data.assignRoutineToDay;
    expect(updatedDay.workoutSessionId).toBe(firstWorkoutSessionId);
    expect(updatedDay.exercises.length).toBe(2);
    expect(updatedDay.exercises[0].exerciseId).toBe(ex2.id.toString());
    expect(updatedDay.exercises[1].exerciseId).toBe(ex3.id.toString());
  });

  it('should fail when RoutineDay does not exist', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    const firstDayDate = week.days[0].date.split('T')[0];

    const fakeRoutineDayId = '507f1f77bcf86cd799439011';

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
            }
          }
        `,
        variables: {
          routineDayId: fakeRoutineDayId,
          date: firstDayDate,
        },
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.errors).toBeDefined();
    expect(assignResponse.body.errors[0].message).toContain('RoutineDay');
    expect(assignResponse.body.errors[0].message).toContain('no encontrado');
  });

  it('should fail when there is no active WeekLog', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: { id: "${week.id}", completed: true, active: false }) {
              id
              completed
            }
          }
        `,
      });

    await clearDatabase();
    await createTestUser(userService);

    const loginResponse2 = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
            }
        `,
      });
    const authCookie2 = getCookieWithToken(loginResponse2);

    const ex1 = (await exerciseService.create({
      name: 'NoWLTest_Ex_' + Date.now(),
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Rest Day NoWL',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie2])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: new Date().toISOString().split('T')[0],
        },
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.errors).toBeDefined();
    expect(assignResponse.body.errors[0].message).toContain('WeekLog activo');
  });

  it('should fail when date does not belong to active WeekLog', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;

    const ex1 = (await exerciseService.create({
      name: 'DateNotBelongTest_' + Date.now(),
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Test Day NoBelong',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const outsideDate = new Date();
    outsideDate.setDate(outsideDate.getDate() + 30);
    const outsideDateOnly = outsideDate.toISOString().split('T')[0];

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: outsideDateOnly,
        },
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.errors).toBeDefined();
    expect(assignResponse.body.errors[0].message).toContain(
      'no pertenece al WeekLog activo',
    );
  });

  it('should assign RoutineDay with no exercises and create workout-session with empty exercises', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;

    const day1 = (await routineDayService.create({
      title: 'Empty Day',
      type: [],
      exercises: [],
    })) as any;

    const firstDayDate = week.days[0].date.split('T')[0];

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
              workoutSessionId
              exercises {
                exerciseId
                series
              }
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: firstDayDate,
        },
      });

    if (assignResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(assignResponse.body.errors, null, 2),
      );
    }

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.data).toBeDefined();

    const updatedDay = assignResponse.body.data.assignRoutineToDay;
    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.exercises).toEqual([]);
  });

  // it.skip('should create new workout-session when workoutSessionId exists but document does not', async () => {
  // Este edge case es difícil de testear porque requiere manipular la BD directamente
  // para dejar un workoutSessionId en el día pero sin el documento WorkoutSession.
  // El servicio ya maneja este caso en week-log.service.ts líneas 303-317
  // });

  it('should reset status to pending when reassigning routine to day', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;

    const ex1 = (await exerciseService.create({
      name: 'Push Up',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const day1 = (await routineDayService.create({
      title: 'Chest',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const firstDayDate = week.days[0].date.split('T')[0];

    const assignResponse1 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
              workoutSessionId
              status
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: firstDayDate,
        },
      });

    expect(assignResponse1.status).toBe(200);
    expect(assignResponse1.body.data.assignRoutineToDay.status).toBe('pending');

    const assignResponse2 = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation AssignRoutineToDay($routineDayId: String!, $date: String!) {
            assignRoutineToDay(routineDayId: $routineDayId, date: $date) {
              order
              workoutSessionId
              status
            }
          }
        `,
        variables: {
          routineDayId: day1.id,
          date: firstDayDate,
        },
      });

    expect(assignResponse2.status).toBe(200);
    expect(assignResponse2.body.data.assignRoutineToDay.status).toBe('pending');
  });
});
