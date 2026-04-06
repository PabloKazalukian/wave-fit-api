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
import { ExerciseCategory } from '../../../src/modules/routines/templates/exercise/entities/exercise.entity';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import cookieParser from 'cookie-parser';

export const WEEK_LOG_FIELDS = `
    id
    userId
    startDate
    endDate
    planId
    notes
    completed
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
`;

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

describe('WeekLog Creation (e2e)', () => {
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
  });

  afterEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  it('should create a basic week-log without planId', async () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString().replace('Z', '')}",
              endDate: "${endOfWeek.toISOString().replace('Z', '')}",
            }) {
              id
              startDate
              days {
                order
                isRest
                workoutSessionId
              }
            }
          }
        `,
      });

    expect(response.status).toBe(200);
    const data = response.body.data.createWeekLog;
    expect(data.id).toBeDefined();
    expect(data.days.length).toBe(7);
    data.days.forEach((day: any) => {
      expect(day.workoutSessionId).toBeNull();
    });
  });

  it('should completed the week', async () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const findActiveWeekLogResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
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

    expect(findActiveWeekLogResponse.status).toBe(200);
    // console.log(findActiveWeekLogResponse.body.data);
    const dataFindActiveWeekLog =
      findActiveWeekLogResponse.body.data.activeWeekLog.hasActiveWeek;
    expect(dataFindActiveWeekLog).toBe(true);
  });

  it('should exist a actived week-log , the previus test, completed', async () => {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const findActiveWeekLogResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
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

    const week = findActiveWeekLogResponse.body.data.activeWeekLog.week;

    expect(week).toBeDefined();
    expect(week.days.length).toBe(7);
    week.days.forEach((day: any) => {
      expect(day.workoutSessionId).toBeNull();
    });

    expect(findActiveWeekLogResponse.status).toBe(200);
    const dataFindActiveWeekLog =
      findActiveWeekLogResponse.body.data.activeWeekLog.hasActiveWeek;
    expect(dataFindActiveWeekLog).toBe(true);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation UpdateWeekLog($updateWeekLogInput: UpdateWeekLogInput!) {
            updateWeekLog(updateWeekLogInput: $updateWeekLogInput) {
              ${WEEK_LOG_FIELDS}
            }
          }
        `,
        variables: {
          updateWeekLogInput: {
            ...week,
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

    if (response.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }

    expect(response.status).toBe(200);
    const data = response.body.data.updateWeekLog;

    expect(data.id).toBeDefined();
    expect(data.days.length).toBe(7);
    data.days.forEach((day: any) => {
      expect(day.workoutSessionId).toBeNull();
    });
  });

  it('should create a week-log from a routine plan with linked workout sessions', async () => {
    // 1. Create Exercises
    const ex1 = (await exerciseService.create({
      name: 'Push Up',
      category: ExerciseCategory.CHEST,
      usesWeight: false,
    })) as any;
    const ex2 = (await exerciseService.create({
      name: 'Squat',
      category: ExerciseCategory.LEGS,
      usesWeight: false,
    })) as any;

    expect(ex1).toBeDefined();
    expect(ex2).toBeDefined();

    // 2. Create Routine Days
    const day1 = (await routineDayService.create({
      title: 'Upper Body',
      type: [ExerciseCategory.CHEST],
      exercises: [{ exercise: ex1.id, order: 1 }],
    })) as any;
    const day2 = (await routineDayService.create({
      title: 'Lower Body',
      type: [ExerciseCategory.LEGS],
      exercises: [{ exercise: ex2.id, order: 1 }],
    })) as any;

    expect(day1).toBeDefined();
    expect(day2).toBeDefined();

    // 3. Create Routine Plan
    const routineDaysIds = [
      day1.id, // Day 0
      null, // Day 1
      day2.id, // Day 2
      null, // Day 3
      null, // Day 4
      null, // Day 5
      null, // Day 6
    ];

    const plan = (await routinePlanService.create({
      name: 'Test Plan',
      description: 'A test plan description',
      weekly_distribution: '3 days',
      routineDays: routineDaysIds as any,
    })) as any;

    expect(plan).toBeDefined();

    // 4. Create WeekLog using the planId
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation {
            createWeekLog(createWeekLogInput: {
              startDate: "${startOfWeek.toISOString()}",
              endDate: "${endOfWeek.toISOString()}",
              planId: "${plan.id}"
            }) {
              id
              startDate
              endDate
              planId
              days {
                order
                date
                isRest
                workoutSessionId
                
                extraSessionIds
                status
              }
              completed
              notes
            }
          }
        `,
      });

    if (response.body.errors) {
      console.log(
        'GraphQL Errors:',
        JSON.stringify(response.body.errors, null, 2),
      );
    }

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
    const data = response.body.data.createWeekLog;
    expect(data.planId).toBe(plan.id);
    expect(data.days.length).toBe(7);

    // Verify day 1 (order 1) has a workout session
    expect(data.days[0].isRest).toBe(false);
    expect(data.days[0].workoutSessionId).toBeDefined();

    // Verify day 2 (order 2) is rest
    expect(data.days[1].isRest).toBe(true);
    expect(data.days[1].workoutSessionId).toBeNull();

    // Verify day 3 (order 3) has a workout session
    expect(data.days[2].isRest).toBe(false);
    expect(data.days[2].workoutSessionId).toBeDefined();

    // Check specific workout session content
    const users = await userService.findAll();
    const activeWeek = await weekLogService.findActiveWeekLog(
      users[0].id.toString(),
    );

    console.log(activeWeek);

    expect(activeWeek).toBeDefined();
    const session1 = activeWeek.days[0].exercises;
    expect(session1.length).toBe(1);
    expect(session1[0].exerciseId).toBe(ex1.id);
    expect(session1[0].sets.length).toBe(0);
    expect(session1[0].series).toBe(0);
  });
});
