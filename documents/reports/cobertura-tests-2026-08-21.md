# Informe de Cobertura de Tests

**Fecha:** 2026-08-21
**Fuente:** `npx jest --config jest.config.js --coverage` (suite unitaria completa, 46 suites / 240 tests, todos en verde)
**Alcance del dato numérico:** SOLO tests unitarios. Los tests E2E no están instrumentados con cobertura; su aporte se evalúa cualitativamente en la sección 5.

---

## 1. Resumen ejecutivo

| Métrica | Valor |
|---|---|
| Líneas cubiertas | **2014 / 5024 = 40.1%** |
| Ramas cubiertas | 908 / 2540 = 35.7% |
| Suites unitarias | 46/46 ✅ |
| Tests unitarios | 240/240 ✅ |
| Suites E2E | 21/21 ✅ (112 tests) |
| **Cobertura efectiva ponderada** (unit + e2e, con las áreas críticas pesando más) | **≈ 60%** |

La cifra de 40% de líneas subestima la protección real: los flujos más complejos
(week-log, workout-session) están cubiertos mayormente por E2E end-to-end,
que este reporte no mide pero que ejercita el código completo por HTTP + MongoDB real.

---

## 2. Cobertura por módulo (solo unitarios)

| Módulo | Archivos | Líneas | Cubiertas | % Lines | Branches | Br. cub. | % Branch |
|--------|---------:|-------:|----------:|--------:|---------:|---------:|---------:|
| tracking/extra-session | 8 | 191 | 150 | **78.5%** | 95 | 70 | 73.7% |
| tracking/workout-session | 10 | 237 | 179 | **75.5%** | 135 | 97 | 71.9% |
| user-profile | 45 | 974 | 722 | **74.1%** | 424 | 239 | 56.4% |
| user core | 7 | 161 | 100 | **62.1%** | 50 | 35 | 70.0% |
| audit-logs | 8 | 120 | 69 | 57.5% | 101 | 41 | 40.6% |
| templates/exercise | 7 | 122 | 69 | 56.6% | 40 | 20 | 50.0% |
| auth/google | 9 | 125 | 68 | 54.4% | 67 | 39 | 58.2% |
| templates/routine-day | 7 | 133 | 72 | 54.1% | 52 | 33 | 63.5% |
| storage | 6 | 35 | 18 | 51.4% | 4 | 3 | 75.0% |
| training-plan | 17 | 501 | 174 | 34.7% | 354 | 116 | 32.8% |
| tracking/week-log | 25 | 813 | 278 | 34.2% | 509 | 172 | 33.8% |
| tracking/day-log | 13 | 78 | 25 | 32.1% | 10 | 6 | 60.0% |
| ai | 7 | 44 | 13 | 29.5% | 16 | 6 | 37.5% |
| common/utils | 6 | 115 | 30 | 26.1% | 83 | 8 | 9.6% |
| auth/core (JWT/local/guards) | 7 | 103 | 21 | 20.4% | 66 | 14 | 21.2% |
| templates/routine-plan | 7 | 135 | 17 | 12.6% | 66 | 6 | 9.1% |
| app (main/module/seed/migrations) | 16 | 445 | 9 | 2.0% | 196 | 3 | 1.5% |
| stats | 32 | 692 | 0 | **0.0%** | 272 | 0 | 0.0% |

---

## 3. Lectura según la ponderación definida

Peso alto acordado para: **week-log (+WS/ES)**, **IA + training-plan**, **user/perfil/sesión/avatar**.

### 🟢 week-log + workout-session + extra-session — BIEN CUBIERTO
- Unit: 139 tests conductuales. WS 75.5%, ES 78.5%.
- week-log marca 34.2% en líneas porque su lógica vive en capas hexagonales
  (`use-cases/`, `infrastructure/repositories`) que se ejercitan vía E2E:
  14 specs E2E (~50 tests) recorren CRUD completo, `updateDay` unificada,
  asignación de rutinas y catálogo de extra-sessions sobre GraphQL+Mongo real.
- **Cobertura efectiva estimada: ~85-90%.** Área más protegida del proyecto.

### 🟡 user / perfil / sesión / avatar — FUERTE CON HUECOS PUNTUALES
- user-profile: 74.1% líneas (el módulo más grande medido: 974 líneas, 45 archivos).
- auth/core baja a 20.4%: las estrategias JWT/local y el guard se prueban con
  mocks ligeros; sus ramas de error quedaron sin ejercitar.
- Avatar/storage: 51% solo humo-conductual básico; el flujo avatar-Google se
  testea con mocks (no hay E2E de storage).
- **Cobertura efectiva estimada: ~70-75%.**

### 🔴 IA + training-plan — EL GAP CRÍTICO
- Solo specs "should be defined" → 34.7% (training-plan) y 29.5% (ai), casi todo
  decoradores y firmas, no lógica.
- Sin cobertura real ni unit ni e2e en:
  - `plan-generator.parser.ts` (parsing de respuestas del LLM)
  - `plan-generator.prompt.ts` (46 líneas sin cubrir)
  - `plan-validator.service.ts` (reglas del plan)
  - Selección de providers y manejo de errores de `AiService`
- **Cobertura efectiva estimada: <10%.** Es lógica pura (sin DB), la más barata
  de testear y hoy la más desprotegida de las áreas de alto peso.

---

## 4. Hallazgos inesperados

1. **`stats` ya NO es un placeholder**: tiene 32 archivos / 692 líneas (use cases
   de adherence, personal-records, top-exercises, DTOs de worker, event-publisher)
   con **0.0% de cobertura total**. El AGENTS.md lo describe como placeholder;
   el módulo evolucionó sin que la suite lo acompañe. Es el mayor gap absoluto
   del proyecto en volumen.
2. **El script `npm run test:cov` está roto**: falla con *"Multiple configurations
   found"* (config dual de Jest). Hay que correr
   `npx jest --config jest.config.js --coverage`. Candidato a fix en package.json.
3. **`routine-plan.resolver.ts` tiene 56 líneas sin cubrir**: es de las piezas de
   templates con más lógica (orquesta RoutineDayService) y hoy solo hay humo.

---

## 5. Archivos con más lógica sin cubrir (top 10)

| Líneas sin cubrir | Archivo | Nota |
|---:|---|---|
| 76 | `stats/presentation/dto/save-stats.input.ts` | Stats 0% |
| 71 | `week-log/infrastructure/repositories/week-log.repository.ts` | Mitigado por E2E |
| 70 | `week-log/application/use-cases/update-week-log.use-case.ts` | Mitigado por E2E |
| 66 | `database/migrations/001-fix-string-ids.migration.ts` | Script one-off, prioridad baja |
| 56 | `templates/routine-plan/routine-plan.resolver.ts` | Sin mitigar |
| 53 | `stats/stats.resolver.ts` | Stats 0% |
| 52 | `week-log/application/use-cases/update-day.use-case.ts` | Mitigado por E2E |
| 52 | `stats/domain/entities/stats.domain.ts` | Stats 0% |
| 46 | `training-plan/plan-generator/plan-generator.prompt.ts` | Gap crítico IA |
| 45 | `training-plan/plan-generator/plan-generator.service.ts` | Gap crítico IA |

---

## 6. Recomendaciones priorizadas

| # | Acción | Impacto ponderado | Esfuerzo |
|---|--------|-------------------|----------|
| 1 | Specs unitarios de `plan-generator.parser` + `plan-validator.service` (JSON malformado, campos faltantes, reglas inválidas) | Alto (área crítica, lógica pura) | Bajo |
| 2 | Specs conductuales de `AiService` (provider map, errores de provider) y `training-plan.service` (estados, mockeando generator) | Alto | Medio |
| 3 | Decidir destino de `stats`: si está activo, arrancar por use cases puros (adherence, PRs, top-exercises); si no, marcarlo experimental en docs | Alto en volumen | Medio-Alto |
| 4 | Fix de `test:cov` en package.json (`--config jest.config.js`) para que el reporte sea reproducible | Transversal | Trivial |
| 5 | `routine-plan.resolver.spec` conductual (56 líneas) | Medio | Bajo |
| 6 | E2E mínimo de storage/avatar (subida real contra bucket mockeado local) | Medio (cierra hueco avatar) | Medio |
| 7 | Cobertura instrumentada también en E2E (jest coverage + supertest) para medir la protección real de week-log | Transversal | Medio |

---

*Generado automáticamente desde `coverage/lcov.info`. Para regenerar:*
```bash
npx jest --config jest.config.js --coverage
```
