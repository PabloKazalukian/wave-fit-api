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

describe('DayLog CRUD (findAll / findOne / remove) (e2e)', () => {
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

  it('should list day-logs via dayLogFindAll', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const listResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            dayLogFindAll {
              id
              date
              status
            }
          }
        `,
      });

    expect(listResponse.status).toBe(200);
    const days = listResponse.body.data.dayLogFindAll;
    expect(days.some((d: any) => d.id === dayId)).toBe(true);
  });

  it('should fetch a day-log by id via dayLogFindOne', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const findResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            dayLogFindOne(id: "${dayId}") {
              id
              userId
              date
            }
          }
        `,
      });

    expect(findResponse.status).toBe(200);
    expect(findResponse.body.data.dayLogFindOne.id).toBe(dayId);
  });

  it('should remove a day-log via removeDayLog', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const removeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeDayLog(id: "${dayId}") {
              id
            }
          }
        `,
      });

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.data.removeDayLog).toBeDefined();

    // Now there should be no active day and no longer visible
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
    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.data.activeDayLog.hasActiveDay).toBe(false);
  });
});
