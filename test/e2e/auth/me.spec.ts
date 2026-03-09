import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import cookieParser from 'cookie-parser';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';

describe('Me (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;

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
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should return current user when authenticated', async () => {
    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "${getTestUserCredentials().identifier}", password: "${getTestUserCredentials().password}")
          }
        `,
      });

    const cookies = loginResponse.headers['set-cookie'] as
      | string
      | string[]
      | undefined;

    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];

    const rawCookie = cookieArray.find((c: string) => c.startsWith('token='));

    const tokenCookie = rawCookie?.split(';')[0];

    const meResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [tokenCookie || ''])
      .send({
        query: `
      query {
        me {
          email
          name
          role
        }
      }
    `,
      })
      .expect(200);

    expect(meResponse.body.data.me).toBeDefined();
    expect(meResponse.body.data.me.email).toBe('test@wavefit.com');
    expect(meResponse.body.data.me.name).toBe('Test User');
  });

  it('should fail when not authenticated', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          query {
            me {
              email
              name
            }
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain(
      'No authorization header',
    );
  });
});
