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
  userProfileId
  goalId
  title
  focus
  status
  startDate
  endDate
  durationWeeks
  trainingDaysPerWeek
  confirmed
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

/**
 * Plan que "devuelve la IA": 7 días (4 de entrenamiento con nombres del
 * catálogo creado en beforeEach, 3 de descanso).
 */
type AiPlanExercise = { name: string; plannedSets: number; plannedReps: string };
type AiPlanDay = { order: number; isRest: boolean; focus: string | null; exercises: AiPlanExercise[] };
type AiPlanJson = { title: string; focus: string; durationWeeks: number; daysPerWeek: number; days: AiPlanDay[] };

const buildAiPlanJson = (): AiPlanJson => ({
  title: 'PPL IA E2E',
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

describe('Training Plan Generation with AI (e2e)', () => {
  let app: INestApplication<App>;
  let userService: UserService;
  let exerciseService: ExerciseService;
  let trainingPlanService: TrainingPlanService;
  let authCookie: string;
  let userId: string;

  const invokeMock = jest.fn();

  /**
   * Dispara el request HTTP inmediatamente (los objetos Test de supertest
   * no ejecutan hasta que alguien llama .then) y devuelve la promesa lista
   * para await posterior.
   */
  const launchGeneratePlan = (comment: string = '') => {
    let resolveRes!: (v: any) => void;
    let rejectRes!: (e: any) => void;
    const promise = new Promise<any>((res, rej) => {
      resolveRes = res;
      rejectRes = rej;
    });
    generatePlan(comment).then(resolveRes, rejectRes);
    return promise;
  };

  let resolveInvoke!: (value: any) => void;
  const holdInvoke = () => {
    invokeMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveInvoke = res;
        }),
    );
  };

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

  const waitFor = async (cond: () => boolean, timeoutMs = 3000) => {
    const start = Date.now();
    while (!cond()) {
      if (Date.now() - start > timeoutMs)
        throw new Error('timeout esperando condición del mock de IA');
      await new Promise((r) => setTimeout(r, 25));
    }
  };

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

  /** Perfil con lo indispensable para pasar plan-validator */
  const setupMinimumProfile = async () => {
    expect((await createProfile(app, authCookie)).status).toBe(200);
    expect((await updateUserGoals()).status).toBe(200);
    expect((await updateUserSchedule()).status).toBe(200);
  };

  const generatePlan = (comment: string = '') =>
    request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [authCookie])
      .send({
        query: `
          mutation GeneratePlan($comment: String!) {
            generatePlan(comment: $comment) {
              ${TRAINING_PLAN_FIELDS}
            }
          }
        `,
        variables: { comment },
      });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppTestModule],
    })
      // Se reemplaza solo el proveedor de red: AiService, rate limiter,
      // reintentos y parser corren reales contra Mongo en memoria.
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

  describe('validación de datos mínimos', () => {
    it('rechaza si el usuario no tiene perfil ni goal ni schedule', async () => {
      const response = await generatePlan();

      expect(response.status).toBe(200);
      const error = response.body.errors[0];
      expect(error.extensions.status).toBe(400);
      expect(error.message).toContain('Faltan datos obligatorios');
      expect(error.message).toContain('No existe perfil de usuario');
      expect(error.message).toContain('UserGoal');
      expect(error.message).toContain('UserSchedule');

      // no se llamó a la IA ni se creó ningún plan
      expect(invokeMock).not.toHaveBeenCalled();
      const { total } = await trainingPlanService.findAll(userId, 5, 0);
      expect(total).toBe(0);
    });

    it('rechaza listando solo lo faltante si hay perfil pero no goal/schedule', async () => {
      expect((await createProfile(app, authCookie)).status).toBe(200);

      const response = await generatePlan();

      const error = response.body.errors[0];
      expect(error.message).toContain('Faltan datos obligatorios');
      expect(error.message).not.toContain('UserProfile');
      expect(error.message).toContain('UserGoal');
      expect(error.message).toContain('UserSchedule');
      expect(invokeMock).not.toHaveBeenCalled();
    });
  });

  describe('generación con perfil básico', () => {
    it('genera un plan draft con snapshot de IA usando solo lo indispensable', async () => {
      await setupMinimumProfile();

      const response = await generatePlan();

      expect(response.body.errors).toBeUndefined();
      const plan = response.body.data.generatePlan;

      expect(plan.title).toBe('PPL IA E2E');
      expect(plan.focus).toBe('MUSCLE_GAIN');
      expect(plan.status).toBe('DRAFT');
      expect(plan.confirmed).toBe(false);
      expect(plan.durationWeeks).toBe(8);
      expect(plan.trainingDaysPerWeek).toBe(4);
      expect(plan.userId).toBeDefined();
      expect(plan.userProfileId).toBeDefined();
      expect(plan.goalId).toBeDefined();

      // fechas coherentes: endDate = startDate + durationWeeks * 7 días
      const start = new Date(plan.startDate).getTime();
      const end = new Date(plan.endDate).getTime();
      expect(end - start).toBe(8 * 7 * 24 * 60 * 60 * 1000);

      // snapshot de IA
      expect(plan.aiSnapshot.modelUsed).toBe('groq-test-model');
      expect(plan.aiSnapshot.tokensUsed).toBe(150);
      expect(plan.aiSnapshot.rawResponse.days).toHaveLength(7);
      expect(plan.aiSnapshot.contextSentToAI.goal.primary).toBe('muscle_gain');

      // una única llamada a la IA
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    it('envía a la IA un prompt con nombres del catálogo y sin ids de MongoDB', async () => {
      await setupMinimumProfile();

      await generatePlan();

      // LangChain: invoke recibe [SystemMessage, HumanMessage]
      const messages = invokeMock.mock.calls[0][0];
      const systemPrompt = messages[0].content as string;
      const userPrompt = messages[1].content as string;
      const fullPrompt = `${systemPrompt}\n${userPrompt}`;

      // catálogo como nombres únicos
      expect(userPrompt).toContain('- Press Banca');
      expect(userPrompt).toContain('- Sentadilla');
      expect(userPrompt).toContain('- Dominadas');

      // sin ObjectIds hex de 24 chars en todo el prompt (ahorro de tokens)
      const hexIds = fullPrompt.match(/[0-9a-f]{24}/gi) ?? [];
      expect(hexIds).toEqual([]);
    });
  });

  describe('idempotencia / concurrencia', () => {
    it('deduplica generaciones simultáneas con el mismo comentario en un único plan', async () => {
      await setupMinimumProfile();
      const generateSpy = jest.spyOn(trainingPlanService, 'generate');
      holdInvoke();

      const p1 = launchGeneratePlan('plan fuerte');
      await waitFor(() => invokeMock.mock.calls.length === 1);

      const p2 = launchGeneratePlan('plan fuerte');
      // espera a que el 2do request haya entrado a generate() mientras
      // el lock sigue tomado (la IA sigue pendiente)
      await waitFor(() => generateSpy.mock.calls.length >= 2);

      resolveInvoke(cannedAiResponse());

      const [res1, res2] = await Promise.all([p1, p2]);

      for (const res of [res1, res2]) {
        expect(res.body.errors).toBeUndefined();
      }
      // misma promesa compartida → mismo plan persistido una sola vez
      expect(res1.body.data.generatePlan.id).toBe(
        res2.body.data.generatePlan.id,
      );
      expect(invokeMock).toHaveBeenCalledTimes(1);
    });

    it('rechaza con ConflictException otro comentario mientras hay generación en vuelo', async () => {
      await setupMinimumProfile();
      holdInvoke();

      const inFlight = launchGeneratePlan('primer comment');
      await waitFor(() => invokeMock.mock.calls.length === 1);

      const rejected = await generatePlan('otro comment');
      expect(rejected.body.errors[0].extensions.status).toBe(409);
      expect(rejected.body.errors[0].message).toContain(
        'Ya hay una generación de plan en curso',
      );
      expect(invokeMock).toHaveBeenCalledTimes(1);

      // liberar la generación original
      resolveInvoke(cannedAiResponse());
      const done = await inFlight;
      expect(done.body.errors).toBeUndefined();
    });
  });

  describe('validación de la respuesta de la IA', () => {
    it('descarta ejercicios fuera del catálogo y continúa con los válidos', async () => {
      await setupMinimumProfile();
      const badPlan = buildAiPlanJson();
      // Un ejercicio desconocido conviviendo con ejercicios válidos NO debe
      // tirar el plan: se descarta silenciosamente y se conservan los válidos.
      badPlan.days[0].exercises.push({
        name: 'Ejercicio Fantasma',
        plannedSets: 3,
        plannedReps: '10',
      });
      invokeMock.mockResolvedValue(cannedAiResponse(badPlan));

      const response = await generatePlan();

      // La generación tiene éxito (sin error en la respuesta)
      expect(response.body.errors).toBeUndefined();
      const plan = response.body.data.generatePlan;
      expect(plan).toBeDefined();
      expect(plan.title).toBe('PPL IA E2E');

      // el snapshot conserva la respuesta cruda de la IA (3 ejercicios en days[0])
      expect(plan.aiSnapshot.rawResponse.days[0].exercises).toHaveLength(3);

      // el plan sí se persiste (fue una generación válida)
      const { total } = await trainingPlanService.findAll(userId, 5, 0);
      expect(total).toBe(1);
    });

    it('rechaza con 400 cuando todos los ejercicios son desconocidos', async () => {
      await setupMinimumProfile();
      const badPlan = buildAiPlanJson();
      // Se reemplaza todo ejercicio válido por nombres fuera del catálogo
      // en todos los días activos: plan inservible → 400 estricto.
      for (const day of badPlan.days) {
        if (day.isRest) continue;
        day.exercises = [
          { name: 'Ejercicio Fantasma', plannedSets: 3, plannedReps: '10' },
        ];
      }
      invokeMock.mockResolvedValue(cannedAiResponse(badPlan));

      const response = await generatePlan();

      const error = response.body.errors[0];
      expect(error.extensions.status).toBe(400);
      expect(error.message).toContain('existe en el catálogo');
      expect(error.extensions.originalError.code).toBe(
        'AI_UNKNOWN_EXERCISE_NAME',
      );

      expect(error.extensions.originalError.invalidExerciseNames).toEqual([
        'Ejercicio Fantasma',
      ]);

      const { total } = await trainingPlanService.findAll(userId, 5, 0);
      expect(total).toBe(0);
    });

    it('reintenta internamente cuando la IA responde vacío y genera igual', async () => {
      await setupMinimumProfile();
      invokeMock
        .mockResolvedValueOnce({ content: '', response_metadata: {} })
        .mockResolvedValueOnce(cannedAiResponse());

      const response = await generatePlan();

      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.generatePlan.title).toBe('PPL IA E2E');
      expect(invokeMock).toHaveBeenCalledTimes(2);
    });
  });
});
