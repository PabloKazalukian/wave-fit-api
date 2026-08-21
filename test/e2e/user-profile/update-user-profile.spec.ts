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
  UPDATE_USER_PROFILE,
  UPSERT_USER_PROFILE,
  FIND_ALL_USER_PROFILES,
  MY_PROFILE,
} from '../../apollo/user-profile.queries';
import { getCookieWithToken } from '../helpers/week-log.helper';
import {
  createProfile,
  VALID_PROFILE_INPUT,
} from '../helpers/user-profile.helper';
import cookieParser from 'cookie-parser';

describe('UpdateUserProfile (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;
  let profileId: string;

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

    // Perfil ya guardado para todos los tests de este spec
    const createResponse = await createProfile(app, authCookie);
    profileId = createResponse.body.data.createUserProfile.id;
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should update saved data (heightCm and weightKg)', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: {
            id: profileId,
            heightCm: 182,
            weightKg: 80.5,
          },
        },
      });

    if (response.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const updated = response.body.data.updateUserProfile;
    expect(updated.id).toBe(profileId);
    expect(updated.heightCm).toBe(182);
    expect(updated.weightKg).toBe(80.5);
  });

  it('should persist the changes retrievable via myProfile', async () => {
    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: {
            id: profileId,
            gender: 'other',
            birthDate: '1990-03-20T00:00:00.000Z',
          },
        },
      });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeUndefined();

    const myProfileResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: MY_PROFILE });

    expect(myProfileResponse.status).toBe(200);
    const profile = myProfileResponse.body.data.myProfile;
    expect(profile.gender).toBe('other');
    expect(profile.birthDate).toContain('1990-03-20');
    // Campos no modificados se mantienen
    expect(profile.heightCm).toBe(178);
    expect(profile.weightKg).toBe(75);
  });

  it('should support partial updates without touching other fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: {
            id: profileId,
            unitsPreference: 'imperial',
          },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const updated = response.body.data.updateUserProfile;
    expect(updated.unitsPreference).toBe('imperial');
    expect(updated.gender).toBe('M');
    expect(updated.birthDate).toContain('1995-06-15');
    expect(updated.heightCm).toBe(178);
    expect(updated.weightKg).toBe(75);
    expect(updated.bodyFatPct).toBe(18);
  });

  it('should update instead of duplicating when upsert is called on an existing profile', async () => {
    const upsertResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPSERT_USER_PROFILE,
        variables: {
          input: { ...VALID_PROFILE_INPUT, weightKg: 82 },
        },
      });

    expect(upsertResponse.status).toBe(200);
    expect(upsertResponse.body.errors).toBeUndefined();

    const upserted = upsertResponse.body.data.upsertUserProfile;
    expect(upserted.id).toBe(profileId);
    expect(upserted.weightKg).toBe(82);

    const listResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: FIND_ALL_USER_PROFILES });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.userProfiles.length).toBe(1);
  });

  it('should reject an invalid profile id format', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: { id: 'not-a-mongo-id', weightKg: 70 },
        },
      });

    // El @IsMongoId del DTO lo rechaza antes de llegar al resolver
    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.data?.updateUserProfile).toBeFalsy();
  });

  it('should reject an update when id is missing', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: { weightKg: 70 },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain('Invalid profile id');
  });

  it('should reject an update with a non-existent but valid ObjectId', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: { id: '507f1f77bcf86cd799439011', weightKg: 70 },
        },
      });

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].message).toContain(
      'User profile not found',
    );
  });
});
