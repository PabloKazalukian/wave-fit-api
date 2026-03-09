import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { WeekLogService } from '../../../src/modules/routines/tracking/week-log/week-log.service';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';

function getCookieWithToken(loginResponse: any): string {
  const cookies = loginResponse.headers['set-cookie'] as
    | string
    | string[]
    | undefined;
  if (!cookies) return '';
  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const tokenCookie = cookieArray.find((c: string) => c.startsWith('token='));
  return tokenCookie || '';
}

describe('activeWeekLog (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let weekLogService: WeekLogService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    weekLogService = module.get<WeekLogService>(WeekLogService);

    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    await createTestUser(userService);
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should return hasActiveWeek: false when no week exists', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
          }
        `,
      });

    const cookie = getCookieWithToken(loginResponse);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
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
      })
      .expect(200);

    expect(response.body.data.activeWeekLog.hasActiveWeek).toBe(false);
    expect(response.body.data.activeWeekLog.week).toBeNull();
  });

  it('should return hasActiveWeek: true when week exists', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
          }
        `,
      });

    const cookie = getCookieWithToken(loginResponse);
    const user = await userService.findByEmail('test@wavefit.com');

    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query: `
          mutation {
            createWeekLog(input: {
              startDate: "${startOfWeek.toISOString()}",
              endDate: "${endOfWeek.toISOString()}"
            }) {
              id
              startDate
              endDate
            }
          }
        `,
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({
        query: `
          query {
            activeWeekLog {
              hasActiveWeek
              week {
                id
                startDate
                endDate
              }
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.data.activeWeekLog.hasActiveWeek).toBe(true);
    expect(response.body.data.activeWeekLog.week).toBeDefined();
    expect(response.body.data.activeWeekLog.week.startDate).toBeDefined();
  });

  it('should fail when not authenticated', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            activeWeekLog {
              hasActiveWeek
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('authorization');
  });
});
