import { buildPlanPrompts } from './plan-generator.prompt';

describe('buildPlanPrompts', () => {
  const exercises = ['Press Banca', 'Sentadilla'];

  it('aplica defaults cuando el contexto viene vacío', () => {
    const { userPrompt } = buildPlanPrompts({}, exercises);

    expect(userPrompt).toContain('El plan debe tener 4 semanas de duración');
    expect(userPrompt).toContain(
      'El usuario entrena 3 días por semana',
    );
    expect(userPrompt).toContain(
      'Cada sesión debe durar aproximadamente 60 minutos',
    );
    expect(userPrompt).toContain('Objetivo principal: general');
    expect(userPrompt).toContain('Experiencia: intermediate');
  });

  it('incluye los datos del usuario serializados como JSON compacto', () => {
    const aiContext = { biometrics: { weightKg: 75 } };
    const { userPrompt } = buildPlanPrompts(aiContext, exercises);

    expect(userPrompt).toContain('--- DATOS DEL USUARIO ---');
    expect(userPrompt).toContain(JSON.stringify(aiContext));
  });

  it('usa los valores del contexto cuando están presentes', () => {
    // el builder consume el aiContext ya transformado (goal.primary/experience)
    const ctx = {
      goal: { primary: 'fat_loss', experience: 'advanced', timelineWeeks: 12 },
      schedule: { daysPerWeek: 5, sessionDurationMin: 90 },
    } as any;

    const { userPrompt } = buildPlanPrompts(ctx, exercises);

    expect(userPrompt).toContain(
      'El plan debe tener 12 semanas de duración',
    );
    expect(userPrompt).toContain('El usuario entrena 5 días por semana');
    expect(userPrompt).toContain(
      'Cada sesión debe durar aproximadamente 90 minutos',
    );
    expect(userPrompt).toContain('Objetivo principal: fat_loss');
    expect(userPrompt).toContain('Experiencia: advanced');
  });

  it('el system prompt define formato JSON y reglas de descanso', () => {
    const { systemPrompt } = buildPlanPrompts({}, exercises);

    expect(systemPrompt).toContain('formato JSON válido');
    expect(systemPrompt).toContain('"days" debe contener EXACTAMENTE 7');
    expect(systemPrompt).toContain('NUNCA pongas 3 o más días');
    expect(systemPrompt).toContain(
      '"name": "string (nombre EXACTO del ejercicio tal como aparece en el catálogo)"',
    );
    expect(systemPrompt).not.toContain('exerciseId');
  });

  describe('consideraciones adicionales condicionales', () => {
    it('no agrega sección cuando no hay extras', () => {
      const { userPrompt } = buildPlanPrompts({}, exercises);
      expect(userPrompt).not.toContain(
        '--- CONSIDERACIONES ADICIONALES ---',
      );
    });

    it('agrega métricas de fuerza si strengthProfile tiene claves', () => {
      const { userPrompt } = buildPlanPrompts(
        { strengthProfile: { bench: { oneRmKg: 100 } } } as any,
        exercises,
      );

      expect(userPrompt).toContain(
        '- Basa los pesos iniciales en las métricas de 1RM proporcionadas',
      );
    });

    it('agrega precaución si hay lesiones activas', () => {
      const { userPrompt } = buildPlanPrompts(
        {
          health: {
            activeInjuries: [{ bodyPart: 'hombro' }],
            movementRestrictions: [],
          },
        } as any,
        exercises,
      );

      expect(userPrompt).toContain(
        '- PRECAUCIÓN: El usuario tiene lesiones activas',
      );
    });

    it('lista restricciones de movimiento', () => {
      const { userPrompt } = buildPlanPrompts(
        {
          health: {
            activeInjuries: [],
            movementRestrictions: ['rotación interna', 'flexión lumbar'],
          },
        } as any,
        exercises,
      );

      expect(userPrompt).toContain(
        '- Respeta las restricciones de movimiento: rotación interna, flexión lumbar.',
      );
    });

    it('agrega ejercicios evitados y favoritos', () => {
      const { userPrompt } = buildPlanPrompts(
        {
          preferences: {
            disliked: ['press declinado'],
            favorite: ['dominadas'],
          },
        } as any,
        exercises,
      );

      expect(userPrompt).toContain(
        '- Evita estos ejercicios: press declinado.',
      );
      expect(userPrompt).toContain(
        '- Prioriza estos ejercicios favoritos si son compatibles: dominadas.',
      );
    });

    it('agrega intensidad y cardio solo cuando aplican', () => {
      const base = buildPlanPrompts(
        { preferences: { intensity: 'alta' } } as any,
        exercises,
      );
      expect(base.userPrompt).toContain(
        '- Preferencia de intensidad: alta.',
      );
      expect(base.userPrompt).not.toContain('- Preferencia de cardio');

      const withCardio = buildPlanPrompts(
        { preferences: { intensity: 'alta', cardio: 'moderado' } } as any,
        exercises,
      );
      expect(withCardio.userPrompt).toContain(
        '- Preferencia de cardio: moderado. Incluye cardio según lo indicado.',
      );

      const cardioNone = buildPlanPrompts(
        { preferences: { intensity: 'alta', cardio: 'none' } } as any,
        exercises,
      );
      expect(cardioNone.userPrompt).not.toContain('- Preferencia de cardio');
    });

    it('filtra equipamiento falsy y reemplaza guiones bajos', () => {
      const { userPrompt } = buildPlanPrompts(
        {
          resources: {
            equipment: { barra_olimpica: true, maquina_smith: false },
            environments: ['gimnasio'],
          },
        } as any,
        exercises,
      );

      expect(userPrompt).toContain(
        '- Equipamiento disponible: barra olimpica. Diseña los ejercicios en base a este equipamiento.',
      );
      expect(userPrompt).toContain(
        '- Entorno de entrenamiento: gimnasio.',
      );
      expect(userPrompt).not.toContain('maquina smith');
    });

    it('no agrega línea de equipamiento si todo es falsy', () => {
      const { userPrompt } = buildPlanPrompts(
        { resources: { equipment: { banda: false } } } as any,
        exercises,
      );

      expect(userPrompt).not.toContain('- Equipamiento disponible');
    });
  });

  it('incluye el catálogo como lista de nombres sin ids ni categorías', () => {
    const { userPrompt } = buildPlanPrompts({}, exercises);

    expect(userPrompt).toContain('--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---');
    expect(userPrompt).toContain('- Press Banca');
    expect(userPrompt).toContain('- Sentadilla');
    expect(userPrompt).not.toContain('|');
    expect(userPrompt).toContain(
      'Copia el nombre EXACTAMENTE como aparece en la lista',
    );
  });

  it('agrega el comentario del usuario solo si no está vacío', () => {
    const withComment = buildPlanPrompts({}, exercises, 'sin peso muerto');
    expect(withComment.userPrompt).toContain(
      'PREFERENCIA ADICIONAL DEL USUARIO',
    );
    expect(withComment.userPrompt).toContain('sin peso muerto');

    const withoutComment = buildPlanPrompts({}, exercises, '');
    const whitespaceComment = buildPlanPrompts({}, exercises, '   ');
    expect(withoutComment.userPrompt).not.toContain(
      'PREFERENCIA ADICIONAL DEL USUARIO',
    );
    expect(whitespaceComment.userPrompt).not.toContain(
      'PREFERENCIA ADICIONAL DEL USUARIO',
    );
  });
});
