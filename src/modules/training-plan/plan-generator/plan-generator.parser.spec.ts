import { BadRequestException } from '@nestjs/common';
import { PlanGeneratorParser } from './plan-generator.parser';

describe('PlanGeneratorParser', () => {
  let parser: PlanGeneratorParser;

  const validExercise = {
    exerciseId: '64f1aabbccddeeff00112233',
    name: 'Press Banca',
    plannedSets: 4,
    plannedReps: '8-10',
    rpe: 8,
    restSeconds: 90,
    notes: 'Bajar controlado',
  };

  const buildPlan = (overrides: Partial<any> = {}) => ({
    title: 'PPL Hipertrofia',
    focus: 'hipertrophy',
    durationWeeks: 8,
    daysPerWeek: 6,
    days: Array.from({ length: 7 }, (_, i) => ({
      order: i + 1,
      isRest: i === 6,
      focus: i === 6 ? null : 'push',
      exercises: i === 6 ? [] : [{ ...validExercise }],
    })),
    ...overrides,
  });

  const parseRaw = (plan: unknown) =>
    parser.parse(JSON.stringify(plan));

  beforeEach(() => {
    parser = new PlanGeneratorParser();
  });

  describe('extractJson', () => {
    it('parsea JSON plano sin fences', () => {
      const result = parseRaw(buildPlan());
      expect(result.title).toBe('PPL Hipertrofia');
      expect(result.days).toHaveLength(7);
    });

    it('elimina fences ```json del contenido', () => {
      const raw = `\`\`\`json\n${JSON.stringify(buildPlan())}\n\`\`\``;
      const result = parser.parse(raw);
      expect(result.title).toBe('PPL Hipertrofia');
    });

    it('elimina fences ``` genéricos', () => {
      const raw = `\`\`\`\n${JSON.stringify(buildPlan())}\n\`\`\``;
      const result = parser.parse(raw);
      expect(result.durationWeeks).toBe(8);
    });
  });

  describe('validate', () => {
    it('lanza error si falta "days"', () => {
      const { days, ...withoutDays } = buildPlan();
      expect(() => parseRaw(withoutDays)).toThrow(BadRequestException);
      expect(() => parseRaw(withoutDays)).toThrow(
        'AI response missing "days" array',
      );
    });

    it('lanza error si "days" no es un array', () => {
      expect(() => parseRaw(buildPlan({ days: 'no-soy-array' }))).toThrow(
        'days must be an array',
      );
    });

    it('lanza error si "days" no tiene exactamente 7 entradas', () => {
      const days = Array.from({ length: 6 }, (_, i) => ({
        order: i + 1,
        isRest: true,
      }));
      expect(() => parseRaw(buildPlan({ days }))).toThrow(
        'days must contain exactly 7 entries',
      );
    });

    it('lanza error si day.order no es numérico', () => {
      const days = buildPlan().days;
      days[0].order = '1' as unknown as number;
      expect(() => parseRaw({ ...buildPlan(), days })).toThrow(
        'Each day must have a numeric "order"',
      );
    });

    it('lanza error si day.isRest no es booleano', () => {
      const days = buildPlan().days;
      (days[0] as any).isRest = 'false';
      expect(() => parseRaw({ ...buildPlan(), days })).toThrow(
        'Each day must have a boolean "isRest"',
      );
    });

    it('lanza error si un ejercicio de día no-rest no tiene name', () => {
      const days = buildPlan().days;
      const { name, ...noName } = validExercise;
      days[0].exercises = [{ ...noName }];
      expect(() => parseRaw({ ...buildPlan(), days })).toThrow(
        'Each exercise must have a non-empty "name"',
      );
    });

    it('lanza error si el name del ejercicio es solo espacios', () => {
      const days = buildPlan().days;
      days[0].exercises = [{ ...validExercise, name: '   ' }];
      expect(() => parseRaw({ ...buildPlan(), days })).toThrow(
        'Each exercise must have a non-empty "name"',
      );
    });

    it('no exige exercises en días de descanso', () => {
      const days = buildPlan().days;
      days[6] = { order: 7, isRest: true };
      const result = parseRaw({ ...buildPlan(), days });
      expect(result.days[6].exercises).toEqual([]);
    });
  });

  describe('normalize', () => {
    it('aplica defaults para campos faltantes', () => {
      const { title, focus, durationWeeks, daysPerWeek, ...rest } =
        buildPlan();
      const result = parseRaw(rest);

      expect(result.title).toBe('Training Plan');
      expect(result.focus).toBe('');
      expect(result.durationWeeks).toBe(1);
      expect(result.daysPerWeek).toBe(3);
    });

    it('no permite durationWeeks menor a 1', () => {
      const result = parseRaw(buildPlan({ durationWeeks: -5 }));
      expect(result.durationWeeks).toBe(1);
    });

    it('mapea aliases sets/reps a plannedSets/plannedReps', () => {
      const days = buildPlan().days;
      days[0].exercises = [
        { name: 'Press Banca', sets: 3, reps: '12' },
      ];
      const result = parseRaw({ ...buildPlan(), days });

      expect(result.days[0].exercises[0]).toMatchObject({
        name: 'Press Banca',
        plannedSets: 3,
        plannedReps: '12',
      });
    });

    it('deja exerciseId vacío (lo resuelve el service contra la DB)', () => {
      const days = buildPlan().days;
      days[0].exercises = [
        { name: 'Press Banca', plannedSets: 3, plannedReps: '10' },
      ];
      const result = parseRaw({ ...buildPlan(), days });

      expect(result.days[0].exercises[0]).toEqual({
        exerciseId: '',
        name: 'Press Banca',
        plannedSets: 3,
        plannedReps: '10',
        rpe: null,
        restSeconds: null,
        notes: null,
      });
    });

    it('retorna exercises vacío si el día no trae array de ejercicios', () => {
      const days = buildPlan().days;
      days[0] = { order: 1, isRest: false, focus: 'push' };
      const result = parseRaw({ ...buildPlan(), days });

      expect(result.days[0].exercises).toEqual([]);
    });

    it('convierte focus falsy a null en cada día', () => {
      const days = buildPlan().days;
      days[0].focus = '';
      const result = parseRaw({ ...buildPlan(), days });

      expect(result.days[0].focus).toBeNull();
    });
  });

  describe('parse (integración)', () => {
    it('parsea un plan completo válido', () => {
      const result = parseRaw(buildPlan());

      expect(result).toEqual({
        title: 'PPL Hipertrofia',
        focus: 'hipertrophy',
        durationWeeks: 8,
        daysPerWeek: 6,
        days: expect.any(Array),
      });
      expect(result.days[0].exercises[0]).toEqual({
        exerciseId: '',
        name: 'Press Banca',
        plannedSets: 4,
        plannedReps: '8-10',
        rpe: 8,
        restSeconds: 90,
        notes: 'Bajar controlado',
      });
      expect(result.days[6].isRest).toBe(true);
    });

    it('lanza BadRequestException ante JSON malformado (no SyntaxError crudo)', () => {
      expect(() => parser.parse('{ esto no es json')).toThrow(
        new BadRequestException('La IA devolvió una respuesta JSON malformada'),
      );
    });

    it('parseWithRawJson retorna el plan y el JSON crudo intacto', () => {
      const rawPlan = buildPlan();
      const { plan, rawJson } = parser.parseWithRawJson(
        JSON.stringify(rawPlan),
      );

      expect(plan.title).toBe('PPL Hipertrofia');
      expect(rawJson).toEqual(rawPlan);
    });

    it('tolera un `}` sobrante al final del JSON (cierre duplicado de la IA)', () => {
      const rawPlan = buildPlan();
      const valid = JSON.stringify(rawPlan);
      // Simula que la IA añade un `}` extra tras el cierre del objeto raíz.
      const messy = valid + '}';

      const { plan, rawJson } = parser.parseWithRawJson(messy);

      expect(plan.title).toBe('PPL Hipertrofia');
      expect(rawJson).toEqual(rawPlan);
    });

    it('tolera texto/llaves extra después del JSON válido', () => {
      const rawPlan = buildPlan();
      const valid = JSON.stringify(rawPlan);
      const messy = valid + ' } sobras de modelo';

      const { plan, rawJson } = parser.parseWithRawJson(messy);

      expect(plan.title).toBe('PPL Hipertrofia');
      expect(rawJson).toEqual(rawPlan);
    });
  });
});
