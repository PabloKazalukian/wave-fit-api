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
  testUser,
} from '../../fixtures/user.fixture';

describe('Login (e2e)', () => {
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

  it('should login with valid credentials and set cookie', async () => {
    const { identifier, password } = getTestUserCredentials();

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "${identifier}", password: "${password}")
          }
        `,
      })
      .expect(200);

    expect(response.body.data?.login).toBe(true);

    const cookies = response.headers['set-cookie'] as
      | string
      | string[]
      | undefined;
    expect(cookies).toBeDefined();
    const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieArray.some((c: string) => c.includes('token='))).toBe(true);
  });

  it('should fail login with incorrect password', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "test@wavefit.com", password: "wrongpassword")
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('Invalid credentials');
  });

  it('should fail login with non-existent user', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "nonexistent@wavefit.com", password: "password123")
          }
        `,
      })
      .expect(200);

    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('Invalid credentials');
  });
});
