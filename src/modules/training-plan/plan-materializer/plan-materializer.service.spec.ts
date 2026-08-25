import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExerciseService } from '../../routines/templates/exercise/exercise.service';
import { AI_CAUSE } from '../../ai/ai-error-causes';
import { PlanMaterializerService } from './plan-materializer.service';
import { ParsedDay, ParsedPlan } from '../plan-generator/plan-generator.parser';

describe('PlanMaterializerService — resolución difusa de ejercicios', () => {
  let service: PlanMaterializerService;
  let warnSpy: jest.SpyInstance;

  const USER_ID = '507f1f77bcf86cd799439011';

  // Catálogo espejo de los casos reales reportados por el usuario
  const CATALOG = [
    { id: 'id-remo-mancuerna', name: 'Remo con mancuerna', category: 'back' },
    {
      id: 'id-sentadilla-bulgara',
      name: 'Sentadilla búlgara',
      category: 'legs',
    },
    { id: 'id-press-plano', name: 'Press de banca plano', category: 'chest' },
    {
      id: 'id-press-inclinado',
      name: 'Press de banca inclinado',
      category: 'chest',
    },
    { id: 'id-curl-martillo', name: 'Curl martillo', category: 'arms' },
  ];

  const exerciseServiceMock = {
    findAll: jest.fn(),
  };

  const buildTrainingDay = (order: number, names: string[]): ParsedDay => ({
    order,
    isRest: false,
    focus: 'push',
    exercises: names.map((name) => ({
      exerciseId: '',
      name,
      plannedSets: 3,
      plannedReps: '10',
      rpe: null,
      restSeconds: null,
      notes: null,
    })),
  });

  const buildRestDay = (order: number): ParsedDay => ({
    order,
    isRest: true,
    focus: null,
    exercises: [],
  });

  const buildPlan = (...exerciseNames: string[]): ParsedPlan => ({
    title: 'Plan IA',
    focus: 'muscle_gain',
    durationWeeks: 8,
    daysPerWeek: 3,
    days: [
      buildTrainingDay(1, exerciseNames),
      buildRestDay(2),
      buildRestDay(3),
      buildRestDay(4),
      buildRestDay(5),
      buildRestDay(6),
      buildRestDay(7),
    ],
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    exerciseServiceMock.findAll.mockResolvedValue(CATALOG);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlanMaterializerService,
        { provide: ExerciseService, useValue: exerciseServiceMock },
      ],
    }).compile();

    service = module.get<PlanMaterializerService>(PlanMaterializerService);
    warnSpy = jest.spyOn(service['logger'], 'warn').mockImplementation();
  });

  describe('L1 — match exacto normalizado', () => {
    it('resuelve sin advertencias cuando el nombre coincide tras normalizar', async () => {
      const plan = buildPlan('PRESS DE BANCA PLANO');

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].exercises[0].exerciseId).toBe('id-press-plano');
      expect(plan.days[0].exercises[0].name).toBe('Press de banca plano');
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('L2 — igualdad ignorando plural/singular (folded)', () => {
    it('resuelve "Remo con Mancuernas" contra "Remo con mancuerna"', async () => {
      const plan = buildPlan('Remo con Mancuernas');

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].exercises[0].exerciseId).toBe('id-remo-mancuerna');
      expect(plan.days[0].exercises[0].name).toBe('Remo con mancuerna');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Resolución difusa'),
      );
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[folded]'));
    });

    it('resuelve variantes con plural y acentos combinados', async () => {
      const plan = buildPlan('Curl Martillos');

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].exercises[0].exerciseId).toBe('id-curl-martillo');
    });
  });

  describe('L3 — subconjunto de tokens (la IA agregó detalles)', () => {
    it('resuelve "Sentadilla Búlgaras con Mancuernas" contra "Sentadilla búlgara"', async () => {
      const plan = buildPlan('Sentadilla Búlgaras con Mancuernas');

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].exercises[0].exerciseId).toBe(
        'id-sentadilla-bulgara',
      );
      expect(plan.days[0].exercises[0].name).toBe('Sentadilla búlgara');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[subset]'),
      );
    });

    it('elige el candidato contenido correcto (plano vs inclinado)', async () => {
      // "plano" no aparece en el nombre de la IA → solo inclinado está
      // totalmente contenido en el nombre consultado
      const plan = buildPlan('Press de Banca Inclinado con Mancuernas');

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].exercises[0].exerciseId).toBe('id-press-inclinado');
    });
  });

  describe('L4 — Levenshtein acotado (typos)', () => {
    it('resuelve un typo corto que las capas previas no alcanzan', async () => {
      // d("curl martiyo", "curl martillo") = 1; folded/subset no resuelven
      const plan = buildPlan('Curl Martiyo');

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].exercises[0].exerciseId).toBe('id-curl-martillo');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[levenshtein]'),
      );
    });

    it('falla si hay dos candidatos empatados a la misma distancia mínima', async () => {
      exerciseServiceMock.findAll.mockResolvedValue([
        { id: 'id-a', name: 'Ejercicio tipo A', category: 'chest' },
        { id: 'id-b', name: 'Ejercicio tipo B', category: 'back' },
      ]);

      // "tipo C" está a d=1 de ambos; L1-L3 no resuelven → ambigüedad → 400
      const plan = buildPlan('Ejercicio Tipo C');

      await expect(
        service.resolveAgainstCatalog(USER_ID, plan),
      ).rejects.toThrow(BadRequestException);
    });

    it('bloquea matches difusos con palabras opuestas (abd/add)', async () => {
      exerciseServiceMock.findAll.mockResolvedValue([
        { id: 'id-abd', name: 'Elevación Abd', category: 'legs' },
      ]);

      // d = 1 pero abd/add son opuestos: NO debe resolver a Elevación Abd
      const plan = buildPlan('Elevación Add');

      await expect(
        service.resolveAgainstCatalog(USER_ID, plan),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('nombres genuinamente desconocidos', () => {
    it('descarta solo los irresolubles y continúa con los válidos', async () => {
      const plan = buildPlan('Ejercicio inventado', 'Remo con Mancuernas');

      await service.resolveAgainstCatalog(USER_ID, plan);

      // El válido resolvió difuso y quedó como único ejercicio del día
      expect(plan.days[0].exercises).toHaveLength(1);
      expect(plan.days[0].exercises[0].exerciseId).toBe('id-remo-mancuerna');
      expect(plan.days[0].exercises[0].name).toBe('Remo con mancuerna');
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ejercicios descartados'),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Ejercicio inventado'),
      );
    });

    it('convierte a descanso un día cuyos ejercicios fueron todos descartados', async () => {
      const plan = buildPlan('Ejercicio inventado');
      plan.days[2] = buildTrainingDay(3, ['Curl Martillos']);

      await service.resolveAgainstCatalog(USER_ID, plan);

      expect(plan.days[0].isRest).toBe(true);
      expect(plan.days[0].exercises).toHaveLength(0);
      // El día con ejercicios válidos se mantiene intacto
      expect(plan.days[2].isRest).toBe(false);
      expect(plan.days[2].exercises[0].exerciseId).toBe('id-curl-martillo');
    });

    it('lanza 400 si TODOS los ejercicios del plan son irresolubles (plan inservible)', async () => {
      const plan = buildPlan('Ejercicio inventado');
      plan.days[1] = buildTrainingDay(2, ['Ejercicio inventado']);

      try {
        await service.resolveAgainstCatalog(USER_ID, plan);
        throw new Error('debería haber fallado');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const response = (error as BadRequestException).getResponse() as any;
        expect(response.code).toBe(AI_CAUSE.UNKNOWN_EXERCISE_NAME);
        expect(response.invalidExerciseNames).toEqual([
          'Ejercicio inventado',
        ]);
      }
    });
  });
});
