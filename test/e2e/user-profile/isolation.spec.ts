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
  FIND_USER_PROFILE,
  MY_PROFILE,
  UPDATE_USER_PROFILE,
  UPDATE_USER_GOALS,
  USER_GOALS,
} from '../../apollo/user-profile.queries';
import { getCookieWithToken } from '../helpers/week-log.helper';
import {
  createProfile,
  createSecondUserAndLogin,
  VALID_PROFILE_INPUT,
} from '../helpers/user-profile.helper';
import cookieParser from 'cookie-parser';

describe('UserProfile isolation between users (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;
  let otherCookie: string;

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
    otherCookie = await createSecondUserAndLogin(app, userService);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should not expose user A profile to user B via myProfile or userProfile(id)', async () => {
    const createResponse = await createProfile(app, authCookie);
    const profileAId = createResponse.body.data.createUserProfile.id;
    expect(createResponse.body.data.createUserProfile.userId).toBeDefined();

    const myProfileResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({ query: MY_PROFILE });

    expect(myProfileResponse.status).toBe(200);
    expect(myProfileResponse.body.errors).toBeUndefined();
    expect(myProfileResponse.body.data.myProfile).toBeNull();

    const findResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: FIND_USER_PROFILE,
        variables: { id: profileAId },
      });

    expect(findResponse.status).toBe(200);
    expect(findResponse.body.errors).toBeUndefined();
    expect(findResponse.body.data.userProfile).toBeNull();
  });

  it('should reject user B updating the profile of user A', async () => {
    const createResponse = await createProfile(app, authCookie);
    const profileAId = createResponse.body.data.createUserProfile.id;

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({
        query: UPDATE_USER_PROFILE,
        variables: {
          input: { id: profileAId, weightKg: 70 },
        },
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeDefined();
    expect(updateResponse.body.errors[0].message).toContain(
      'User profile not found',
    );

    // El perfil de A permanece intacto
    const verifyResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: MY_PROFILE });

    expect(verifyResponse.body.data.myProfile.weightKg).toBe(75);
  });

  it('should allow each user to have and see their own profile', async () => {
    const responseA = await createProfile(app, authCookie);
    const profileAId = responseA.body.data.createUserProfile.id;

    const responseB = await createProfile(app, otherCookie, {
      ...VALID_PROFILE_INPUT,
      gender: 'F',
      weightKg: 60,
    });
    expect(responseB.status).toBe(200);
    expect(responseB.body.errors).toBeUndefined();

    const profileBId = responseB.body.data.createUserProfile.id;
    expect(profileBId).not.toBe(profileAId);

    const myProfileAResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query: MY_PROFILE });
    expect(myProfileAResponse.body.data.myProfile.gender).toBe('M');

    const myProfileBResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({ query: MY_PROFILE });
    expect(myProfileBResponse.body.data.myProfile.gender).toBe('F');
    expect(myProfileBResponse.body.data.myProfile.weightKg).toBe(60);
  });

  it('should not expose goals of user A to user B', async () => {
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_USER_GOALS,
        variables: {
          input: {
            primaryGoal: 'strength',
            trainingExperience: 'advanced',
          },
        },
      });

    const goalsBResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [otherCookie])
      .send({ query: USER_GOALS });

    expect(goalsBResponse.status).toBe(200);
    expect(goalsBResponse.body.errors).toBeUndefined();
    expect(goalsBResponse.body.data.userGoals).toBeNull();
  });
});
