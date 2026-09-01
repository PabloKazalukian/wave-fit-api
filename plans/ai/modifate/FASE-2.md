# Fase 2 — Prompt de modificación (`buildModifyPlanPrompts`)

## Objetivo

Crear el constructor de prompts específico para la **modificación** de un plan: envía a la IA el
**plan actual** (para que sepa qué cambiar), el **contexto del usuario**, y el **comentario de cambio**.
Debe reutilizar el mismo `systemPrompt` extraído en la Fase 1 para garantizar un formato de salida
idéntico al de `generatePlan`.

## Archivo

`src/modules/training-plan/plan-modifier/plan-modifier.prompt.ts` (NUEVO)

## Firma

```ts
export function buildModifyPlanPrompts(
  aiContext: Record<string, unknown>,   // contexto del usuario (actual o del snapshot)
  exerciseNames: string[],              // catálogo único de ejercicios
  currentPlan: Record<string, any>,     // ParsedPlan actual (lo que se va a modificar)
  comment: string,                      // qué quiere modificar el usuario
): { systemPrompt: string; userPrompt: string }
```

## Implementación

- `systemPrompt = buildPlanSystemPrompt()` (importado de `plan-generator.prompt`).
- `userPrompt` compuesto por secciones:

```
Modifica el siguiente plan de entrenamiento según la petición del usuario.
Debes devolver el plan COMPLETO actualizado en el mismo formato JSON de 7 días, no solo el cambio.

--- PLAN ACTUAL ---
{JSON.stringify(currentPlan)}          # compacto, sin indentar (ahorro de tokens)

--- DATOS DEL USUARIO ---
{JSON.stringify(aiContext)}

--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---
Usa SOLO estos ejercicios. Copia el nombre EXACTAMENTE como aparece en la lista:
- {name}
...

--- PREFERENCIA DE MODIFICACIÓN DEL USUARIO ---
{comment.trim()}

Devuelve SOLO el objeto JSON completo (7 días), sin explicaciones, sin notas adicionales, sin marcas de código.
```

## Reglas a respetar

- El JSON de salida debe contener **exactamente 7 días** y la estructura completa del plan
  (`title`, `focus`, `durationWeeks`, `daysPerWeek`, `days[]`).
- La IA debe conservar la estructura y solo aplicar los cambios pedidos por `comment`.
- Los nombres de ejercicio deben copiarse exactamente del catálogo (idéntica regla que generación).

## Verificación

- `plan-modifier.prompt.spec.ts` (Fase 5) verifica que el userPrompt incluye: "PLAN ACTUAL",
  el `JSON.stringify(currentPlan)`, "DATOS DEL USUARIO", el catálogo y el `comment`.
