# Correcciones finales de documentación (docs-only)

> Registro del último plan compartido el 2026-09-13. Aplicado y validado.

## Plan: correcciones finales de documentación (docs-only)

1. `documents/decisions/ADR-0007-stats-sqs-worker.md :26`
   - `LAMBDA.md` (eliminado) → sección "Lambda implementation guide" de `documents/modules/stats.md`.

2. `sdd/day-log.spec.md :81` — corregir 5 rutas de use cases a los nombres reales:
   - `find-all-day-log` → `find-all-day-logs`
   - `update-day-status-day-log` → `update-day-status`
   - `assign-routine-day-day-log` → `assign-routine-day`
   - `remove-workout-session-day-log` → `remove-workout-session`
   - `remove-extra-session-day-log` → `remove-extra-session`

3. `sdd/stats-tests.md :8` — "8 use cases" → "9 use cases".

4. `sdd/training-plan.spec.md` (alinear al comportamiento real):
   - FR-002: el parser loguea el `rawResponse` completo (sin truncar) y el 400 es un `BadRequestException` sin `code` — reflejado en el spec.
   - FR-010: añadida la acción de auditoría `TRAINING_PLAN_MODIFIED`.
   - El `console.log` de debug no requiere nota: ya está anotado como deuda en `coding-standards.md:55`.

5. Verificación: re-grep de rutas corregidas + diff. Sin gates build/lint/test (solo markdown).