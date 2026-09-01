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
import { createSecondUserAndLogin } from '../helpers/user-profile.helper';
import { createDayLog, todayLocalDate } from '../helpers/day-log.helper';
import cookieParser from 'cookie-parser';

describe('DayLog isolation between users (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;
  let otherCookie: string;

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
    otherCookie = await createSecondUserAndLogin(app, userService);
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should not expose user A day-log to user B via dayLogFindOne', async () => {
    const createResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(createResponse.status).toBe(200);
    const dayAId = createResponse.body.data.createDayLog.id;

    const findResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: `
          query {
            dayLogFindOne(id: "${dayAId}") {
              id
            }
          }
        `,
      });

    expect(findResponse.status).toBe(200);
    expect(findResponse.body.errors).toBeDefined();
  });

  it('should not include user A day-log in user B dayLogFindAll', async () => {
    await createDayLog(app, authCookie, { date: todayLocalDate() });

    const listResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: `
          query {
            dayLogFindAll {
              id
            }
          }
        `,
      });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.dayLogFindAll).toHaveLength(0);
  });

  it('should not let user B remove user A day-log', async () => {
    const createResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(createResponse.status).toBe(200);
    const dayAId = createResponse.body.data.createDayLog.id;

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: `
          mutation {
            removeDayLog(id: "${dayAId}") {
              id
            }
          }
        `,
      });

    expect(removeResponse.status).toBe(200);
    // User B must not be able to remove A's day-log (either null result or an error)
    const removedId = removeResponse.body.data?.removeDayLog?.id;
    expect(removedId).toBeUndefined();

    // A's day-log still active
    const activeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            activeDayLog {
              hasActiveDay
            }
          }
        `,
      });
    expect(activeResponse.body.data.activeDayLog.hasActiveDay).toBe(true);
  });

  it('should not let user B update user A day-log', async () => {
    const createResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(createResponse.status).toBe(200);
    const dayAId = createResponse.body.data.createDayLog.id;

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: `
          mutation {
            updateDayLog(input: {
              id: "${dayAId}",
              notes: "hacked"
            }) {
              id
              notes
            }
          }
        `,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeDefined();
  });
});
