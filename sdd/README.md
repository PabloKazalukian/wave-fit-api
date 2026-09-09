# Spec-Driven Development (SDD)

Backlog ejecutable de features del proyecto. Cada archivo `*.md` en esta carpeta es una **spec autocontenida**: una unidad de trabajo que un agente IA (o un humano) puede implementar sin depender de la conversación que la originó.

## Flujo de trabajo

```
Draft spec → Implementación por capas (test-first) → Tests verdes → done (frontmatter)
```

1. **Escribir la spec** en `sdd/<feature>.md` usando `sdd/_TEMPLATE.md` como base.
2. **Estado en frontmatter**: `draft` mientras se redacta, `in_progress` cuando un agente arranca a implementar, `done` cuando pasa la verificación completa.
3. **Test-first por capa**: cada capa (domain → infra → use cases → presentación) se implementa con sus tests antes de pasar a la siguiente. No hay una sola verificación al final.
4. **Verificación final de TODAS las specs**: los requisitos MUST/SHOULD y los tests listados en cada spec tienen que quedar verdes. Comandos canónicos (ver `AGENTS.md §11`):
   - `npm run build`
   - `npm run lint`
   - `npm test`
   - `npm run test:e2e`
5. **Al quedar verde → `status: done`** y commit con mensaje acorde (estilo del repo, español, lower-case).

## Reglas de una spec

- **Self-contained**: incluye contexto, referencias a `archivo:línea`, requisitos, tests y runbook. Un agente nuevo debe poder ejecutarla sin preguntar.
- **Requisitos numerados con RFC 2119**: `MUST` (obligatorio, la verificación final falla si no se cumple), `SHOULD` (recomendado), `MAY` (opcional). Todo requisito es trazable a una línea de la spec.
- **Tests explícitos**: la sección `## Tests to Use` lista comandos concretos (rutas, no la suite completa cuando es posible).
- **Fallo = spec**: si la implementación no cumple un requisito o un test, el fix se hace contra la spec (no contra "guste del agente"). Se puede refinar la spec, pero cualquier cambio se marca en el frontmatter (`updated`).
- **Un feature = una spec**. Si una spec crece demasiado, se divide en subspecs con `depends_on`.

## Relación con `plans/` y `documents/`

| Carpeta | Rol |
|---------|-----|
| `sdd/` | Backlog ejecutable actual (specs activas) |
| `plans/` | Historias de features grandes ya implementadas (fases + decisiones con el usuario) |
| `documents/plans/` | Planes propositivos aún no ejecutados (se convierten en specs cuando se priorizan) |

Cuando un plan de `documents/plans/` o `plans/` se prioriza, se **destila en una spec** aquí y el plan original queda como referencia/contexto.

## Backlog actual

| Spec | Estado | Notas |
|------|--------|-------|
| `day-log.md` | draft | Cerrar el scaffold de day-log (domain + infra + use cases + tests) |
| `stats-dlq.md` | propuesta | Consolida `documents/plans/stats-dlq-audit-logs.md` (DLQ vía audit-logs) + fix SQS |
| `levenshtein-routine.md` | propuesta | Extender control de nombres similares a RoutineDay/RoutinePlan |
| `stats-tests.md` | propuesta | Tests para los use cases puros de stats (hoy 0% cobertura) |

Una vez escrita, una spec propuesta pasa a `draft` y se lista con su `status` real.

## Glosario

- **Spec**: documento de especificación ejecutable en `sdd/`.
- **RFC 2119**: convención de palabras clave (MUST/SHOULD/MAY) con significado normativo.
- **Runbook**: pasos concretos para reproducir/depurar un fallo en producción o en tests.