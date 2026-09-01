import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import { getCookieWithToken } from '../helpers/week-log.helper';
import { createDayLog, todayLocalDate } from '../helpers/day-log.helper';
import cookieParser from 'cookie-parser';

describe('DayLog update (updateDayLog / updateDayLogStatus) (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
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

  it('should update day-log notes and complete it (deactivates it)', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: {
              id: "${dayId}",
              notes: "great session",
              completed: true
            }) {
              id
              notes
              completed
              active
            }
          }
        `,
      });

    expect(updateResponse.status).toBe(200);
    const day = updateResponse.body.data.updateDayLog;
    expect(day.id).toBe(dayId);
    expect(day.notes).toBe('great session');
    expect(day.completed).toBe(true);
    expect(day.active).toBe(false);
  });

  it('should set the day as rest via updateDayLogStatus', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const restResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLogStatus(date: "${todayLocalDate()}", isRest: true) {
              id
              status
              workoutSessionId
            }
          }
        `,
      });

    expect(restResponse.status).toBe(200);
    const rest = restResponse.body.data.updateDayLogStatus;
    expect(rest.id).toBe(dayId);
    expect(rest.status).toBe('skipped');
    expect(rest.workoutSessionId).toBeNull();
  });

  it('should set the day back to pending and create a workout session via updateDayLogStatus', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const pendingResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLogStatus(date: "${todayLocalDate()}", isRest: false) {
              id
              status
              workoutSessionId
            }
          }
        `,
      });

    expect(pendingResponse.status).toBe(200);
    const pending = pendingResponse.body.data.updateDayLogStatus;
    expect(pending.id).toBe(dayId);
    expect(pending.status).toBe('pending');
    expect(pending.workoutSessionId).toBeDefined();
  });
});
