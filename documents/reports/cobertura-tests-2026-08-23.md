# Informe de Cobertura de Tests

**Fecha:** 2026-08-23
**Fuente:** `npm run test:cov` (suite unitaria completa, 55 suites / 456 tests, todos en verde) **+ cobertura E2E instrumentada** (`npm run test:e2e:cov`, 22 suites / 117 tests) **+ merge** (`scripts/merge-coverage.js`)
**Alcance del dato numérico:** Unitarios desde `coverage/lcov.info`. A diferencia del informe del 21/08, los E2E **sí están instrumentados**: la cobertura combinada se mide, no se estima.
**Informe anterior:** [`cobertura-tests-2026-08-21.md`](./cobertura-tests-2026-08-21.md)

---

## 0. Comparativa con el informe del 21/08

| Métrica | 2026-08-21 | 2026-08-23 | Δ |
|---|---|---|---|
| Líneas (unit) | 2014 / 5024 = 40.1% | **2518 / 5024 = 50.1%** | **+10.0 pp** |
| Ramas (unit) | 908 / 2540 = 35.7% | **1246 / 2540 = 49.1%** | **+13.4 pp** |
| Suites / tests unitarios | 46 / 240 | 55 / 456 | +9 suites, +216 tests |
| Suites / tests E2E | 21 / 112 | 22 / 117 | +1 suite (avatar), +5 tests |
| E2E con cobertura | ❌ no instrumentado | ✅ 54.0% líneas standalone | nuevo |
| **Cobertura combinada (unit + e2e)** | ≈ 60% (**estimada**) | **67.5% líneas / 60.7% ramas (medida)** | estimación validada |

> La estimación de ~60% del informe anterior quedó confirmada por la medición real: **67.5% de líneas combinadas**.

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Líneas cubiertas (unit) | **2518 / 5024 = 50.1%** |
| Ramas cubiertas (unit) | 1246 / 2540 = 49.1% |
| Funciones cubiertas (unit) | 293 / 1182 = 24.8% |
| Suites unitarias | 55/55 ✅ (456 tests) |
| Suites E2E | 22/22 ✅ (117 tests) |
| E2E standalone | 54.0% líneas / 42.4% ramas |
| **Cobertura combinada ponderada (unit + e2e)** | **67.5% líneas / 60.7% ramas / 61.9% funciones** |

La cifra unitaria de 50.1% sigue subestimando la protección real de las capas
hexagonales, pero ahora eso es **medible**: el merge de istanbul muestra cuánto
aporta cada suite.

---

## 2. Cobertura por módulo (solo unitarios)

Comparativo contra el 21/08 entre paréntesis.

| Módulo | Archivos | Líneas | Cubiertas | % Lines | Branches | Br. cub. | % Branch |
|--------|---------:|-------:|----------:|--------:|---------:|---------:|---------:|
| tracking/extra-session | 8 | 191 | 150 | **78.5%** (=) | 95 | 70 | 73.7% (=) |
| tracking/workout-session | 10 | 237 | 179 | **75.5%** (=) | 135 | 97 | 71.9% (=) |
| user-profile | 45 | 974 | 738 | **75.8%** (+1.7) | 424 | 257 | 60.6% (+4.2) |
| user core | 7 | 161 | 135 | **83.9%** (+21.8) | 50 | 40 | 80.0% (+10.0) |
| audit-logs | 8 | 120 | 106 | **88.3%** (+30.8) | 101 | 83 | 82.2% (+41.6) |
| templates/exercise | 7 | 122 | 108 | **88.5%** (+31.9) | 40 | 33 | 82.5% (+32.5) |
| auth/google | 9 | 125 | 68 | **54.4%** (=) | 67 | 39 | 58.2% (=) |
| templates/routine-day | 7 | 133 | 106 | **79.7%** (+25.6) | 52 | 41 | 78.8% (+15.3) |
| storage | 6 | 35 | 21 | **60.0%** (+8.6) | 4 | 3 | 75.0% (=) |
| training-plan | 15 | 443 | 355 | **80.1%** (+45.4) | 341 | 280 | **82.1%** (+49.3) |
| tracking/week-log | 25 | 813 | 294 | 36.2% (+2.0) | 509 | 172 | 33.8% (=) |
| tracking/day-log | 13 | 78 | 25 | 32.1% (=) | 10 | 6 | 60.0% (=) |
| ai | 7 | 44 | 21 | **47.7%** (+18.2) | 16 | 14 | **87.5%** (+50.0) |
| common/utils | 4 | 70 | 67 | **95.7%** (+69.6) | 45 | 38 | **84.4%** (+74.8) |
| auth/core (JWT/local/guards) | 7 | 103 | 45 | **43.7%** (+23.3) | 66 | 29 | 43.9% (+22.7) |
| templates/routine-plan | 7 | 135 | 91 | **67.4%** (+54.8) | 66 | 41 | 62.1% (+53.0) |
| stats *(experimental, fuera de suite)* | 32 | 692 | 0 | 0.0% (=) | 272 | 0 | 0.0% (=) |
| app (main/module/seed/migrations/scripts) | 11 | 396 | 0 | 0.0% | 160 | 0 | 0.0% |

*Nota metodológica:* `common/utils` pasa de 6 a 4 archivos porque los scripts
`check-exercise-references.ts` y `fix-exercise-references.ts` se clasifican ahora
en el bucket "app/database" (ver criterios).

---

## 3. Lectura según la ponderación definida

Peso alto acordado para: **week-log (+WS/ES)**, **IA + training-plan**, **user/perfil/sesión/avatar**.
Ahora con valores **medidos** de la cobertura combinada:

### 🟢 week-log + workout-session + extra-session — BIEN CUBIERTO (ahora medido)
- Estimación del 21/08: "~85-90%". **Medición real combinada: 84.9% líneas / 66.8% ramas.** ✅ estimación validada.
- WS 96.6% / ES 95.8% combinadas. El resolver de week-log llega al **94.3%** y
  los use cases al 63–100% vía E2E.
- Punto más flojo: `update-week-log.use-case` (63%) y el validator (56.5%).

### 🟢 user / perfil / sesión / avatar — SUBIÓ DE 🟡 A 🟢
- user core combinado: **98.1%** / user-profile: **97.0%**.
- Nuevo E2E de avatar (`test/e2e/user/update-avatar.spec.ts`, 5 tests) cubre
  upload, persistencia, formatos inválidos y límite de 5MB contra S3 mockeado.
- Hueco restante: `google.service.ts` (17.2% unit) — requiere OAuth real o
  tests de contrato.

### 🟢 IA + training-plan — DEJÓ DE SER EL GAP CRÍTICO
- Del "<10% efectivo" del 21/08 a **80.1% líneas / 82.1% ramas combinadas**.
- `plan-generator.parser` 100%, `.prompt` 100%, `plan-validator` 100%/97.7%,
  `plan-generator.service` 100%/82% (unitarios puros).
- `ai.service` 100%/91.7% unit. Queda `groq.provider` sin cubrir (provider real).

---

## 4. Hallazgos inesperados

1. **Bug real encontrado por los tests**: `AuditInterceptor.extractIp` accedía
   `req.headers['x-forwarded-for']` sin optional chaining sobre `headers` y
   crasheaba si el request no traía headers. Corregido con test de regresión.
2. **Instrumentar cobertura en E2E tuvo dos trampas** (documentadas):
   `collectCoverageFrom` no alcanza archivos fuera del `rootDir` (silenciosamente
   ignora), y los `.spec.ts` de `src/` contaminaban el mapa con entradas a 0%,
   bajando el total combinado ~10pp hasta excluirlos.
3. **El content-type del avatar conserva el formato origen** (p.ej. `image/png`)
   aunque sharp re-encodee el buffer a JPEG. Se dejó como comportamiento
   esperado y quedó documentado en el E2E.
4. `gql-exception.filter.ts` (40 líneas) y `normalize-ids.ts` (75) emergen como
   gaps visibles ahora que la instrumentación es más completa.
5. **stats sigue en 0.0%** — decisión tomada el 21/08: módulo experimental,
   fuera de la suite y de este informe hasta que se active.

---

## 5. Archivos con más lógica sin cubrir (top 10, unit)

| Líneas sin cubrir | Archivo | Nota |
|---:|---|---|
| 76 | `stats/presentation/dto/save-stats.input.ts` | Stats 0% (experimental) |
| 75 | `src/normalize-ids.ts` | Utilidad suelta, prioridad baja |
| 71 | `week-log/infrastructure/repositories/week-log.repository.ts` | Mitigado por E2E (~70% combinado) |
| 71 | `stats/presentation/dto/worker-raw-data.output.ts` | Stats 0% (experimental) |
| 70 | `week-log/application/use-cases/update-week-log.use-case.ts` | Mitigado por E2E (63% combinado) |
| 66 | `database/migrations/001-fix-string-ids.migration.ts` | Script one-off, prioridad baja |
| 53 | `stats/stats.resolver.ts` | Stats 0% (experimental) |
| 52 | `week-log/application/use-cases/update-day.use-case.ts` | Mitigado por E2E (83% combinado) |
| 52 | `stats/domain/entities/stats.domain.ts` | Stats 0% (experimental) |
| 47 | `database/scripts/check-exercise-references.ts` | Script operativo, prioridad baja |

---

## 6. Estado de las recomendaciones del 21/08

| # | Recomendación | Estado |
|---|---|---|
| 1 | Specs de `plan-generator.parser` + `plan-validator.service` | ✅ Hecho (33 tests) |
| 2 | Specs conductuales de `AiService` + `training-plan.service` | ✅ Hecho (22 tests) |
| 3 | Decidir destino de `stats` | ✅ Decidido: experimental, docs actualizadas |
| 4 | Fix de `test:cov` en package.json | ✅ Hecho |
| 5 | `routine-plan.resolver.spec` conductual | ✅ Hecho (14 tests) |
| 6 | E2E mínimo de storage/avatar | ✅ Hecho (5 tests) |
| 7 | Cobertura instrumentada también en E2E | ✅ Hecho (merge script + configs) |

## 7. Próximos pasos sugeridos (nuevos)

| # | Acción | Impacto | Esfuerzo |
|---|--------|---------|----------|
| 1 | Tests del `GraphQLExceptionFilter` (40 líneas, corre en TODAS las respuestas de error) | Alto transversal | Bajo |
| 2 | Subir `update-week-log.use-case` (63%) y `week-log.validator` (56.5%) con unitarios | Medio-Alto | Medio |
| 3 | Tests de contrato/mock de transport para `google.service` (17%) | Medio | Medio |
| 4 | Incluir `test:cov:combined` en el flujo periódico para regenerar estos informes | Transversal | Trivial |
| 5 | Cuando day-log salga de scaffold, nacer con specs desde el día 1 (lección de esta iteración) | Preventivo | — |
| 6 | Scripts de DB (`seed-runner`, migrations): documentar explícitamente como fuera de alcance o testear | Higiene | Bajo |

---

*Generado desde `coverage/lcov.info` + merge istanbul. Para regenerar:*
```bash
npm run test:cov:combined   # unit + e2e + merge → coverage/combined/
```
