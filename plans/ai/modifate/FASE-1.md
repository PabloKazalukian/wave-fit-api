# Fase 1 — Refactor del prompt (systemPrompt reutilizable)

## Objetivo

Evitar duplicar el cuerpo de reglas del entrenador + especificación de la estructura JSON de salida
entre la generación (`generatePlan`) y la modificación (`modifyPlan`). Extraer el `systemPrompt`
actual a una función exportada reutilizable para que ambas operaciones produzcan **exactamente el
mismo formato de salida** (parseable por `PlanGeneratorParser`).

## Archivo

`src/modules/training-plan/plan-generator/plan-generator.prompt.ts`

## Cambios

1. Extraer el texto del `systemPrompt` (reglas del entrenador + `ESTRUCTURA JSON ESPERADA` + `IMPORTANTE`)
   de la función `buildPlanPrompts` a una nueva función exportada:

```ts
export function buildPlanSystemPrompt(): string {
  const lines = [
    'Eres un preparador físico experto con más de 10 años de experiencia.',
    // ... (el contenido actual íntegro del systemPrompt)
  ];
  return lines.join('\n');
}
```

2. Dentro de `buildPlanPrompts`, reemplazar el armado inline del `systemPrompt` por:

```ts
const systemPrompt = buildPlanSystemPrompt();
```

3. El `userPrompt` de `buildPlanPrompts` **no se toca**.

## Resultado esperado

- `buildPlanPrompts(aiContext, exerciseNames, comment)` sigue devolviendo `{ systemPrompt, userPrompt }`
  con la MISMA salida de antes (sin regresión).
- `buildPlanSystemPrompt()` queda disponible para la Fase 2.

## Verificación

- `npx jest --config jest.config.js src/modules/training-plan/plan-generator/plan-generator.prompt.spec.ts`
- El test existente de prompt debe seguir pasando sin cambios.
