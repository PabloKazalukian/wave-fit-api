# Fase 4 — Servicio + Resolver + Módulo (exposición `modifyPlan`)

## Objetivo

Exponer la modificación vía GraphQL, orquestada desde `TrainingPlanService.modify()`, y registrar
`PlanModifierService` en el módulo.

## Archivos

1. `src/modules/training-plan/training-plan.service.ts`
2. `src/modules/training-plan/training-plan.resolver.ts`
3. `src/modules/training-plan/training-plan.module.ts`

## 1) `TrainingPlanService.modify()`

```ts
async modify(userId: string, id: string, comment: string): Promise<TrainingPlan> {
  // a) Buscar el plan por _id + userId (scope). Si no existe → NotFoundException.
  // b) Validar modificable: if (plan.confirmed) → ConflictException('El plan ya fue confirmado').
  // c) result = await this.modifier.modifyPlan(userId, plan, comment);  (Fase 3)
  // d) Sobrescribir el MISMO documento:
  //      - aiSnapshot: result.aiSnapshot
  //      - title: result.metadata.title
  //      - focus: result.metadata.focus
  //      - durationWeeks: result.metadata.durationWeeks
  //      - trainingDaysPerWeek: result.metadata.daysPerWeek
  //      - startDate: result.weekLog.startDate
  //      - endDate: startDate + durationWeeks*7
  //      - version: (plan.version ?? 1) + 1
  //    Usar findOneAndUpdate({_id, userId}, {$set: {...}}, {new: true}) o
  //    actualizar el objeto plan y plan.save().
  // e) normalizePlanFocus(plan.focus) y retornar el plan actualizado.
}
```

> **Nota re-materialización en confirmación:** al sobrescribir `aiSnapshot.rawResponse`, el
> `ConfirmPlanService.confirmAsWeekLog` / `confirmAsRoutinePlan` re-parsean y re-materializan contra
> el catálogo vigente. No requiere cambios adicionales.

## 2) `TrainingPlanResolver` — mutation

```ts
@Mutation(() => TrainingPlan, { name: 'modifyPlan' })
async modifyPlan(
  @Args('id', { type: () => String }) id: string,
  @Args('comment', { type: () => String }) comment: string,
  @Context() context,
) {
  const userId = extractUserId(context);
  return this.trainingPlanService.modify(userId, id, comment);
}
```

## 3) `TrainingPlanModule` — registro

- Añadir `PlanModifierService` al array `providers`.
- Inyectar `PlanModifierService` en el constructor de `TrainingPlanService`.

## Verificación

- Resolver expone `modifyPlan` y delega en `trainingPlanService.modify` con el `userId` extraído.
- `TrainingPlanService.modify` actualiza el mismo documento, incrementa `version`, rechaza confirmados.
- `npm run build` sin errores de tipos.
