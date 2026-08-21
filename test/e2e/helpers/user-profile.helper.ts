import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { App } from 'supertest/types';
import { UserService } from '../../../src/modules/user/user.service';
import { UserRole } from '../../../src/modules/user/schema/user.schema';
import { USER_PROFILE_FIELDS } from '../../apollo/user-profile.queries';

export const VALID_PROFILE_INPUT = {
  gender: 'M',
  birthDate: '1995-06-15T00:00:00.000Z',
  heightCm: 178,
  weightKg: 75,
  bodyFatPct: 18,
  unitsPreference: 'metric',
};

export function createProfile(
  app: INestApplication<App>,
  cookie: string,
  input: Record<string, unknown> = VALID_PROFILE_INPUT,
) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        mutation CreateUserProfile($input: CreateUserProfileInput!) {
          createUserProfile(createUserProfileInput: $input) {
            ${USER_PROFILE_FIELDS}
          }
        }
      `,
      variables: { input },
    })
    .expect(200);
}

export function getMyProfile(app: INestApplication<App>, cookie: string) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        query myProfile {
          myProfile {
            ${USER_PROFILE_FIELDS}
          }
        }
      `,
    });
}

export async function createSecondUserAndLogin(
  app: INestApplication<App>,
  userService: UserService,
): Promise<string> {
  await userService.create({
    email: 'other@test.com',
    password: 'password123',
    name: 'Other User',
    role: UserRole.USER,
  });

  const loginResponse = await request(app.getHttpServer())
    .post('/graphql')
    .send({
      query: `
        mutation {
          login(identifier: "other@test.com", password: "password123")
        }
      `,
    });

  const cookies = loginResponse.headers['set-cookie'] as
    | string
    | string[]
    | undefined;
  if (!cookies) return '';
  const cookieArray = Array.isArray(cookies) ? cookies : [cookies];
  const tokenCookie = cookieArray.find((c: string) => c.startsWith('token='));
  return tokenCookie || '';
}
