import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { UserRole } from '../../../src/modules/user/schema/user.schema';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import {
  createAndCompleteWeekLog,
  getCookieWithToken,
} from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('WeekLog findOne (e2e)', () => {
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
    await clearDatabase(app.get(getConnectionToken()));
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
    await clearDatabase(app.get(getConnectionToken()));
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  async function completeActiveWeek() {
    const activeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            activeWeekLog {
              hasActiveWeek
              week {
                id
              }
            }
          }
        `,
      });

    if (activeResponse.body.data?.activeWeekLog?.hasActiveWeek) {
      const weekId = activeResponse.body.data.activeWeekLog.week.id;
      await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', [authCookie])
        .send({
          query: `
            mutation {
              updateWeekLog(input: {
                id: "${weekId}"
                completed: true
                active: false
              }) {
                id
              }
            }
          `,
        });
    }
  }

  it('should return week-log with correct data types', async () => {
    await completeActiveWeek();
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().split('T')[0]}",
              endDate: "${endOfWeek.toISOString().split('T')[0]}",
              timezone: "America/Argentina/Buenos_Aires"
            }) {
              id
            }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    const weekLogId = createResponse.body.data.createWeekLog.id;

    const findResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findOne(id: "${weekLogId}") {
              id
              userId
              startDate
              endDate
              planId
              notes
              completed
              active
              days {
                order
                date
                isRest
                workoutSessionId
                extraSessionIds
                status
              }
            }
          }
        `,
      });

    if (findResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(findResponse.body.errors, null, 2),
      );
    }

    expect(findResponse.status).toBe(200);
    const data = findResponse.body.data.findOne;

    expect(data.id).toBe(weekLogId);
    expect(data.userId).toBeDefined();
    expect(typeof data.userId).toBe('string');
    expect(data.startDate).toBeDefined();
    expect(data.endDate).toBeDefined();
    expect(typeof data.completed).toBe('boolean');
    expect(typeof data.active).toBe('boolean');
    expect(Array.isArray(data.days)).toBe(true);
    expect(data.days.length).toBe(7);

    data.days.forEach((day: any) => {
      expect(typeof day.order).toBe('number');
      expect(day.order).toBeGreaterThanOrEqual(1);
      expect(day.order).toBeLessThanOrEqual(7);
      expect(typeof day.date).toBe('string');
      expect(typeof day.isRest).toBe('boolean');
      expect(Array.isArray(day.extraSessionIds)).toBe(true);
      expect(typeof day.status).toBe('string');
    });
  });

  it('should only allow user to access their own week-logs', async () => {
    await completeActiveWeek();
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().split('T')[0]}",
              endDate: "${endOfWeek.toISOString().split('T')[0]}",
              timezone: "America/Argentina/Buenos_Aires"
            }) {
              id
            }
          }
        `,
      });

    const weekLogId = createResponse.body.data.createWeekLog.id;

    const otherUser = await userService.create({
      email: 'other@test.com',
      password: 'password123',
      name: 'Other User',
      role: UserRole.USER,
    });

    const otherLoginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "other@test.com", password: "password123")
            }
        `,
      });
    const otherCookie = getCookieWithToken(otherLoginResponse);

    const accessResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: `
          query {
            findOne(id: "${weekLogId}") {
              id
            }
          }
        `,
      });

    expect(accessResponse.status).toBe(200);
    expect(accessResponse.body.errors).toBeDefined();
    expect(accessResponse.body.errors[0].message).toContain('not found');
  });

  it('should return 404 for non-existent week-log', async () => {
    const fakeId = '507f1f77bcf86cd799439011';

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findOne(id: "${fakeId}") {
              id
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('not found');
  });

  it('should not return week-logs with invalid id format', async () => {
    const invalidId = 'invalid-id-format';

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findOne(id: "${invalidId}") {
              id
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
  });

  it('should not return deleted week-logs', async () => {
    const weekLogId = await createAndCompleteWeekLog(app, authCookie);

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${weekLogId}"
              completed: true
              active: false
            }) {
              id
            }
          }
        `,
      });

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeWeekLog(id: "${weekLogId}") {
              id
            }
          }
        `,
      });

    const findResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findOne(id: "${weekLogId}") {
              id
            }
          }
        `,
      });

    expect(findResponse.status).toBe(200);
    expect(findResponse.body.errors).toBeDefined();
    expect(findResponse.body.errors[0].message).toContain('not found');
  });
});
