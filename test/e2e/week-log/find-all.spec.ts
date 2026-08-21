import { Test, TestingModule } from '@nestjs/testing';
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
import { getCookieWithToken } from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

describe('WeekLog findAll (e2e)', () => {
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

  afterEach(async () => {
    await clearDatabase();
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

  it('should return only completed (inactive) week-logs for user', async () => {
    await completeActiveWeek();
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const createRes = await request(app.getHttpServer())
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

    const newWeekId = createRes.body.data.createWeekLog.id;
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${newWeekId}"
              completed: true
              active: false
            }) {
              id
            }
          }
        `,
      });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll(limit: 10, offset: 0) {
              id
              userId
              active
              completed
              startDate
              endDate
              days {
                order
              }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const data = response.body.data.findAll;

    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    data.forEach((weekLog: any) => {
      expect(weekLog.active).toBe(false);
      expect(weekLog.completed).toBe(true);
      expect(weekLog.userId).toBeDefined();
      expect(weekLog.days).toHaveLength(7);
    });
  });

  it('should not return active week-logs in findAll', async () => {
    await completeActiveWeek();
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    await request(app.getHttpServer())
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
              active
            }
          }
        `,
      });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
              id
              active
            }
          }
        `,
      });

    const data = response.body.data.findAll;
    data.forEach((weekLog: any) => {
      expect(weekLog.active).toBe(false);
    });
  });

  it('should only return week-logs of the authenticated user', async () => {
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
              userId
            }
          }
        `,
      });

    // findAll solo devuelve semanas completadas: se completa la creada
    const createdWeekId = createResponse.body.data.createWeekLog.id;
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${createdWeekId}"
              completed: true
              active: false
            }) {
              id
            }
          }
        `,
      });

    const firstUserResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
              id
              userId
            }
          }
        `,
      });

    const firstUserIds = firstUserResponse.body.data.findAll.map(
      (w: any) => w.userId,
    );
    const uniqueUserIds = [...new Set(firstUserIds)];
    expect(uniqueUserIds.length).toBe(1);

    await userService.create({
      email: 'other2@test.com',
      password: 'password123',
      name: 'Other User 2',
      role: UserRole.USER,
    });

    const otherLoginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "other2@test.com", password: "password123")
            }
        `,
      });
    const otherCookie = getCookieWithToken(otherLoginResponse);

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
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

    const firstUserAfterResponse = await request(app.getHttpServer())
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

    const firstUserCount = firstUserAfterResponse.body.data.findAll.length;

    const secondUserResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: `
          query {
            findAll {
              id
            }
          }
        `,
      });

    const secondUserCount = secondUserResponse.body.data.findAll.length;

    expect(firstUserCount).not.toBe(secondUserCount);
  });

  it('should support pagination with limit and offset', async () => {
    await completeActiveWeek();
    const today = new Date();

    for (let i = 0; i < 3; i++) {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay() - i * 14);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      await request(app.getHttpServer())
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

      const activeResponse = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', [authCookie])
        .send({
          query: `
            query {
              activeWeekLog {
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

    const limit2Response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll(limit: 2, offset: 0) {
              id
            }
          }
        `,
      });

    const limit2Data = limit2Response.body.data.findAll;
    expect(limit2Data.length).toBeLessThanOrEqual(2);

    const offset1Response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll(limit: 10, offset: 1) {
              id
            }
          }
        `,
      });

    const offset1Data = offset1Response.body.data.findAll;
    if (limit2Data.length > 0 && offset1Data.length > 0) {
      expect(limit2Data[0].id).not.toBe(offset1Data[0].id);
    }
  });

  it('should return empty array when user has no week-logs', async () => {
    await userService.create({
      email: 'newuser@test.com',
      password: 'password123',
      name: 'New User',
      role: UserRole.USER,
    });

    const newUserLoginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
            mutation {
                login(identifier: "newuser@test.com", password: "password123")
            }
        `,
      });
    const newUserCookie = getCookieWithToken(newUserLoginResponse);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [newUserCookie])
      .send({
        query: `
          query {
            findAll {
              id
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    expect(response.body.data.findAll).toEqual([]);
  });

  it('should return correct data structure for each week-log', async () => {
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

    // findAll solo devuelve semanas completadas: se completa la creada
    const createdWeekId = createResponse.body.data.createWeekLog.id;
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${createdWeekId}"
              completed: true
              active: false
            }) {
              id
            }
          }
        `,
      });

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          query {
            findAll {
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

    const data = response.body.data.findAll;
    expect(data.length).toBeGreaterThan(0);

    data.forEach((weekLog: any) => {
      expect(typeof weekLog.id).toBe('string');
      expect(typeof weekLog.userId).toBe('string');
      expect(typeof weekLog.startDate).toBe('string');
      expect(typeof weekLog.endDate).toBe('string');
      expect(typeof weekLog.completed).toBe('boolean');
      expect(typeof weekLog.active).toBe('boolean');
      expect(Array.isArray(weekLog.days)).toBe(true);
      expect(weekLog.days.length).toBe(7);

      weekLog.days.forEach((day: any) => {
        expect(typeof day.order).toBe('number');
        expect(typeof day.date).toBe('string');
        expect(typeof day.isRest).toBe('boolean');
        expect(Array.isArray(day.extraSessionIds)).toBe(true);
        expect(typeof day.status).toBe('string');
      });
    });
  });
});
