import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import { closeInMongodConnection, clearDatabase } from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { WeekLogService } from '../../../src/modules/routines/tracking/week-log/week-log.service';
import { ExerciseService } from '../../../src/modules/routines/templates/exercise/exercise.service';
import { RoutineDayService } from '../../../src/modules/routines/templates/routine-day/routine-day.service';
import { RoutinePlanService } from '../../../src/modules/routines/templates/routine-plan/routine-plan.service';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import {
  WEEK_LOG_FIELDS,
  UPDATE_WEEK_LOG,
} from '../../apollo/week-log.queries';
import cookieParser from 'cookie-parser';

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

function createWeekLog(app: INestApplication<App>, cookie: string) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString()}",
              endDate: "${endOfWeek.toISOString()}",
            }) {
              id
              startDate
              endDate
            }
          }
        `,
    })
    .expect(200);
}

function getActiveWeekLog(app: INestApplication<App>, cookie: string) {
  return request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie || ''])
    .send({
      query: `
        query findActiveWeekLog {
          activeWeekLog {
            hasActiveWeek
            week {
                id
                startDate
                endDate
                userId
                days {
                  order
                  date
                  isRest
                  workoutSessionId
                  exercises {
                      exerciseId
                      series
                      sets {
                          weights
                          reps
                      }
                      notes
                  }
                  extraSessionIds
                  status
                }
                planId
                notes
                completed
            }
          }
      }
      `,
    });
}

describe('UpdateWeekLog (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let weekLogService: WeekLogService;
  let exerciseService: ExerciseService;
  let routineDayService: RoutineDayService;
  let routinePlanService: RoutinePlanService;
  let authCookie: string;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    }).compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    weekLogService = module.get<WeekLogService>(WeekLogService);
    exerciseService = module.get<ExerciseService>(ExerciseService);
    routineDayService = module.get<RoutineDayService>(RoutineDayService);
    routinePlanService = module.get<RoutinePlanService>(RoutinePlanService);

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

    await createWeekLog(app, authCookie);
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should complete the week', async () => {
    const activeWeekResponse = await getActiveWeekLog(app, authCookie);

    expect(activeWeekResponse.status).toBe(200);
    const week = activeWeekResponse.body.data.activeWeekLog.week;
    expect(week).toBeDefined();
    expect(week.completed).toBe(false);

    const updateResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: UPDATE_WEEK_LOG,
        variables: {
          updateWeekLogInput: {
            id: week.id,
            userId: week.userId,
            startDate: week.startDate
              ? week.startDate.replace('Z', '')
              : undefined,
            endDate: week.endDate ? week.endDate.replace('Z', '') : undefined,
            days: week.days.map(({ date, exercises, ...rest }: any) => rest),
            completed: true,
            active: false,
          },
        },
      });

    if (updateResponse.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(updateResponse.body.errors, null, 2),
      );
    }
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.updateWeekLog.completed).toBe(true);
    expect(updateResponse.body.data.updateWeekLog.days.length).toBe(7);
  });
});
