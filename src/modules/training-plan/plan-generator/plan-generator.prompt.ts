export interface BuiltPrompts {
  systemPrompt: string;
  userPrompt: string;
}

export function buildPlanPrompts(
  aiContext: Record<string, unknown>,
  exerciseNames: string[],
  comment: string = '',
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
    '6. El volumen total debe ser apropiado para el nivel de experiencia',
    '7. Antes de cada sesión incluir 5-10 min de calentamiento y al final 5-10 min de enfriamiento',
    '8. DISTRIBUCIÓN DE DESCANSOS: No acumules más de 2 días de entrenamiento consecutivos.',
    '   - Si el usuario entrena 4 días/semana: usa el patrón 2-1-2-2 o 2-1-2-1 (ej: Lun-Mar, Des, Jue-Vie, Des-Dom)',
    '   - Si el usuario entrena 3 días/semana: distribuye con al menos 1 día de descanso entre sesiones',
    '   - Si el usuario entrena 5+ días/semana: máximo 2 consecutivos antes de un descanso obligatorio',
    '   - NUNCA pongas 3 o más días de entrenamiento seguidos',
    '',
    'ESTRUCTURA JSON ESPERADA (SEMANA COMPLETA DE 7 DÍAS):',
    '{',
    '  "title": "string (nombre del plan)",',
    '  "focus": "fat_loss|muscle_gain|strength|endurance|maintenance|recomp",',
    '  "durationWeeks": "number",',
    '  "daysPerWeek": "number",',
    '  "days": [',
    '    {',
    '      "order": "number (1-7, donde 1 es el primer día de la semana)",',
    '      "isRest": "boolean",',
    '      "focus": "string (opcional, ej: Push, Pull, Piernas)",',
    '      "exercises": [',
    '        {',
    '          "name": "string (nombre EXACTO del ejercicio tal como aparece en el catálogo)",',
    '          "plannedSets": "number (series planeadas)",',
    '          "plannedReps": "string (ej: 8-10, 12, 5x5)",',
    '          "rpe": "number (opcional, 1-10)",',
    '          "restSeconds": "number (opcional, en segundos)",',
    '          "notes": "string (opcional)"',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'IMPORTANTE:',
    '- El array "days" debe contener EXACTAMENTE 7 elementos (una semana completa)',
    '- El order 1 corresponde al primer día de entrenamiento de la semana',
    '- isRest: true → el array exercises debe ser []',
    '- name DEBE ser el nombre EXACTO de un ejercicio del catálogo proporcionado (cópialo sin modificar, sin traducir ni parafrasear)',
    '- NO agregues al nombre equipamiento, plurales ni detalles que no estén textualmente en el nombre del catálogo',
    '- NO inventes nombres ni uses ejercicios fuera del catálogo',
    '- Si el usuario no tiene suficiente equipamiento, adapta los ejercicios a su realidad',
  ].join('\n');

  let userPrompt = [
    `Genera un plan de entrenamiento personalizado para el siguiente usuario:`,
    ``,
    `--- DATOS DEL USUARIO ---`,
    // Compacto (sin indentar) para no quemar presupuesto de tokens
    `${JSON.stringify(aiContext)}`,
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

  const exerciseList = exerciseNames.map((name) => `- ${name}`).join('\n');

  userPrompt += `
\n--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---
Usa SOLO estos ejercicios. Copia el nombre EXACTAMENTE como aparece en la lista:
${exerciseList}
`;

  userPrompt +=
    '\n\nDevuelve SOLO el objeto JSON, sin explicaciones, sin notas adicionales, sin marcas de código.';

  if (comment && comment.trim().length > 0) {
    userPrompt +=
      `\n\n--- PREFERENCIA ADICIONAL DEL USUARIO (considerar si es compatible con las reglas anteriores) ---\n${comment.trim()}`;
  }

  return { systemPrompt, userPrompt };
}
