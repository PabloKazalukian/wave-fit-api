import { buildPlanSystemPrompt, BuiltPrompts } from '../plan-generator/plan-generator.prompt';

export interface ModifyPlanPromptsInput {
  aiContext: Record<string, unknown>;
  exerciseNames: string[];
  currentPlan: Record<string, any>;
  comment: string;
}

/**
 * Construye los prompts para la MODIFICACIÓN de un plan ya generado.
 *
 * Reutiliza el mismo `systemPrompt` que la generación (`buildPlanSystemPrompt`)
 * para garantizar que la IA devuelva el MISMO formato JSON de 7 días, parseable
 * por `PlanGeneratorParser`. El `userPrompt` indica a la IA qué plan debe modificar
 * (el `currentPlan`), con qué contexto (el `aiContext`) y qué quiere cambiar (el `comment`).
 */
export function buildModifyPlanPrompts(
  aiContext: Record<string, unknown>,
  exerciseNames: string[],
  currentPlan: Record<string, any>,
  comment: string,
): BuiltPrompts {
  const systemPrompt = buildPlanSystemPrompt();

  const exerciseList = exerciseNames.map((name) => `- ${name}`).join('\n');

  let userPrompt = [
    'Modifica el siguiente plan de entrenamiento según la petición del usuario.',
    'Debes devolver el plan COMPLETO actualizado en el mismo formato JSON de 7 días,',
    'no solo el cambio puntual.',
    ``,
    `--- PLAN ACTUAL ---`,
    // Compacto (sin indentar) para no quemar presupuesto de tokens
    `${JSON.stringify(currentPlan)}`,
    ``,
    `--- DATOS DEL USUARIO ---`,
    `${JSON.stringify(aiContext)}`,
  ].join('\n');

  userPrompt += `
\n--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---
Usa SOLO estos ejercicios. Copia el nombre EXACTAMENTE como aparece en la lista:
${exerciseList}
`;

  if (comment && comment.trim().length > 0) {
    userPrompt += `\n\n--- PREFERENCIA DE MODIFICACIÓN DEL USUARIO ---\n${comment.trim()}`;
  }

  userPrompt +=
    '\n\nDevuelve SOLO el objeto JSON completo (7 días), sin explicaciones, sin notas adicionales, sin marcas de código.';

  return { systemPrompt, userPrompt };
}
