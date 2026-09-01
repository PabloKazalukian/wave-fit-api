# Fase 3 — Servicio de modificación IA (`PlanModifierService`)

## Objetivo

Orquestar la llamada a la IA para modificar un plan ya existente, reutilizando el pipeline
de `PlanGeneratorService` (validación → contexto → prompt → parse → materializar → audit),
pero construyendo el prompt a partir del **plan actual**.

## Archivo

`src/modules/training-plan/plan-modifier/plan-modifier.service.ts` (NUEVO)

## Dependencias (inyectadas, mismas que `PlanGeneratorService`)

- `UserProfileService`
- `AiService`
- `PlanValidatorService`
- `PlanGeneratorParser`
- `ExerciseService`
- `AuditLogsService`
- `PlanMaterializerService`
- `@InjectModel(Goal.name)` — para el snapshot del objetivo (opcional, ver nota)

## Firma

```ts
async modifyPlan(
  userId: string,
  plan: TrainingPlan,   // documento vigente a modificar
  comment: string,
): Promise<GeneratePlanResult>
```

## Flujo

1. **Validar perfil** — `planValidator.validate(userId)`; si inválido → `BadRequestException`
   igual que en `generatePlan`.
2. **Obtener perfil + contexto** — `userProfileService.getFullProfileContext(userId)` →
   `buildUserContextForAI(profile)`. *(Supuesto: contexto ACTUAL/fresco. Si se prefiere el del
   snapshot: `plan.aiSnapshot.contextSentToAI`.)*
3. **Catálogo único** — `materializer.buildUniqueCatalogNames(userId, exercises)` vía
   `exerciseService.findAll()`.
4. **Plan actual** — re-parsear el snapshot vigente:
   `currentPlan = parser.parseWithRawJson(JSON.stringify(plan.aiSnapshot.rawResponse)).plan`.
5. **Prompt de modificación** — `buildModifyPlanPrompts(aiContext, exerciseNames, currentPlan, comment)`.
6. **Llamada IA** — `aiService.executePrompt({ providerName, systemPrompt, userPrompt, userId })`.
7. **Parse** — `parser.parseWithRawJson(rawContent)` → `{ plan, rawJson }`.
8. **Materializar** — `materializer.materializeWeekLog(userId, parsedPlan)` (resuelve nombres → ids
   contra catálogo vigente).
9. **Focus** — `resolveFocus(parsedPlan.focus, aiContext)` (misma lógica que `PlanGeneratorService`).
10. **Audit** — `TRAINING_PLAN_MODIFIED` con `success` y metadatos (title, focus, tokens, durationMs);
    log de fallo con `cause` en el `catch`.

## Lock de idempotencia

- Añadir `private readonly inFlight = new Map<string, { comment: string; promise: Promise<GeneratePlanResult> }>()`
  claveado por `userId`, **idéntico** a `PlanGeneratorService.inFlight`.
- Así, una modificación concurrente con distinto comment lanza `ConflictException` y se evitan
  llamadas IA duplicadas. Idealmente `modifyPlan` y `generatePlan` comparten el mismo bloqueo
  conceptual por `userId` (una sola operación IA en curso por usuario).

> **Nota sobre Goal snapshot:** `generatePlan` crea un documento `Goal` como auditoría del contexto.
> Para `modifyPlan`, como el contexto cambia, se puede crear un Goal nuevo o reutilizar el del plan si
> se mantiene fidelidad al snapshot. Recomendado: crear un Goal nuevo con el `contextSnapshot` usado
> (consistente con el supuesto de contexto fresco).

## Verificación

- `plan-modifier.service.spec.ts` (Fase 5): vi\"s que usa `buildModifyPlanPrompts`, llama a `executePrompt`,
  re-parsea el snapshot, materializa y construye el `aiSnapshot` correctamente.
