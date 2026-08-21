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
  UPDATE_USER_GOALS,
  USER_GOALS,
  UPDATE_USER_SCHEDULE,
  USER_SCHEDULE,
  UPDATE_USER_HEALTH_CONSTRAINTS,
  USER_HEALTH_CONSTRAINTS,
  UPDATE_USER_RESOURCE,
  USER_RESOURCE,
  UPDATE_USER_TRAINING_PREFERENCE,
  USER_TRAINING_PREFERENCE,
  CREATE_USER_STRENGTH_METRIC,
  REMOVE_USER_STRENGTH_METRIC,
  USER_STRENGTH_METRICS,
  CREATE_WEIGHT_LOG,
  USER_WEIGHT_LOGS,
  USER_PROFILE_CONTEXT,
  CREATE_USER_PROFILE,
} from '../../apollo/user-profile.queries';
import { getCookieWithToken } from '../helpers/week-log.helper';
import { VALID_PROFILE_INPUT } from '../helpers/user-profile.helper';
import cookieParser from 'cookie-parser';

describe('UserProfile sub-resources (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let authCookie: string;

  const gql = (query: string, variables?: Record<string, unknown>) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({ query, ...(variables ? { variables } : {}) });

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

  describe('Goals', () => {
    it('should create goals from an empty user (upsert)', async () => {
      const response = await gql(UPDATE_USER_GOALS, {
        input: {
          primaryGoal: 'muscle_gain',
          trainingExperience: 'beginner',
          timelineWeeks: 12,
          targetWeightKg: 80,
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

      const goal = response.body.data.updateUserGoals;
      expect(goal._id).toBeDefined();
      expect(goal.primaryGoal).toBe('muscle_gain');
      expect(goal.trainingExperience).toBe('beginner');
      expect(goal.isActive).toBe(true);
    });

    it('should return the saved goal via userGoals and update it on second call', async () => {
      const createResponse = await gql(UPDATE_USER_GOALS, {
        input: { primaryGoal: 'strength', trainingExperience: 'intermediate' },
      });
      expect(createResponse.status).toBe(200);
      const createdId = createResponse.body.data.updateUserGoals._id;

      const readResponse = await gql(USER_GOALS);
      expect(readResponse.status).toBe(200);
      expect(readResponse.body.data.userGoals.primaryGoal).toBe('strength');

      const updateResponse = await gql(UPDATE_USER_GOALS, {
        input: {
          primaryGoal: 'fat_loss',
          trainingExperience: 'intermediate',
        },
      });
      expect(updateResponse.status).toBe(200);

      const updated = updateResponse.body.data.updateUserGoals;
      expect(updated._id).toBe(createdId);
      expect(updated.primaryGoal).toBe('fat_loss');

      const rereadResponse = await gql(USER_GOALS);
      expect(rereadResponse.body.data.userGoals.primaryGoal).toBe('fat_loss');
    });

    it('should reject an invalid primaryGoal value', async () => {
      const response = await gql(UPDATE_USER_GOALS, {
        input: {
          primaryGoal: 'get_huge',
          trainingExperience: 'beginner',
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.data?.updateUserGoals).toBeFalsy();
    });
  });

  describe('Schedule', () => {
    it('should create schedule from an empty user with schema defaults', async () => {
      const response = await gql(UPDATE_USER_SCHEDULE, {
        input: {
          daysPerWeek: 4,
          preferredDays: [1, 3, 5],
          preferredTime: 'morning',
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

      const schedule = response.body.data.updateUserSchedule;
      expect(schedule.daysPerWeek).toBe(4);
      expect(schedule.preferredDays).toEqual([1, 3, 5]);
      // Default del schema Mongoose
      expect(schedule.sessionDurationMin).toBe(60);
      expect(schedule.restDayActivity).toBe('full_rest');
    });

    it('should persist modified schedule data via userSchedule', async () => {
      await gql(UPDATE_USER_SCHEDULE, { input: { daysPerWeek: 4 } });

      const updateResponse = await gql(UPDATE_USER_SCHEDULE, {
        input: { daysPerWeek: 5, sessionDurationMin: 90 },
      });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.updateUserSchedule.sessionDurationMin).toBe(90);

      const readResponse = await gql(USER_SCHEDULE);
      expect(readResponse.status).toBe(200);
      const schedule = readResponse.body.data.userSchedule;
      expect(schedule.daysPerWeek).toBe(5);
      expect(schedule.sessionDurationMin).toBe(90);
    });

    it('should reject daysPerWeek out of range', async () => {
      const response = await gql(UPDATE_USER_SCHEDULE, {
        input: { daysPerWeek: 9 },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.data?.updateUserSchedule).toBeFalsy();
    });
  });

  describe('Health constraints', () => {
    it('should create health constraints from an empty user', async () => {
      const response = await gql(UPDATE_USER_HEALTH_CONSTRAINTS, {
        input: {
          injuries: [
            {
              bodyPart: 'lower_back',
              severity: 'moderate',
              isActive: true,
              description: 'Dolor lumbar crónico',
            },
          ],
          movementRestrictions: ['evitar flexión de columna'],
          mobilityLevel: 'good',
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

      const constraints = response.body.data.updateUserHealthConstraints;
      expect(constraints.injuries.length).toBe(1);
      expect(constraints.injuries[0].bodyPart).toBe('lower_back');
      expect(constraints.injuries[0].severity).toBe('moderate');
      expect(constraints.mobilityLevel).toBe('good');
    });

    it('should persist modified health constraints via userHealthConstraints', async () => {
      await gql(UPDATE_USER_HEALTH_CONSTRAINTS, {
        input: { mobilityLevel: 'good' },
      });

      const updateResponse = await gql(UPDATE_USER_HEALTH_CONSTRAINTS, {
        input: { mobilityLevel: 'excellent', hasHealthcareSupervision: true },
      });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.updateUserHealthConstraints.mobilityLevel).toBe('excellent');

      const readResponse = await gql(USER_HEALTH_CONSTRAINTS);
      expect(readResponse.status).toBe(200);
      const constraints = readResponse.body.data.userHealthConstraints;
      expect(constraints.mobilityLevel).toBe('excellent');
      expect(constraints.hasHealthcareSupervision).toBe(true);
    });

    it('should reject an invalid bodyPart value', async () => {
      const response = await gql(UPDATE_USER_HEALTH_CONSTRAINTS, {
        input: {
          injuries: [
            { bodyPart: 'head', severity: 'mild', isActive: true },
          ],
        },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.data?.updateUserHealthConstraints).toBeFalsy();
    });
  });

  describe('Resource', () => {
    it('should create resource from an empty user', async () => {
      const response = await gql(UPDATE_USER_RESOURCE, {
        input: {
          trainingEnvironments: ['gym', 'home'],
          equipment: { barbell: true, dumbbells: true },
          dumbbellMaxKg: 24,
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

      const resource = response.body.data.updateUserResource;
      expect(resource.trainingEnvironments).toEqual(['gym', 'home']);
      expect(resource.equipment.barbell).toBe(true);
      expect(resource.equipment.dumbbells).toBe(true);
      expect(resource.dumbbellMaxKg).toBe(24);
    });

    it('should persist modified resource data via userResource', async () => {
      await gql(UPDATE_USER_RESOURCE, {
        input: { trainingEnvironments: ['home'] },
      });

      const updateResponse = await gql(UPDATE_USER_RESOURCE, {
        input: { trainingEnvironments: ['outdoor'], gymDistanceKm: 5.5 },
      });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.updateUserResource.gymDistanceKm).toBe(5.5);

      const readResponse = await gql(USER_RESOURCE);
      expect(readResponse.status).toBe(200);
      const resource = readResponse.body.data.userResource;
      expect(resource.trainingEnvironments).toEqual(['outdoor']);
      expect(resource.gymDistanceKm).toBe(5.5);
    });

    it('should reject an empty trainingEnvironments array', async () => {
      const response = await gql(UPDATE_USER_RESOURCE, {
        input: { trainingEnvironments: [] },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.data?.updateUserResource).toBeFalsy();
    });
  });

  describe('Training preference', () => {
    it('should create training preference from an empty user', async () => {
      const response = await gql(UPDATE_USER_TRAINING_PREFERENCE, {
        input: {
          preferredStyles: ['hypertrophy', 'powerlifting'],
          dislikedExercises: ['burpees'],
          cardioPreference: 'mixed',
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

      const preference =
        response.body.data.updateUserTrainingPreference;
      expect(preference.preferredStyles).toEqual([
        'hypertrophy',
        'powerlifting',
      ]);
      expect(preference.dislikedExercises).toEqual(['burpees']);
      expect(preference.cardioPreference).toBe('mixed');
    });

    it('should persist modified training preference via userTrainingPreference', async () => {
      await gql(UPDATE_USER_TRAINING_PREFERENCE, {
        input: { preferredStyles: ['yoga'] },
      });

      const updateResponse = await gql(UPDATE_USER_TRAINING_PREFERENCE, {
        input: {
          preferredStyles: ['calisthenics'],
          intensityPreference: 'intense',
        },
      });
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.data.updateUserTrainingPreference.intensityPreference).toBe('intense');

      const readResponse = await gql(USER_TRAINING_PREFERENCE);
      expect(readResponse.status).toBe(200);
      const preference = readResponse.body.data.userTrainingPreference;
      expect(preference.preferredStyles).toEqual(['calisthenics']);
      expect(preference.intensityPreference).toBe('intense');
    });

    it('should reject an invalid preferredStyles value', async () => {
      const response = await gql(UPDATE_USER_TRAINING_PREFERENCE, {
        input: { preferredStyles: ['zumba'] },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.data?.updateUserTrainingPreference).toBeFalsy();
    });
  });

  describe('Strength metrics', () => {
    it('should create a strength metric and list it', async () => {
      const response = await gql(CREATE_USER_STRENGTH_METRIC, {
        input: {
          exerciseKey: 'squat',
          oneRmKg: 140,
          repsAtWeight: { weightKg: 100, reps: 5 },
          confidenceLevel: 'estimated',
          notes: 'Estimado con Epley',
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

      const metric = response.body.data.createUserStrengthMetric;
      expect(metric._id).toBeDefined();
      expect(metric.exerciseKey).toBe('squat');
      expect(metric.oneRmKg).toBe(140);
      expect(metric.repsAtWeight.weightKg).toBe(100);
      expect(metric.repsAtWeight.reps).toBe(5);
      expect(metric.confidenceLevel).toBe('estimated');

      const listResponse = await gql(USER_STRENGTH_METRICS);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.userStrengthMetrics.length).toBe(1);
      expect(listResponse.body.data.userStrengthMetrics[0]._id).toBe(
        metric._id,
      );
    });

    it('should remove a strength metric by id', async () => {
      const createResponse = await gql(CREATE_USER_STRENGTH_METRIC, {
        input: { exerciseKey: 'bench_press', oneRmKg: 95 },
      });
      const metricId =
        createResponse.body.data.createUserStrengthMetric._id;

      const removeResponse = await gql(REMOVE_USER_STRENGTH_METRIC, {
        id: metricId,
      });
      expect(removeResponse.status).toBe(200);
      expect(removeResponse.body.errors).toBeUndefined();
      expect(removeResponse.body.data.removeUserStrengthMetric._id).toBe(
        metricId,
      );

      const listResponse = await gql(USER_STRENGTH_METRICS);
      expect(listResponse.body.data.userStrengthMetrics).toEqual([]);
    });

    it('should reject removing a non-existent strength metric id', async () => {
      const response = await gql(REMOVE_USER_STRENGTH_METRIC, {
        id: '507f1f77bcf86cd799439011',
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors[0].message).toContain('not found');
    });
  });

  describe('Weight logs', () => {
    it('should create a weight log and list it', async () => {
      const response = await gql(CREATE_WEIGHT_LOG, {
        input: {
          weightKg: 75.5,
          bodyFatPct: 17.5,
          loggedAt: '2026-08-10T10:00:00.000Z',
          notes: 'Pesaje matutino',
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

      const log = response.body.data.createWeightLog;
      expect(log._id).toBeDefined();
      expect(log.weightKg).toBe(75.5);
      expect(log.loggedAt).toContain('2026-08-10');

      const listResponse = await gql(USER_WEIGHT_LOGS);
      expect(listResponse.status).toBe(200);
      expect(listResponse.body.data.userWeightLogs.length).toBe(1);
    });

    it('should list weight logs sorted by loggedAt descending', async () => {
      await gql(CREATE_WEIGHT_LOG, {
        input: { weightKg: 77, loggedAt: '2026-08-01T10:00:00.000Z' },
      });
      await gql(CREATE_WEIGHT_LOG, {
        input: { weightKg: 75, loggedAt: '2026-08-15T10:00:00.000Z' },
      });

      const listResponse = await gql(USER_WEIGHT_LOGS);
      expect(listResponse.status).toBe(200);

      const logs = listResponse.body.data.userWeightLogs;
      expect(logs.length).toBe(2);
      expect(logs[0].loggedAt).toContain('2026-08-15');
      expect(logs[1].loggedAt).toContain('2026-08-01');
    });

    it('should reject weightKg below the allowed range', async () => {
      const response = await gql(CREATE_WEIGHT_LOG, {
        input: { weightKg: 10 },
      });

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeDefined();
      expect(response.body.data?.createWeightLog).toBeFalsy();
    });
  });

  describe('userProfileContext aggregation', () => {
    it('should return nulls and empty arrays when user has no data', async () => {
      const response = await gql(USER_PROFILE_CONTEXT);

      if (response.body.errors) {
        console.log(
          'GraphQL Errors:',
          JSON.stringify(response.body.errors, null, 2),
        );
      }

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();

      const context = response.body.data.userProfileContext;
      expect(context.profile).toBeNull();
      expect(context.goal).toBeNull();
      expect(context.healthConstraints).toBeNull();
      expect(context.schedule).toBeNull();
      expect(context.trainingPreferences).toBeNull();
      expect(context.resources).toBeNull();
      expect(context.strengthMetrics).toEqual([]);
      expect(context.weightLogs).toEqual([]);
    });

    it('should aggregate all populated sub-resources for the AI context', async () => {
      await gql(CREATE_USER_PROFILE, { input: VALID_PROFILE_INPUT });
      await gql(UPDATE_USER_GOALS, {
        input: { primaryGoal: 'recomp', trainingExperience: 'advanced' },
      });
      await gql(UPDATE_USER_SCHEDULE, { input: { daysPerWeek: 4 } });
      await gql(UPDATE_USER_HEALTH_CONSTRAINTS, {
        input: { mobilityLevel: 'good' },
      });
      await gql(UPDATE_USER_RESOURCE, {
        input: { trainingEnvironments: ['gym'] },
      });
      await gql(UPDATE_USER_TRAINING_PREFERENCE, {
        input: { preferredStyles: ['powerlifting'] },
      });
      await gql(CREATE_USER_STRENGTH_METRIC, {
        input: { exerciseKey: 'deadlift', oneRmKg: 180 },
      });
      await gql(CREATE_WEIGHT_LOG, {
        input: { weightKg: 76, loggedAt: '2026-08-12T10:00:00.000Z' },
      });

      const response = await gql(USER_PROFILE_CONTEXT);

      if (response.body.errors) {
        console.log(
          'GraphQL Errors:',
          JSON.stringify(response.body.errors, null, 2),
        );
      }

      expect(response.status).toBe(200);
      expect(response.body.errors).toBeUndefined();

      const context = response.body.data.userProfileContext;
      expect(context.profile.gender).toBe('M');
      expect(context.goal.primaryGoal).toBe('recomp');
      expect(context.schedule.daysPerWeek).toBe(4);
      expect(context.healthConstraints.mobilityLevel).toBe('good');
      expect(context.resources.trainingEnvironments).toEqual(['gym']);
      expect(context.trainingPreferences.preferredStyles).toEqual([
        'powerlifting',
      ]);
      expect(context.strengthMetrics[0].exerciseKey).toBe('deadlift');
      expect(context.weightLogs[0].weightKg).toBe(76);
    });
  });
});

