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
import { getCookieWithToken } from '../helpers/week-log.helper';
import cookieParser from 'cookie-parser';

const DAY_FIELDS = `
    order
    date
    isRest
    workoutSessionId
    status
`;

const UPDATE_DAY_MUTATION = `
    mutation UpdateDay($input: UpdateWeekLogDayUnifiedInput!) {
        updateDay(input: $input) {
            ${DAY_FIELDS}
        }
    }
`;

describe('updateDay Bug Reproduction (e2e)', () => {
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

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should SUCCEED when creating a workout session via updateDay (fix verified)', async () => {
    // 1. Create a WeekLog WITHOUT a plan (so days have no WorkoutSession)
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const startDate = startOfWeek.toISOString().split('T')[0];
    const endDate = endOfWeek.toISOString().split('T')[0];

    const createResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startDate}",
              endDate: "${endDate}",
              timezone: "America/Argentina/Buenos_Aires"
            }) {
              id
              days { order workoutSessionId }
            }
          }
        `,
      });

    expect(createResponse.status).toBe(200);
    const week = createResponse.body.data.createWeekLog;
    expect(week.days[0].workoutSessionId).toBeNull();

    // 2. Try to create a workout session via updateDay
    // This used to fail due to timezone bug, now it should succeed
    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_DAY_MUTATION,
        variables: {
          input: {
            id: week.id,
            days: [
              {
                order: 1,
                workoutSession: {
                  status: 'not_started',
                  exercises: [],
                },
              },
            ],
          },
        },
      });

    if (updateResponse.body.errors) {
        console.log('UNEXPECTED ERROR:', JSON.stringify(updateResponse.body.errors, null, 2));
    }
    
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.errors).toBeUndefined();
    const updatedDay = updateResponse.body.data.updateDay;
    expect(updatedDay.workoutSessionId).toBeDefined();
    expect(updatedDay.workoutSessionId).not.toBeNull();
  });
});
