import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { ExerciseService } from '../../../src/modules/routines/templates/exercise/exercise.service';
import { RoutineDayService } from '../../../src/modules/routines/templates/routine-day/routine-day.service';
import { ExerciseCategory } from '../../../src/modules/routines/templates/exercise/entities/exercise.entity';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import { getCookieWithToken } from '../helpers/week-log.helper';
import {
  createDayLog,
  getActiveDayLog,
  todayLocalDate,
} from '../helpers/day-log.helper';
import cookieParser from 'cookie-parser';

describe('DayLog assignRoutineToDayLog (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let exerciseService: ExerciseService;
  let routineDayService: RoutineDayService;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    exerciseService = module.get<ExerciseService>(ExerciseService);
    routineDayService = module.get<RoutineDayService>(RoutineDayService);

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

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should assign a routine to the active day-log and create a workout session', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Bench Press',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const routineDay = (await routineDayService.create({
      title: 'Chest Day',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            assignRoutineToDayLog(routineDayId: "${routineDay.id}", date: "${todayLocalDate()}") {
              id
              routineDayId
              workoutSessionId
              status
              exercises {
                exerciseId
                series
                sets {
                  reps
                  weights
                }
              }
            }
          }
        `,
      });

    expect(assignResponse.status).toBe(200);
    const assigned = assignResponse.body.data.assignRoutineToDayLog;
    expect(assigned.id).toBe(dayId);
    expect(assigned.routineDayId).toBe(routineDay.id);
    expect(assigned.workoutSessionId).toBeDefined();
    expect(assigned.status).toBe('pending');
    expect(assigned.exercises).toHaveLength(1);
    expect(assigned.exercises[0].exerciseId).toBe(ex1.id);
  });

  it('should fail to assign a routine when there is no active day-log', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Push Up',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const routineDay = (await routineDayService.create({
      title: 'Upper',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            assignRoutineToDayLog(routineDayId: "${routineDay.id}", date: "${todayLocalDate()}") {
              id
            }
          }
        `,
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.errors).toBeDefined();
  });

  it('should fail with a non-existent routine day', async () => {
    await createDayLog(app, authCookie, { date: todayLocalDate() });

    const assignResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            assignRoutineToDayLog(routineDayId: "000000000000000000000000", date: "${todayLocalDate()}") {
              id
            }
          }
        `,
      });

    expect(assignResponse.status).toBe(200);
    expect(assignResponse.body.errors).toBeDefined();
  });
});
