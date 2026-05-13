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

describe('Logout (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);

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

  it('should logout and clear cookie', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
          }
        `,
      });

    const cookies = loginResponse.headers['set-cookie'];
    const cookieArray: string[] = Array.isArray(cookies)
      ? cookies
      : cookies
        ? [cookies]
        : [];
    const rawCookie = cookieArray.find((c: string) => c.startsWith('token='));
    const tokenCookie = rawCookie?.split(';')[0];

    const logoutResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [tokenCookie || ''])
      .send({
        query: `
          mutation {
            logout
          }
        `,
      })
      .expect(200);

    expect(logoutResponse.body.data.logout).toBe(true);

    const logoutCookies = logoutResponse.headers['set-cookie'];
    const logoutCookieArray: string[] = Array.isArray(logoutCookies)
      ? logoutCookies
      : logoutCookies
        ? [logoutCookies]
        : [];

    expect(
      logoutCookieArray.some(
        (c: string) =>
          c.includes('token=') &&
          (c.includes('Max-Age=0') || c.includes('Expires=')),
      ),
    ).toBe(true);
  });
});
