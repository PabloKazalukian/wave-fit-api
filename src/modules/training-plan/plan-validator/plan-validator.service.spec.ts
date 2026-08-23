import { Test, TestingModule } from '@nestjs/testing';
import { PlanValidatorService } from './plan-validator.service';
import { UserProfileService } from '../../user/user-profile';

describe('PlanValidatorService', () => {
  let validator: PlanValidatorService;

  const userProfileServiceMock = {
    getFullProfileContext: jest.fn(),
  };

  const completeProfile = {
    birthDate: new Date('1995-01-01'),
    heightCm: 178,
    weightKg: 75,
  };

  const completeGoal = {
    primaryGoal: 'muscle_gain',
    trainingExperience: 'intermediate',
  };

  const completeSchedule = { daysPerWeek: 4 };

  const completeContext = () => ({
    profile: { ...completeProfile },
    goal: { ...completeGoal },
    schedule: { ...completeSchedule },
    resources: { trainingEnvironments: ['gym'] },
    trainingPreferences: { preferredStyles: ['strength'] },
    strengthMetrics: [{ exerciseId: 'ex-1', oneRepMax: 100 }],
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanValidatorService,
        {
          provide: UserProfileService,
          useValue: userProfileServiceMock,
        },
      ],
    }).compile();

    validator = module.get<PlanValidatorService>(PlanValidatorService);
  });

  it('should be defined', () => {
    expect(validator).toBeDefined();
  });

  it('retorna válido con un contexto completo', async () => {
    userProfileServiceMock.getFullProfileContext.mockResolvedValue(
      completeContext(),
    );

    const result = await validator.validate('user-1');

    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.recommended).toEqual([]);
  });

  describe('campos indispensables (bloquean)', () => {
    it('marca faltante si no existe perfil', async () => {
      const ctx = completeContext();
      ctx.profile = null;
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.valid).toBe(false);
      expect(result.missing).toContain(
        'UserProfile: No existe perfil de usuario',
      );
    });

    it('reporta birthDate, heightCm y weightKg ausentes', async () => {
      const ctx = completeContext();
      ctx.profile = {};
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.missing).toContain(
        'UserProfile.birthDate: Fecha de nacimiento no especificada',
      );
      expect(result.missing).toContain(
        'UserProfile.heightCm: Altura no especificada',
      );
      expect(result.missing).toContain(
        'UserProfile.weightKg: Peso no especificado',
      );
      expect(result.valid).toBe(false);
    });

    it('marca faltante si no hay objetivo activo', async () => {
      const ctx = completeContext();
      ctx.goal = null;
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.missing).toContain('UserGoal: No hay un objetivo activo');
    });

    it('reporta primaryGoal y trainingExperience ausentes en el goal', async () => {
      const ctx = completeContext();
      ctx.goal = {};
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.missing).toContain(
        'UserGoal.primaryGoal: Objetivo principal no especificado',
      );
      expect(result.missing).toContain(
        'UserGoal.trainingExperience: Nivel de experiencia no especificado',
      );
    });

    it('marca faltante si no hay configuración de horario', async () => {
      const ctx = completeContext();
      ctx.schedule = null;
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.missing).toContain(
        'UserSchedule: No hay configuración de horario',
      );
    });

    it('acepta preferredDays como alternativa a daysPerWeek', async () => {
      const ctx = completeContext();
      ctx.schedule = { daysPerWeek: 0, preferredDays: ['monday'] };
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.missing.some((m) => m.startsWith('UserSchedule'))).toBe(
        false,
      );
    });

    it('marca faltante si schedule no define días ni preferidos', async () => {
      const ctx = completeContext();
      ctx.schedule = { daysPerWeek: 0, preferredDays: [] };
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.missing).toContain(
        'UserSchedule: Días de entrenamiento por semana no especificados (daysPerWeek o preferredDays)',
      );
    });
  });

  describe('campos recomendados (no bloquean)', () => {
    it('recomienda recursos si no existen', async () => {
      const ctx = completeContext();
      ctx.resources = null;
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.valid).toBe(true);
      expect(result.recommended).toContain(
        'UserResource: Equipamiento y entorno de entrenamiento (ayuda a personalizar ejercicios)',
      );
    });

    it('recomienda entornos si el array está vacío', async () => {
      const ctx = completeContext();
      ctx.resources = { trainingEnvironments: [] };
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.recommended).toContain(
        'UserResource.trainingEnvironments: Entorno de entrenamiento no especificado',
      );
    });

    it('recomienda preferencias si no existen', async () => {
      const ctx = completeContext();
      ctx.trainingPreferences = null;
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.recommended).toContain(
        'UserTrainingPreference: Preferencias de entrenamiento (estilos, intensidad)',
      );
    });

    it('recomienda estilos si el array está vacío', async () => {
      const ctx = completeContext();
      ctx.trainingPreferences = { preferredStyles: [] };
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.recommended).toContain(
        'UserTrainingPreference.preferredStyles: Estilos de entrenamiento preferidos no especificados',
      );
    });

    it('recomienda métricas de fuerza si no hay ninguna', async () => {
      const ctx = completeContext();
      ctx.strengthMetrics = [];
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.recommended).toContain(
        'UserStrengthMetric: Métricas de fuerza (1RM) — genera un plan más preciso',
      );
    });

    it('acumula recomendados sin invalidar el plan', async () => {
      const ctx = completeContext();
      ctx.resources = null;
      ctx.trainingPreferences = null;
      ctx.strengthMetrics = [];
      userProfileServiceMock.getFullProfileContext.mockResolvedValue(ctx);

      const result = await validator.validate('user-1');

      expect(result.valid).toBe(true);
      expect(result.recommended).toHaveLength(3);
    });
  });
});
