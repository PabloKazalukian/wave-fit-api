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
  CREATE_USER_PROFILE,
  UPSERT_USER_PROFILE,
  FIND_ALL_USER_PROFILES,
  MY_PROFILE,
} from '../../apollo/user-profile.queries';
import { getCookieWithToken } from '../helpers/week-log.helper';
import { VALID_PROFILE_INPUT } from '../helpers/user-profile.helper';
import cookieParser from 'cookie-parser';

describe('CreateUserProfile (e2e)', () => {
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

  it('should return null on myProfile when user has no profile', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: MY_PROFILE });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.myProfile).toBeNull();
  });

  it('should return an empty list of userProfiles when no profiles exist', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: FIND_ALL_USER_PROFILES });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.userProfiles).toEqual([]);
  });

  it('should create a profile from an empty user', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: { input: VALID_PROFILE_INPUT },
      });

    if (response.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const profile = response.body.data.createUserProfile;
    expect(profile.id).toBeDefined();
    expect(profile.userId).toBeDefined();
    expect(typeof profile.userId).toBe('string');
    expect(profile.gender).toBe('M');
    expect(profile.birthDate).toContain('1995-06-15');
    expect(profile.heightCm).toBe(178);
    expect(profile.weightKg).toBe(75);
    expect(profile.bodyFatPct).toBe(18);
    // Default aplicado por el backend
    expect(profile.unitsPreference).toBe('metric');
    expect(profile.createdAt).toBeDefined();
    expect(profile.updatedAt).toBeDefined();
  });

  it('should create a profile with only required fields and null optionals', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: {
          input: {
            gender: 'F',
            birthDate: '2000-01-31T00:00:00.000Z',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const profile = response.body.data.createUserProfile;
    expect(profile.gender).toBe('F');
    expect(profile.birthDate).toContain('2000-01-31');
    expect(profile.heightCm).toBeNull();
    expect(profile.weightKg).toBeNull();
    expect(profile.bodyFatPct).toBeNull();
  });

  it('should persist the created profile and return it via myProfile', async () => {
    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: { input: VALID_PROFILE_INPUT },
      });
    expect(createResponse.status).toBe(200);
    const createdId = createResponse.body.data.createUserProfile.id;
    const createdUserId =
      createResponse.body.data.createUserProfile.userId;

    const myProfileResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: MY_PROFILE });

    expect(myProfileResponse.status).toBe(200);
    const profile = myProfileResponse.body.data.myProfile;
    expect(profile).not.toBeNull();
    expect(profile.id).toBe(createdId);
    expect(profile.userId).toBe(createdUserId);
    expect(profile.weightKg).toBe(75);
  });

  it('should reject creating a second profile for the same user', async () => {
    const firstResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: { input: VALID_PROFILE_INPUT },
      });
    expect(firstResponse.status).toBe(200);
    expect(firstResponse.body.errors).toBeUndefined();

    const duplicateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: {
          input: { ...VALID_PROFILE_INPUT, gender: 'F' },
        },
      });

    expect(duplicateResponse.status).toBe(200);
    expect(duplicateResponse.body.errors).toBeDefined();
    expect(duplicateResponse.body.errors[0].message).toContain(
      'already has a profile',
    );
  });

  it('should reject an invalid gender value', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: {
          input: { ...VALID_PROFILE_INPUT, gender: 'X' },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.data?.createUserProfile).toBeFalsy();
  });

  it('should reject an invalid birthDate value', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: {
          input: { ...VALID_PROFILE_INPUT, birthDate: 'not-a-date' },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.data?.createUserProfile).toBeFalsy();
  });

  it('should reject heightCm below the allowed range', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: CREATE_USER_PROFILE,
        variables: {
          input: { ...VALID_PROFILE_INPUT, heightCm: 30 },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.data?.createUserProfile).toBeFalsy();
  });

  it('should create a profile via upsertUserProfile when user is empty', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPSERT_USER_PROFILE,
        variables: { input: VALID_PROFILE_INPUT },
      });

    if (response.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const profile = response.body.data.upsertUserProfile;
    expect(profile.id).toBeDefined();
    expect(profile.gender).toBe('M');
    expect(profile.heightCm).toBe(178);
  });
});
