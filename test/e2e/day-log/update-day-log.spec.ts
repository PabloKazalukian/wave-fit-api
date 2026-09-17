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

  it('should create a WorkoutSession from the workoutSession block', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    const dayId = dayResponse.body.data.createDayLog.id;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: {
              id: "${dayId}",
              workoutSession: {
                status: "complete",
                exercises: [
                  {
                    exerciseId: "507f1f77bcf86cd799439099",
                    series: 1,
                    sets: [{ reps: 10, weights: 40 }]
                  }
                ]
              }
            }) {
              id
              status
              active
              completed
              workoutSessionId
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const day = response.body.data.updateDayLog;
    expect(day.workoutSessionId).not.toBeNull();
    expect(day.completed).toBe(false);
    expect(day.active).toBe(true);
  });

  it('should finalize the day via updateDayLog (active false) and auto-create a WS, without touching status', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    const dayId = dayResponse.body.data.createDayLog.id;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: { id: "${dayId}", completed: true }) {
              id
              status
              active
              completed
              workoutSessionId
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const day = response.body.data.updateDayLog;
    expect(day.completed).toBe(true);
    expect(day.active).toBe(false);
    expect(day.status).toBe('pending');
    expect(day.workoutSessionId).not.toBeNull();
  });

  it('should persist status="complete" as a front-only field (completed stays false, day stays active)', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    const dayId = dayResponse.body.data.createDayLog.id;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: { id: "${dayId}", status: "complete" }) {
              id
              status
              active
              completed
              workoutSessionId
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const day = response.body.data.updateDayLog;
    expect(day.status).toBe('complete');
    expect(day.completed).toBe(false);
    expect(day.active).toBe(true);
  });

  it('should persist status="skipped" without removing the WS or changing completed/active', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    const dayId = dayResponse.body.data.createDayLog.id;

    const wsResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: {
              id: "${dayId}",
              workoutSession: { status: "not_started", exercises: [] }
            }) {
              workoutSessionId
            }
          }
        `,
      });
    const wsId = wsResponse.body.data.updateDayLog.workoutSessionId;
    expect(wsId).not.toBeNull();

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: { id: "${dayId}", status: "skipped" }) {
              id
              status
              active
              completed
              workoutSessionId
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const day = response.body.data.updateDayLog;
    expect(day.status).toBe('skipped');
    expect(day.completed).toBe(false);
    expect(day.active).toBe(true);
    expect(day.workoutSessionId).toBe(wsId);
  });

  it('should keep the day active and not completed when set as rest', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    const dayId = dayResponse.body.data.createDayLog.id;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLogStatus(date: "${todayLocalDate()}", isRest: true) {
              id
              status
              active
              completed
              workoutSessionId
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const day = response.body.data.updateDayLogStatus;
    expect(day.id).toBe(dayId);
    expect(day.status).toBe('skipped');
    expect(day.completed).toBe(false);
    expect(day.active).toBe(true);
    expect(day.workoutSessionId).toBeNull();
  });

  it('should toggle back from rest to pending keeping completed=false', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    const dayId = dayResponse.body.data.createDayLog.id;

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `mutation { updateDayLogStatus(date: "${todayLocalDate()}", isRest: true) { id } }`,
      });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateDayLogStatus(date: "${todayLocalDate()}", isRest: false) {
              id
              status
              active
              completed
              workoutSessionId
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const day = response.body.data.updateDayLogStatus;
    expect(day.id).toBe(dayId);
    expect(day.status).toBe('pending');
    expect(day.completed).toBe(false);
    expect(day.active).toBe(true);
    expect(day.workoutSessionId).not.toBeNull();
  });
});
