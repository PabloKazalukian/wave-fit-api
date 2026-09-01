import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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

describe('DayLog workout-session & extra-session removal (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let exerciseService: ExerciseService;
  let routineDayService: RoutineDayService;
  let dayLogModel: Model<any>;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    exerciseService = module.get<ExerciseService>(ExerciseService);
    routineDayService = module.get<RoutineDayService>(RoutineDayService);
    dayLogModel = module.get<Model<any>>(getModelToken('DayLog'));

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

  async function createDayWithWorkoutSession() {
    const ex1 = (await exerciseService.create({
      name: 'Dumbbell Curl',
      category: ExerciseCategory.BACK,
      usesWeight: false,
    })) as any;

    const routineDay = (await routineDayService.create({
      title: 'Arms Day',
      type: [ExerciseCategory.BACK],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;

    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
      routineDayId: routineDay.id,
    });
    expect(dayResponse.status).toBe(200);
    const day = dayResponse.body.data.createDayLog;
    expect(day.workoutSessionId).toBeDefined();
    return day;
  }

  it('should remove the workout session from the active day-log', async () => {
    const day = await createDayWithWorkoutSession();

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeWorkoutSessionFromDayLog(workoutSessionId: "${day.workoutSessionId}") {
              id
              workoutSessionId
              status
            }
          }
        `,
      });

    expect(removeResponse.status).toBe(200);
    const result = removeResponse.body.data.removeWorkoutSessionFromDayLog;
    expect(result.id).toBe(day.id);
    expect(result.workoutSessionId).toBeNull();
    expect(result.status).toBe('pending');
  });

  it('should remove an extra session from the active day-log', async () => {
    const day = await createDayWithWorkoutSession();

    // 1. Create an extra session linked to the day-log workout session
    const esResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createExtraSession(createExtraSessionInput: {
              workoutSessionId: "${day.workoutSessionId}",
              date: "${todayLocalDate()}",
              discipline: "running",
              duration: 30,
              intensityLevel: 3
            }) { id }
          }
        `,
      });

    expect(esResponse.status).toBe(200);
    if (esResponse.body.errors) {
      console.log('createExtraSession errors:', JSON.stringify(esResponse.body.errors));
    }
    const extraSessionId = esResponse.body.data?.createExtraSession?.id;
    expect(extraSessionId).toBeDefined();

    // 2. Manually link the extra session to the day-log (there is no resolver mutation to add it)
    await dayLogModel.updateOne(
      { _id: new Types.ObjectId(day.id) },
      { $set: { extraSessionIds: [new Types.ObjectId(extraSessionId)] } },
    );

    // 3. Remove it via removeExtraSessionFromDayLog
    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeExtraSessionFromDayLog(extraSessionId: "${extraSessionId}") {
              id
              extraSessionIds
            }
          }
        `,
      });

    expect(removeResponse.status).toBe(200);
    const result = removeResponse.body.data.removeExtraSessionFromDayLog;
    expect(result.id).toBe(day.id);
    expect(result.extraSessionIds).toHaveLength(0);
  });

  it('should fail to remove an extra session that does not belong to the day-log', async () => {
    const day = await createDayWithWorkoutSession();

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeExtraSessionFromDayLog(extraSessionId: "000000000000000000000000") {
              id
            }
          }
        `,
      });

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.errors).toBeDefined();
  });
});