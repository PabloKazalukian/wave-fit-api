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
import {
  getCookieWithToken,
  createWeekLog,
} from '../helpers/week-log.helper';
import {
  createDayLog,
  getActiveDayLog,
  todayLocalDate,
} from '../helpers/day-log.helper';
import cookieParser from 'cookie-parser';

describe('DayLog Cross-Exclusivity + activeTracking (e2e)', () => {
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

  it('should fail to create a day-log when a week-log is active (cross-exclusivity)', async () => {
    const weekResponse = await createWeekLog(app, authCookie);
    expect(weekResponse.body.data.createWeekLog).toBeDefined();

    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });

    expect(dayResponse.status).toBe(200);
    expect(dayResponse.body.errors).toBeDefined();
    const message = JSON.stringify(dayResponse.body.errors);
    expect(message).toContain('Already active week-log');
  });

  it('should fail to create a week-log when a day-log is active (cross-exclusivity)', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);

    const weekResponse = await createWeekLog(app, authCookie);
    expect(weekResponse.status).toBe(200);
    expect(weekResponse.body.errors).toBeDefined();
    const message = JSON.stringify(weekResponse.body.errors);
    expect(message).toContain('Already active day-log');
  });

  it('activeTracking should report type DAY_LOG when a day-log is active', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);
    const dayId = dayResponse.body.data.createDayLog.id;

    const trackingResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            activeTracking {
              hasActive
              type
              day { id }
              week { id }
            }
          }
        `,
      });

    expect(trackingResponse.status).toBe(200);
    const active = trackingResponse.body.data.activeTracking;
    expect(active.hasActive).toBe(true);
    expect(active.type).toBe('DAY_LOG');
    expect(active.day.id).toBe(dayId);
    expect(active.week).toBeNull();
  });

  it('activeTracking should report hasActive=false when nothing is active', async () => {
    const trackingResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            activeTracking {
              hasActive
              type
              day { id }
              week { id }
            }
          }
        `,
      });

    expect(trackingResponse.status).toBe(200);
    const active = trackingResponse.body.data.activeTracking;
    expect(active.hasActive).toBe(false);
    expect(active.type).toBeNull();
  });

  it('activeDayLog should return hasActiveDay true with the created day', async () => {
    const dayResponse = await createDayLog(app, authCookie, {
      date: todayLocalDate(),
    });
    expect(dayResponse.status).toBe(200);

    const activeResponse = await getActiveDayLog(app, authCookie);
    expect(activeResponse.status).toBe(200);
    expect(activeResponse.body.data.activeDayLog.hasActiveDay).toBe(true);
    expect(activeResponse.body.data.activeDayLog.day).toBeDefined();
  });
});
