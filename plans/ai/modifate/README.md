# Modificación de un plan generado con IA (`modifyPlan`)

## Propósito

El proyecto ya cuenta con un pipeline completo de generación IA (`generatePlan` → `PlanGeneratorService`)
que guarda en `aiSnapshot` todo lo necesario (contexto del usuario, prompt usado, `rawResponse` del plan).
Actualmente **no existe** funcionalidad para que el usuario modifique un plan generado: el `comment`
solo se admite en la generación inicial.

Esta feature implementa la mutation `modifyPlan(id, comment)` que reaprovecha el pipeline existente,
pero en lugar de generar desde cero, reenvía a la IA: **el plan actual + el contexto del usuario + el
comentario de cambio**, y sobrescribe el mismo documento `TrainingPlan` con el nuevo resultado.

## Decisiones de diseño (confirmadas con el usuario)

| Decisión | Elección |
|---|---|
| **Estrategia** | Sobrescribir el **mismo documento** `TrainingPlan`: actualiza `aiSnapshot`, `rawResponse`, metadatos y `version + 1`. NO se crean documentos nuevos. |
| **Planes modificables** | Borradores (`draft`) y activos sin confirmar (`confirmed: false`). Los confirmados se rechazan con `ConflictException`. |
| **Datos al prompt** | Se envía a la IA el **plan actual parseado** + el **contexto del usuario** + el **comentario de cambio**. |

### Supuesto pendiente de confirmar

Al modificar se puede usar:
- **(a) Contexto de perfil ACTUAL** (fresco, vía `buildUserContextForAI`), consistente con la re-materialización contra el catálogo vigente — **IMPLEMENTADO (opción elegida)**.
- (b) Contexto del **snapshot original** (`aiSnapshot.contextSentToAI`), para máxima fidelidad a la generación original.

> ✅ **Decisión final:** se implementó la opción (a) — contexto de perfil actual/fresco.

## Impacto en Archivos

| Archivo | Acción |
|---|---|
| `plan-generator/plan-generator.prompt.ts` | Refactor: extraer `systemPrompt` reutilizable |
| `plan-modifier/plan-modifier.prompt.ts` | **Nuevo** — `buildModifyPlanPrompts` |
| `plan-modifier/plan-modifier.service.ts` | **Nuevo** — lógica IA de modificación + lock |
| `plan-modifier/plan-modifier.prompt.spec.ts` | **Nuevo** — tests |
| `plan-modifier/plan-modifier.service.spec.ts` | **Nuevo** — tests |
| `training-plan.service.ts` | Añadir `modify()` |
| `training-plan.resolver.ts` | Añadir mutation `modifyPlan` |
| `training-plan.module.ts` | Registrar `PlanModifierService` |
| `training-plan.service.spec.ts` / `resolver.spec.ts` | Extender tests |
| `README.md` (training-plan) | Documentar `modifyPlan` |

## Rutas GraphQL (nuevas)

```
TrainingPlan:
  modifyPlan(id: String!, comment: String!) -> TrainingPlan   # modifica el plan vigente (mismo doc, version+1)
```

No requiere nuevas env vars (reutiliza `AiService.executePrompt` con el mismo rate-limit `AI_DAILY_LIMIT`).

## Fases de implementación

- [x] [Fase 1](FASE-1.md) — Refactor del prompt (systemPrompt reutilizable)
- [x] [Fase 2](FASE-2.md) — Prompt de modificación (`buildModifyPlanPrompts`)
- [x] [Fase 3](FASE-3.md) — Servicio de modificación IA (`PlanModifierService`)
- [x] [Fase 4](FASE-4.md) — Servicio + Resolver + Módulo (exposición `modifyPlan`)
- [x] [Fase 5](FASE-5.md) — Tests unitarios y E2E
- [x] [Fase 6](FASE-6.md) — Validación final y documentación

## Estado

Implementación **completa y validada**:
- `npm run build` ✅ · `npm run lint` (0 errores) ✅ · `npm test` suite completa (61 suites / 602 tests) ✅
- `npm run test:e2e` suite completa (24 suites / 130 tests) ✅
- Mutation `modifyPlan(id, comment)` expuesta, con `PlanModifierService` registrado.
- E2E de modificación: **implementado** (`test/e2e/training-plan/modify-plan.spec.ts`, 4 casos).
