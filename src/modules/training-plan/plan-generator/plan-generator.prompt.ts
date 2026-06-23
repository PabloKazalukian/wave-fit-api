export interface BuiltPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPlanPrompts(
  aiContext: Record<string, unknown>,
): BuiltPrompts {
  const ctx = aiContext as any;

  const goal = ctx.goal || {};
  const schedule = ctx.schedule || {};
  const health = ctx.health || {};
  const resources = ctx.resources || {};
  const preferences = ctx.preferences || {};
  const strengthProfile = ctx.strengthProfile || {};

  const primaryGoal = goal.primary || 'general';
  const experience = goal.experience || 'intermediate';
  const timelineWeeks = goal.timelineWeeks || 4;
  const daysPerWeek = schedule.daysPerWeek || 3;
  const sessionDurationMin = schedule.sessionDurationMin || 60;

  const systemPrompt = [
    'Eres un preparador físico experto con más de 10 años de experiencia.',
    'Tu especialidad es diseñar planes de entrenamiento personalizados',
    'basados en el perfil completo del usuario.',
    '',
    'Debes generar un plan en formato JSON válido, sin texto adicional,',
    'sin marcas de código, solo el JSON.',
    '',
    'REGLAS DEL PLAN:',
    '1. El plan debe estar alineado con el objetivo principal del usuario',
    '2. Respeta las restricciones de salud y lesiones activas',
    '3. Considera el equipamiento disponible',
    '4. La duración de las sesiones no debe exceder el tiempo disponible',
    '5. Distribuye los grupos musculares según la frecuencia semanal',
    '6. Incluye progresión semanal (incremento de volumen o intensidad)',
    '7. El volumen total debe ser apropiado para el nivel de experiencia',
    '8. Antes de cada sesión incluir 5-10 min de calentamiento y al final 5-10 min de enfriamiento',
    '',
    'ESTRUCTURA JSON ESPERADA:',
    '{',
    '  "title": "string (nombre del plan)",',
    '  "focus": "hypertrophy|strength|fat_loss|endurance|maintenance|recomp|sport_specific",',
    '  "durationWeeks": "number",',
    '  "daysPerWeek": "number",',
    '  "weeks": [',
    '    {',
    '      "weekNumber": "number",',
    '      "days": [',
    '        {',
    '          "order": "number (1-7)",',
    '          "isRest": "boolean",',
    '          "focus": "string (opcional, ej: Push, Pull, Piernas)",',
    '          "exercises": [',
    '            {',
    '              "name": "string (nombre del ejercicio en español)",',
    '              "sets": "number",',
    '              "reps": "string (ej: 8-10, 12, 5x5)",',
    '              "rpe": "number (opcional, 1-10)",',
    '              "restSeconds": "number (opcional)",',
    '              "notes": "string (opcional)"',
    '            }',
    '          ]',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'Los días con isRest: true no deben incluir exercises.',
    'Si el usuario no tiene suficiente equipamiento, adapta los ejercicios a su realidad.',
  ].join('\n');

  let userPrompt = [
    `Genera un plan de entrenamiento personalizado para el siguiente usuario:`,
    ``,
    `--- DATOS DEL USUARIO ---`,
    `${JSON.stringify(aiContext, null, 2)}`,
    ``,
    `--- INSTRUCCIONES ESPECÍFICAS ---`,
    `- El plan debe tener ${timelineWeeks} semanas de duración`,
    `- El usuario entrena ${daysPerWeek} días por semana`,
    `- Cada sesión debe durar aproximadamente ${sessionDurationMin} minutos`,
    `- Objetivo principal: ${primaryGoal}`,
    `- Experiencia: ${experience}`,
  ].join('\n');

  const extras: string[] = [];

  if (strengthProfile && Object.keys(strengthProfile).length > 0) {
    extras.push(
      '- Basa los pesos iniciales en las métricas de 1RM proporcionadas. Usa porcentajes del 1RM para las series de trabajo.',
    );
  }

  if (health?.activeInjuries?.length > 0) {
    extras.push(
      '- PRECAUCIÓN: El usuario tiene lesiones activas. Evita ejercicios que comprometan las zonas lesionadas. Sugiere variantes seguras.',
    );
  }

  if (health?.movementRestrictions?.length > 0) {
    extras.push(
      `- Respeta las restricciones de movimiento: ${health.movementRestrictions.join(', ')}.`,
    );
  }

  if (preferences?.disliked?.length > 0) {
    extras.push(
      `- Evita estos ejercicios: ${preferences.disliked.join(', ')}.`,
    );
  }

  if (preferences?.favorite?.length > 0) {
    extras.push(
      `- Prioriza estos ejercicios favoritos si son compatibles: ${preferences.favorite.join(', ')}.`,
    );
  }

  if (preferences?.intensity) {
    extras.push(`- Preferencia de intensidad: ${preferences.intensity}.`);
  }

  if (preferences?.cardio && preferences.cardio !== 'none') {
    extras.push(
      `- Preferencia de cardio: ${preferences.cardio}. Incluye cardio según lo indicado.`,
    );
  }

  if (resources?.equipment) {
    const available = Object.entries(resources.equipment)
      .filter(([, v]: [string, unknown]) => v)
      .map(([k]: [string, unknown]) => k.replace(/_/g, ' '));
    if (available.length > 0) {
      extras.push(
        `- Equipamiento disponible: ${available.join(', ')}. Diseña los ejercicios en base a este equipamiento.`,
      );
    }
  }

  if (resources?.environments?.length > 0) {
    extras.push(
      `- Entorno de entrenamiento: ${resources.environments.join(', ')}.`,
    );
  }

  if (extras.length > 0) {
    userPrompt +=
      '\n\n--- CONSIDERACIONES ADICIONALES ---\n' + extras.join('\n');
  }

  userPrompt +=
    '\n\nDevuelve SOLO el objeto JSON, sin explicaciones, sin notas adicionales, sin marcas de código.';

  return { systemPrompt, userPrompt };
}
