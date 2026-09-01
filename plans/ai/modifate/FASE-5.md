# Fase 5 — Tests unitarios y E2E

## Objetivo

Cubrir la nueva funcionalidad replicando los patrones de test existentes
(`plan-generator.prompt.spec.ts`, `plan-generator.service.spec.ts`, `confirm-plan.service.spec.ts`)
y el patrón E2E de `test/e2e/`.

## Tests unitarios nuevos

### `plan-modifier/plan-modifier.prompt.spec.ts`
- El `userPrompt` incluye `--- PLAN ACTUAL ---` y el `JSON.stringify(currentPlan)`.
- Incluye `--- DATOS DEL USUARIO ---` con el `aiContext`.
- Incluye `--- PREFERENCIA DE MODIFICACIÓN DEL USUARIO ---` con el `comment` trimmeado.
- Incluye el catálogo (`--- CATÁLOGO DE EJERCICIOS DISPONIBLES ---` y los nombres).
- El `systemPrompt` es `buildPlanSystemPrompt()` (matchea la generación).

### `plan-modifier/plan-modifier.service.spec.ts`
- Flujo feliz: valida perfil → obtiene contexto → re-parsea snapshot del plan → llama a
  `executePrompt` con `buildModifyPlanPrompts` → parse → materializa → construye `aiSnapshot` →
  audita `TRAINING_PLAN_MODIFIED` con success.
- Fallo: si `executePrompt` lanza, audita con success:false y re-lanza.
- Lock: una modificación en curso con distinto comment → `ConflictException`.

## Tests unitarios extendidos

### `training-plan.service.spec.ts`
- `modify`: actualiza el MISMO documento `TrainingPlan`, incrementa `version` a `+1`, actualiza
  `aiSnapshot`/metadatos/fechas.
- `modify` sobre plan confirmado → `ConflictException`.
- `modify` de plan inexistente/no perteneciente → `NotFoundException`.

### `training-plan.resolver.spec.ts`
- `modifyPlan(id, comment, context)` delega en `trainingPlanService.modify(userId, id, comment)`.

## Tests E2E (opcional recomendado)

En `test/e2e/` (por ejemplo `modify-plan.e2e-spec.ts`):
1. Crear usuario + perfil completo.
2. `generatePlan` (mockear IA) → obtener draft.
3. `modifyPlan(id, 'cambiar el día 2 por empuje')` (mockear IA con nuevo JSON) → verificar
   `version` aumentada y `aiSnapshot.rawResponse` actualizado.
4. `confirmPlan(id, CREATE_WEEK_LOG)` → el artefacto se crea a partir del plan **modificado**.
5. Caso negativo: modificar un plan confirmado → error.

## Comandos

```bash
npm test
npm run test:e2e
```
