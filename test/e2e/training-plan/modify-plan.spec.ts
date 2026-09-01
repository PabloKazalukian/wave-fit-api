import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppTestModule } from '../../utils/app-test.module';
import {
  closeInMongodConnection,
  clearDatabase,
} from '../../utils/db-handler';
import { UserService } from '../../../src/modules/user/user.service';
import { ExerciseService } from '../../../src/modules/routines/templates/exercise/exercise.service';
import { TrainingPlanService } from '../../../src/modules/training-plan/training-plan.service';
import { GroqProvider } from '../../../src/modules/ai/providers/groq.provider';
import {
  createTestUser,
  getTestUserCredentials,
} from '../../fixtures/user.fixture';
import { getCookieWithToken } from '../helpers/week-log.helper';
import { createProfile } from '../helpers/user-profile.helper';
import cookieParser from 'cookie-parser';

const TRAINING_PLAN_FIELDS = `
  id
  userId
  title
  focus
  status
  confirmed
  version
  durationWeeks
  trainingDaysPerWeek
  aiSnapshot {
    modelUsed
    tokensUsed
    promptUsed
    contextSentToAI
    rawResponse
  }
`;

const CATALOG = [
  { name: 'Press Banca', category: 'chest' as const, usesWeight: true },
  { name: 'Sentadilla', category: 'legs_front' as const, usesWeight: true },
  { name: 'Dominadas', category: 'back' as const, usesWeight: false },
];

type AiPlanExercise = { name: string; plannedSets: number; plannedReps: string };
type AiPlanDay = { order: number; isRest: boolean; focus: string | null; exercises: AiPlanExercise[] };
type AiPlanJson = { title: string; focus: string; durationWeeks: number; daysPerWeek: number; days: AiPlanDay[] };

const buildAiPlanJson = (title = 'PPL IA E2E'): AiPlanJson => ({
  title,
  focus: 'muscle_gain',
  durationWeeks: 8,
  daysPerWeek: 4,
  days: [
    {
      order: 1,
      isRest: false,
      focus: 'push',
      exercises: [
        { name: 'Press Banca', plannedSets: 4, plannedReps: '8-10' },
        { name: 'Dominadas', plannedSets: 3, plannedReps: '8-10' },
      ],
    },
    { order: 2, isRest: true, focus: null, exercises: [] },
    {
      order: 3,
      isRest: false,
      focus: 'legs',
      exercises: [{ name: 'Sentadilla', plannedSets: 4, plannedReps: '6-8' }],
    },
    { order: 4, isRest: true, focus: null, exercises: [] },
    {
      order: 5,
      isRest: false,
      focus: 'full body',
      exercises: [
        { name: 'press banca', plannedSets: 3, plannedReps: '10' },
        { name: 'sentadilla', plannedSets: 3, plannedReps: '10' },
      ],
    },
    { order: 6, isRest: true, focus: null, exercises: [] },
    { order: 7, isRest: true, focus: null, exercises: [] },
  ],
});

describe('Training Plan Modification with AI (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let exerciseService: ExerciseService;
  let trainingPlanService: TrainingPlanService;
  let authCookie: string;
  let userId: string;

  const invokeMock = jest.fn();

  const cannedAiResponse = (plan = buildAiPlanJson()) => ({
    content: JSON.stringify(plan),
    response_metadata: {
      model_name: 'groq-test-model',
      tokenUsage: {
        completionTokens: 100,
        promptTokens: 50,
        totalTokens: 150,
      },
    },
  });

  const updateUserGoals = (
    input: Record<string, unknown> = {
      primaryGoal: 'muscle_gain',
      trainingExperience: 'intermediate',
    },
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation UpdateGoals($input: UpdateGoalsInput!) {
            updateUserGoals(input: $input) { _id }
          }
        `,
        variables: { input },
      });

  const updateUserSchedule = (
    input: Record<string, unknown> = { daysPerWeek: 4, sessionDurationMin: 60 },
  ) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation UpdateSchedule($input: UpdateScheduleInput!) {
            updateUserSchedule(input: $input) { _id }
          }
        `,
        variables: { input },
      });

  const setupMinimumProfile = async () => {
    expect((await createProfile(app, authCookie)).status).toBe(200);
    expect((await updateUserGoals()).status).toBe(200);
    expect((await updateUserSchedule()).status).toBe(200);
  };

  const generatePlan = () =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation GeneratePlan {
            generatePlan(comment: "") {
              ${TRAINING_PLAN_FIELDS}
            }
          }
        `,
      });

  const modifyPlan = (id: string, comment: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation ModifyPlan($id: String!, $comment: String!) {
            modifyPlan(id: $id, comment: $comment) {
              ${TRAINING_PLAN_FIELDS}
            }
          }
        `,
        variables: { id, comment },
      });

  const confirmPlan = (id: string) =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation ConfirmPlan($id: String!, $action: PlanConfirmationAction!) {
            confirmPlan(id: $id, action: $action) {
              trainingPlan { id confirmed version }
              weekLog { id }
              routinePlan { id }
            }
          }
        `,
        variables: { id, action: 'CREATE_WEEK_LOG' },
      });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    })
      .overrideProvider(GroqProvider)
      .useValue({
        name: 'groq',
        getModel: () => ({ invoke: invokeMock }),
      })
      .compile();

    app = module.createNestApplication();
    userService = module.get<UserService>(UserService);
    exerciseService = module.get<ExerciseService>(ExerciseService);
    trainingPlanService = module.get<TrainingPlanService>(TrainingPlanService);

    app.use(cookieParser());
    await app.init();
  });

  beforeEach(async () => {
    await clearDatabase();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(cannedAiResponse());

    await createTestUser(userService).then((u) => {
      userId = (u as any)._id.toString();
    });
    for (const ex of CATALOG) {
      await exerciseService.create(ex as any);
    }

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
    jest.restoreAllMocks();
    await clearDatabase();
  });

  afterAll(async () => {
    await closeInMongodConnection();
    await app.close();
  });

  describe('modifyPlan', () => {
    it('modifica un draft, incrementa version y actualiza el snapshot de IA', async () => {
      await setupMinimumProfile();
      const generated = await generatePlan();
      expect(generated.body.errors).toBeUndefined();
      const planId = generated.body.data.generatePlan.id;
      expect(generated.body.data.generatePlan.version).toBe(1);

      // La IA devuelve un plan modificado (título distinto) en la 2da llamada
      invokeMock.mockResolvedValue(
        cannedAiResponse(buildAiPlanJson('PPL IA Modificado')),
      );

      const modified = await modifyPlan(planId, 'cambia los pesos a 5x5');

      expect(modified.body.errors).toBeUndefined();
      const plan = modified.body.data.modifyPlan;

      // version incrementada sobre el mismo documento
      expect(plan.id).toBe(planId);
      expect(plan.version).toBe(2);
      expect(plan.confirmed).toBe(false);
      expect(plan.title).toBe('PPL IA Modificado');

      // el snapshot refleja la nueva respuesta de la IA
      expect(plan.aiSnapshot.rawResponse.title).toBe('PPL IA Modificado');
      expect(plan.aiSnapshot.modelUsed).toBe('groq-test-model');

      // fueron 2 llamadas a la IA: una para generate, otra para modify
      expect(invokeMock).toHaveBeenCalledTimes(2);

      // solo existe un único TrainingPlan (se sobrescribió el mismo)
      const { total } = await trainingPlanService.findAll(userId, 5, 0);
      expect(total).toBe(1);
    });

    it('envía a la IA el plan actual dentro del prompt de modificación', async () => {
      await setupMinimumProfile();
      const generated = await generatePlan();
      const planId = generated.body.data.generatePlan.id;

      await modifyPlan(planId, 'más volumen en piernas');

      // 2da llamada de IA = la de modify
      const messages = invokeMock.mock.calls[1][0];
      const userPrompt = messages[1].content as string;

      // el prompt de modificación incluye el plan actual y el comentario
      expect(userPrompt).toContain('PLAN ACTUAL');
      expect(userPrompt).toContain('más volumen en piernas');
      // el plan actual serializado tiene los nombres del catálogo
      expect(userPrompt).toContain('Press Banca');
      // sin ObjectIds hex en el prompt (ahorro de tokens)
      const hexIds = userPrompt.match(/[0-9a-f]{24}/gi) ?? [];
      expect(hexIds).toEqual([]);
    });

    it('rechaza con 409 (ConflictException) si el plan ya fue confirmado', async () => {
      await setupMinimumProfile();
      const generated = await generatePlan();
      const planId = generated.body.data.generatePlan.id;

      const confirmed = await confirmPlan(planId);
      expect(confirmed.body.errors).toBeUndefined();

      // Invocar de nuevo la IA devolvería el plan "modificado"; no debe llamarse
      const callsBefore = invokeMock.mock.calls.length;
      const rejected = await modifyPlan(planId, 'cambia');
      expect(rejected.body.errors[0].extensions.status).toBe(409);
      expect(rejected.body.errors[0].message).toContain(
        'ya fue confirmado y no puede modificarse',
      );

      // no se hizo ninguna llamada adicional a la IA
      expect(invokeMock.mock.calls.length).toBe(callsBefore);

      // el plan sigue con version 1
      const { items } = await trainingPlanService.findAll(userId, 5, 0);
      expect(items[0].version).toBe(1);
    });

    it('rechaza con 404 si el plan no existe o es de otro usuario', async () => {
      await setupMinimumProfile();

      const rejected = await modifyPlan('64f0deadbeef000000000000', 'cambia');
      expect(rejected.body.errors[0].extensions.status).toBe(404);
      expect(rejected.body.errors[0].message).toContain(
        'Training plan not found',
      );
      expect(invokeMock).not.toHaveBeenCalled();
    });
  });
});
