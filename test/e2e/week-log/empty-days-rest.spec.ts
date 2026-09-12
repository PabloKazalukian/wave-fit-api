import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { RoutineDayService } from '../../../src/modules/routines/templates/routine-day/routine-day.service';
import { ExerciseService } from '../../../src/modules/routines/templates/exercise/exercise.service';
import { ExerciseCategory } from '../../../src/modules/routines/templates/exercise/entities/exercise.entity';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import {
  UPDATE_WEEK_LOG,
  ASSIGN_ROUTINE_TO_WEEK_DAY,
} from '../../apollo/week-log.queries';
import {
  getCookieWithToken,
  createWeekLog,
  getActiveWeekLog,
} from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('WeekLog empty days -> rest (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let routineDayService: RoutineDayService;
  let exerciseService: ExerciseService;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    routineDayService = module.get<RoutineDayService>(RoutineDayService);
    exerciseService = module.get<ExerciseService>(ExerciseService);

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
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should complete a week marking all empty days as rest (no MongoId error)', async () => {
    await createWeekLog(app, authCookie);

    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    expect(week).toBeDefined();

    // Replica del payload del frontend: todos los días vienen vacíos ('').
    const days = Array.from({ length: 7 }, (_, i) => ({
      order: i + 1,
      workoutSessionId: '',
      isRest: false,
      status: 'pending',
    }));

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_WEEK_LOG,
        variables: {
          updateWeekLogInput: {
            id: week.id,
            completed: true,
            active: false,
            days,
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
    expect(updateResponse.body.errors).toBeUndefined();
    expect(updateResponse.body.data.updateWeekLog.completed).toBe(true);
    expect(updateResponse.body.data.updateWeekLog.active).toBe(false);

    const updatedDays = updateResponse.body.data.updateWeekLog.days;
    expect(updatedDays.length).toBe(7);
    for (const d of updatedDays) {
      expect(d.isRest).toBe(true);
      expect(d.status).toBe('skipped');
      expect(d.workoutSessionId).toBeNull();
    }
  });

  it('should preserve a worked day and only rest the empty ones', async () => {
    await createWeekLog(app, authCookie);

    const activeWeekResponse = await getActiveWeekLog(app, authCookie);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    expect(week).toBeDefined();

    // Crear un ejercicio y una rutina para dársela al primer día.
    const ex = (await exerciseService.create({
      name: 'Chest Press',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const routineDay = (await routineDayService.create({
      title: 'Chest Day',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex.id, order: 1 }],
    })) as any;

    // Asignar la rutina al día 1 (crea/vincula su WorkoutSession con ejercicios).
    const firstDayDate = new Date(week.days[0].date)
      .toISOString()
      .split('T')[0];

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: ASSIGN_ROUTINE_TO_WEEK_DAY,
        variables: {
          routineDayId: routineDay.id,
          date: firstDayDate,
        },
      });

    if (assignResponse.body.errors) {
      console.log(
        'Assign Errors:',
        JSON.stringify(assignResponse.body.errors, null, 2),
      );
    }
    expect(assignResponse.status).toBe(200);

    const afterAssign = await getActiveWeekLog(app, authCookie);
    const workedDayId = afterAssign.body.data.activeWeekLog.week.days[0]
      .workoutSessionId;
    expect(workedDayId).toBeDefined();

    const days = Array.from({ length: 7 }, (_, i) => ({
      order: i + 1,
      workoutSessionId: i === 0 ? workedDayId : '',
      isRest: false,
      status: 'pending',
    }));

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_WEEK_LOG,
        variables: {
          updateWeekLogInput: {
            id: week.id,
            completed: true,
            days,
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
    expect(updateResponse.body.errors).toBeUndefined();

    const updatedDays = updateResponse.body.data.updateWeekLog.days;
    // Día 1 (trabajado): se conserva con su WS, no es descanso.
    expect(updatedDays[0].isRest).toBe(false);
    expect(updatedDays[0].status).toBe('pending');
    expect(updatedDays[0].workoutSessionId).toBe(workedDayId);

    // Días 2-7 (vacíos): se convierten en descanso.
    for (let i = 1; i < 7; i++) {
      expect(updatedDays[i].isRest).toBe(true);
      expect(updatedDays[i].status).toBe('skipped');
      expect(updatedDays[i].workoutSessionId).toBeNull();
    }
  });
});
