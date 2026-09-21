import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppTestModule } from '../../utils/app-test.module';
import {
  closeInMongodConnection,
  clearDatabase,
} from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import { User, UserRole } from '../../../src/modules/user/schema/user.schema';
import { getCookieWithToken } from '../helpers/week-log.helper';
import { WeekLog } from '../../../src/modules/routines/tracking/week-log/infrastructure/schemas/week-log.schema';
import { DayLog } from '../../../src/modules/routines/tracking/day-log/infrastructure/schemas/day-log.schema';
import { WorkoutSession } from '../../../src/modules/routines/tracking/workout-session/schema/workout-session.schema';
import { ExtraSession } from '../../../src/modules/routines/tracking/extra-session/schema/extra-session.schema';
import { localDateToUtc } from '../../../src/common/utils/date.utils';
import cookieParser from 'cookie-parser';

const TZ = 'America/Argentina/Buenos_Aires';
const CALENDAR_QUERY = `
  query ($input: TrainingCalendarInput!) {
    trainingCalendar(input: $input) {
      year
      month
      days {
        date
        type
        status
        dayLogId
        workoutSessionId
        extraSessionIds
        extraSessions {
          id
          category
          discipline
          duration
          intensityLevel
          calories
          notes
        }
        weekLogReference {
          id
          startDate
          endDate
          completed
          active
          notes
        }
      }
    }
  }
`;

describe('TrainingHistory Calendar (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;
  let userId: Types.ObjectId;

  async function seedCalendar() {
    const weekLogModel = app.get<Model<WeekLog>>(getModelToken(WeekLog.name));
    const dayLogModel = app.get<Model<DayLog>>(getModelToken(DayLog.name));
    const workoutSessionModel = app.get<Model<WorkoutSession>>(
      getModelToken(WorkoutSession.name),
    );
    const extraSessionModel = app.get<Model<ExtraSession>>(
      getModelToken(ExtraSession.name),
    );

    const wsWeek = await workoutSessionModel.create({
      userId,
      date: localDateToUtc('2026-01-01', TZ),
      exercises: [],
      status: 'not_started',
    });
    const wsDay = await workoutSessionModel.create({
      userId,
      date: localDateToUtc('2026-01-15', TZ),
      exercises: [],
      status: 'complete',
    });

    const esWeek = await extraSessionModel.create({
      userId,
      workoutSessionId: wsWeek._id,
      category: 'cardio',
      date: localDateToUtc('2026-01-01', TZ),
      discipline: 'running',
      duration: 30,
      intensityLevel: 3,
      calories: 320,
      notes: '',
    });
    const esDay = await extraSessionModel.create({
      userId,
      workoutSessionId: wsDay._id,
      category: 'cardio',
      date: localDateToUtc('2026-01-15', TZ),
      discipline: 'cycling',
      duration: 45,
      intensityLevel: 4,
      calories: null,
      notes: 'cooldown',
    });

    const weekLogId = new Types.ObjectId();
    const weekDates = [
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
    ];
    await weekLogModel.create({
      _id: weekLogId,
      userId,
      startDate: localDateToUtc('2026-01-01', TZ),
      endDate: localDateToUtc('2026-01-07', TZ),
      completed: false,
      active: false,
      notes: 'week notes',
      days: weekDates.map((d, i) => ({
        order: i + 1,
        date: localDateToUtc(d, TZ),
        isRest: d === '2026-01-02',
        workoutSessionId: i === 0 ? wsWeek._id : null,
        extraSessionIds: i === 0 ? [esWeek._id] : [],
        status: i === 0 ? 'complete' : 'pending',
      })),
    });

    const deletedWeekDates = [
      '2026-01-19',
      '2026-01-20',
      '2026-01-21',
      '2026-01-22',
      '2026-01-23',
      '2026-01-24',
      '2026-01-25',
    ];
    await weekLogModel.create({
      _id: new Types.ObjectId(),
      userId,
      startDate: localDateToUtc('2026-01-19', TZ),
      endDate: localDateToUtc('2026-01-25', TZ),
      completed: false,
      active: false,
      notes: '',
      days: deletedWeekDates.map((d, i) => ({
        order: i + 1,
        date: localDateToUtc(d, TZ),
        isRest: false,
        workoutSessionId: null,
        extraSessionIds: [],
        status: 'pending',
      })),
      deleted: true,
      deletedAt: new Date(),
    });

    const dayLogId = new Types.ObjectId();
    await dayLogModel.create({
      _id: dayLogId,
      userId,
      date: localDateToUtc('2026-01-15', TZ),
      status: 'skipped',
      workoutSessionId: wsDay._id,
      extraSessionIds: [esDay._id],
    });

    await dayLogModel.create({
      _id: new Types.ObjectId(),
      userId,
      date: localDateToUtc('2026-01-21', TZ),
      status: 'pending',
      workoutSessionId: null,
      extraSessionIds: [],
      deleted: true,
      deletedAt: new Date(),
    });

    await dayLogModel.create({
      _id: new Types.ObjectId(),
      userId,
      date: localDateToUtc('2026-02-01', TZ),
      status: 'pending',
      workoutSessionId: null,
      extraSessionIds: [],
    });

    return {
      weekLogId: weekLogId.toString(),
      wsWeekId: (wsWeek._id as Types.ObjectId).toString(),
      wsDayId: (wsDay._id as Types.ObjectId).toString(),
      dayLogId: dayLogId.toString(),
      esWeekId: (esWeek._id as Types.ObjectId).toString(),
      esDayId: (esDay._id as Types.ObjectId).toString(),
    };
  }

  async function requestCalendar(cookie: string, input: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [cookie])
      .send({
        query: CALENDAR_QUERY,
        variables: { input: JSON.parse(input) },
      });
  }

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

    const user = await createTestUser(userService);
    userId = (user as unknown as User)._id as Types.ObjectId;

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

  it('TEST-006 returns a mixed WEEK_LOG + DAY_LOG calendar sorted by date with the documented shapes', async () => {
    const ids = await seedCalendar();

    const response = await requestCalendar(
      authCookie,
      JSON.stringify({ year: 2026, month: 1 }),
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeUndefined();

    const body = response.body.data.trainingCalendar;
    expect(body.year).toBe(2026);
    expect(body.month).toBe(1);
    expect(body.days).toHaveLength(8);
    expect(
      body.days.map((d: any) => d.date),
    ).toEqual([
      '2026-01-01',
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-15',
    ]);

    const weekDay = body.days.find((d: any) => d.date === '2026-01-01');
    expect(weekDay.type).toBe('WEEK_LOG');
    expect(weekDay.status).toBe('complete');
    expect(weekDay.workoutSessionId).toBe(ids.wsWeekId);
    expect(weekDay.dayLogId).toBeNull();
    expect(weekDay.extraSessionIds).toEqual([ids.esWeekId]);
    expect(weekDay.extraSessions).toEqual([
      {
        id: ids.esWeekId,
        category: 'CARDIO',
        discipline: 'running',
        duration: 30,
        intensityLevel: 3,
        calories: 320,
        notes: null,
      },
    ]);
    expect(weekDay.weekLogReference.id).toBe(ids.weekLogId);
    expect(weekDay.weekLogReference.startDate).toBe('2026-01-01T03:00:00.000Z');
    expect(weekDay.weekLogReference.endDate).toBe('2026-01-07T03:00:00.000Z');
    expect(weekDay.weekLogReference.completed).toBe(false);
    expect(weekDay.weekLogReference.active).toBe(false);
    expect(weekDay.weekLogReference.notes).toBe('week notes');

    const restDay = body.days.find((d: any) => d.date === '2026-01-02');
    expect(restDay.type).toBe('WEEK_LOG');
    expect(restDay.status).toBe('rest');

    const dayLogDay = body.days.find((d: any) => d.date === '2026-01-15');
    expect(dayLogDay.type).toBe('DAY_LOG');
    expect(dayLogDay.status).toBe('skipped');
    expect(dayLogDay.dayLogId).toBe(ids.dayLogId);
    expect(dayLogDay.workoutSessionId).toBe(ids.wsDayId);
    expect(dayLogDay.extraSessionIds).toEqual([ids.esDayId]);
    expect(dayLogDay.extraSessions).toEqual([
      {
        id: ids.esDayId,
        category: 'CARDIO',
        discipline: 'cycling',
        duration: 45,
        intensityLevel: 4,
        calories: null,
        notes: 'cooldown',
      },
    ]);
    expect(dayLogDay.weekLogReference).toBeNull();
  });

  it('TEST-007 excludes soft-deleted resources and out-of-range boundaries', async () => {
    await seedCalendar();

    const response = await requestCalendar(
      authCookie,
      JSON.stringify({ year: 2026, month: 1 }),
    );

    const dates = response.body.data.trainingCalendar.days.map(
      (d: any) => d.date,
    );
    expect(dates).not.toContain('2026-01-20');
    expect(dates).not.toContain('2026-01-21');
    expect(dates).not.toContain('2026-02-01');
  });

  it('TEST-007 rejects invalid month input with BAD_REQUEST', async () => {
    const response = await requestCalendar(
      authCookie,
      JSON.stringify({ year: 2026, month: 13 }),
    );

    expect(response.status).toBe(200);
    expect(response.body.errors).toBeDefined();
    expect(response.body.errors[0].extensions.code).toBe('BAD_REQUEST');
  });

  it('TEST-007 keeps calendar data isolated per user', async () => {
    await seedCalendar();

    const otherUser = await userService.create({
      email: 'other@wavefit.com',
      password: 'password123',
      name: 'Other User',
      role: UserRole.USER,
    });
    void otherUser;

    const otherLogin = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `
          mutation {
            login(identifier: "other@wavefit.com", password: "password123")
          }
        `,
      });
    const otherCookie = getCookieWithToken(otherLogin);

    const response = await requestCalendar(
      otherCookie,
      JSON.stringify({ year: 2026, month: 1 }),
    );

    expect(response.body.errors).toBeUndefined();
    expect(response.body.data.trainingCalendar.days).toEqual([]);
  });
});