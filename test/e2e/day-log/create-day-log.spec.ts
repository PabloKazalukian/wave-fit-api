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
import { createDayLog, todayLocalDate } from '../helpers/day-log.helper';
import cookieParser from 'cookie-parser';

describe('DayLog Creation + Internal Exclusivity (e2e)', () => {
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

  it('should create an active day-log without plan/routine', async () => {
    const response = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
      notes: 'free day',
    });

    expect(response.status).toBe(200);
    if (response.body.errors) {
      console.log('GraphQL Errors:', JSON.stringify(response.body.errors));
    }
    const day = response.body.data.createDayLog;
    expect(day).toBeDefined();
    expect(day.active).toBe(true);
    expect(day.completed).toBe(false);
    expect(day.status).toBe('pending');
    expect(day.workoutSessionId).toBeNull();
    expect(day.extraSessionIds).toHaveLength(0);
    expect(day.notes).toBe('free day');
  });

  it('should reject creation with an invalid date format', async () => {
    const response = await createDayLog(app, authCookie, {
      date: '31/08/2026',
    });

    expect(response.status).toBe(200); // GraphQL HTTP 200 with error in body
    expect(response.body.errors).toBeDefined();
  });

  it('should fail to create a second active day-log (internal exclusivity)', async () => {
    const first = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(first.status).toBe(200);

    const second = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });

    expect(second.status).toBe(200); // GraphQL HTTP 200 with error in body
    expect(second.body.errors).toBeDefined();
    const message = JSON.stringify(second.body.errors);
    expect(message).toContain('Already active day-log');
  });

  it('should create a day-log with a routineDayId and generate a workout session', async () => {
    const ex1 = (await exerciseService.create({
      name: 'Chest Press',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;

    const routineDay = (await routineDayService.create({
      title: 'Chest Day',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const response = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
      routineDayId: routineDay.id,
    });

    expect(response.status).toBe(200);
    const day = response.body.data.createDayLog;
    expect(day).toBeDefined();
    expect(day.routineDayId).toBe(routineDay.id);
    expect(day.workoutSessionId).toBeDefined();
    expect(day.exercises).toHaveLength(1);
    expect(day.exercises[0].exerciseId).toBe(ex1.id);
    expect(day.exercises[0].series).toBe(0);
    expect(day.exercises[0].sets).toEqual([]);
  });

  it('should not require authentication to create (guard blocks)', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            createDayLog(createDayLogInput: {
              date: "${todayLocalDate()}",
              timezone: "America/Argentina/Buenos_Aires"
            }) { id }
          }
        `,
      });

    expect(response.body.errors).toBeDefined();
  });
});
