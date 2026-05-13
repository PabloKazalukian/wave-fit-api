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

describe('WeekLog remove (e2e)', () => {
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

  it('should perform soft delete (mark as deleted)', async () => {
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

    const removeResponse = await request(app.getHttpServer())
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

    if (removeResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(removeResponse.body.errors, null, 2),
      );
    }

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.data.removeWeekLog).toBeDefined();
    expect(removeResponse.body.data.removeWeekLog.id).toBe(weekLogId);
  });

  it('should not return deleted week-log in findOne', async () => {
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

  it('should not return deleted week-log in findAll', async () => {
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

    const findAllBeforeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
              id
            }
          }
        `,
      });

    const countBefore = findAllBeforeResponse.body.data.findAll.length;

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

    const findAllAfterResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
              id
            }
          }
        `,
      });

    const countAfter = findAllAfterResponse.body.data.findAll.length;
    expect(countAfter).toBe(countBefore - 1);

    const ids = findAllAfterResponse.body.data.findAll.map((w: any) => w.id);
    expect(ids).not.toContain(weekLogId);
  });

  it('should not allow user to delete another users week-log', async () => {
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

    await userService.create({
      email: 'attacker@test.com',
      password: 'password123',
      name: 'Attacker User',
      role: UserRole.USER,
    });

    const attackerLoginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "attacker@test.com", password: "password123")
            }
        `,
      });
    const attackerCookie = getCookieWithToken(attackerLoginResponse);

    const deleteResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [attackerCookie])
      .send({
        query: `
          mutation {
            removeWeekLog(id: "${weekLogId}") {
              id
            }
          }
        `,
      });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.errors).toBeDefined();
    expect(deleteResponse.body.errors[0].message).toContain('not found');

    const verifyResponse = await request(app.getHttpServer())
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

    expect(verifyResponse.body.data.findOne).toBeDefined();
    expect(verifyResponse.body.data.findOne.id).toBe(weekLogId);
  });

  it('should return error when deleting non-existent week-log', async () => {
    const fakeId = '507f1f77bcf86cd799439011';

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeWeekLog(id: "${fakeId}") {
              id
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('not found');
  });

  it('should keep other week-logs intact when deleting one', async () => {
    const weekId1 = await createAndCompleteWeekLog(app, authCookie, 0);
    const weekId2 = await createAndCompleteWeekLog(app, authCookie, 1);

    const findAllBeforeResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
              id
            }
          }
        `,
      });

    const countBefore = findAllBeforeResponse.body.data.findAll.length;
    expect(countBefore).toBe(2);

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            removeWeekLog(id: "${weekId1}") {
              id
            }
          }
        `,
      });

    const findAllAfterResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
              id
            }
          }
        `,
      });

    const remainingIds = findAllAfterResponse.body.data.findAll.map(
      (w: any) => w.id,
    );
    expect(remainingIds).toHaveLength(1);
    expect(remainingIds).toContain(weekId2);
    expect(remainingIds).not.toContain(weekId1);
  });
});

function getWeekDates(
  baseDate: Date,
  daysOffset: number,
): { start: string; end: string } {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + daysOffset);

  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: endOfWeek.toISOString().split('T')[0],
  };
}
