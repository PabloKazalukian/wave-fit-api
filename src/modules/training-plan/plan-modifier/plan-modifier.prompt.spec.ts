import { buildModifyPlanPrompts } from './plan-modifier.prompt';

describe('buildModifyPlanPrompts', () => {
  const aiContext = {
    biometrics: { weightKg: 75 },
    goal: { primary: 'muscle_gain' },
  };

  const currentPlan = {
    title: 'PPL IA',
    focus: 'muscle_gain',
    days: [
      { order: 1, isRest: false, exercises: [{ name: 'Press Banca', plannedSets: 4 }] },
    ],
  };

  const exerciseNames = ['Press Banca', 'Sentadilla'];

  it('incluye el plan actual en el userPrompt', () => {
    const { userPrompt } = buildModifyPlanPrompts(
      aiContext,
      exerciseNames,
      currentPlan,
      'cambia a 5x5',
    );
    expect(userPrompt).toContain('--- PLAN ACTUAL ---');
    expect(userPrompt).toContain(JSON.stringify(currentPlan));
  });

  it('incluye el contexto del usuario', () => {
    const { userPrompt } = buildModifyPlanPrompts(
      aiContext,
      exerciseNames,
      currentPlan,
      'cambia a 5x5',
    );
    expect(userPrompt).toContain('--- DATOS DEL USUARIO ---');
    expect(userPrompt).toContain(JSON.stringify(aiContext));
  });

  it('incluye el catálogo de ejercicios como lista de nombres', () => {
    const { userPrompt } = buildModifyPlanPrompts(
      aiContext,
      exerciseNames,
      currentPlan,
      'cambia a 5x5',
    );
    expect(userPrompt).toContain('--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---');
    expect(userPrompt).toContain('- Press Banca');
    expect(userPrompt).toContain('- Sentadilla');
  });

  it('incluye el comentario de modificación', () => {
    const { userPrompt } = buildModifyPlanPrompts(
      aiContext,
      exerciseNames,
      currentPlan,
      '  cambia a 5x5  ',
    );
    expect(userPrompt).toContain('--- PREFERENCIA DE MODIFICACIÓN DEL USUARIO ---');
    expect(userPrompt).toContain('cambia a 5x5');
  });

  it('no agrega la sección de modificación si el comentario está vacío', () => {
    const { userPrompt } = buildModifyPlanPrompts(
      aiContext,
      exerciseNames,
      currentPlan,
      '   ',
    );
    expect(userPrompt).not.toContain('PREFERENCIA DE MODIFICACIÓN');
  });

  it('mantiene el systemPrompt de generación (mismo formato de salida)', () => {
    const { systemPrompt } = buildModifyPlanPrompts(
      aiContext,
      exerciseNames,
      currentPlan,
      'cambia',
    );
    expect(systemPrompt).toContain('formato JSON válido');
    expect(systemPrompt).toContain('ESTRUCTURA JSON ESPERADA');
    expect(systemPrompt).toContain('EXACTAMENTE 7');
  });
});
