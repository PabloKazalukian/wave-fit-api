# Criterios y Metodología — Informes de Cobertura de Tests

**Aplica a:** `cobertura-tests-2026-08-21.md` y `cobertura-tests-2026-08-23.md` (y futuros).
**Última actualización:** 2026-08-23

Este documento fija los criterios con los que se generan los informes de
cobertura, para que dos informes de fechas distintas sean **comparables entre sí**
y cualquiera pueda regenerarlos.

---

## 1. Fuentes de datos

| Dato | Fuente | Comando |
|------|--------|---------|
| % unitarios (líneas/ramas) | `coverage/lcov.info` (LF/LH = líneas, BRF/BRH = ramas) | `npm run test:cov` |
| % E2E standalone | `coverage/e2e/coverage-final.json` | `npm run test:e2e:cov` |
| Cobertura combinada | merge istanbul de ambos mapas → `coverage/combined/` | `node scripts/merge-coverage.js` o directo: `npm run test:cov:combined` |

**Regla:** los porcentajes unitarios SIEMPRE se calculan desde `lcov.info`
(no del mapa JSON), porque es la misma fuente que usó el primer informe.
Los totales de suites/tests se toman del output de jest (`Test Suites:` / `Tests:`).

> ⚠️ El `% Lines` de la tabla de jest puede diferir ~1pp del lcov (2518/5024=50.1%
> vs 51.33%): jest deduplica líneas cubiertas por statements vs lcov cuenta DA
> records. Es una diferencia conocida y aceptada; no mezclar fuentes en un mismo informe.

---

## 2. Definiciones de métricas

- **Líneas:** `LH/LF` del lcov (líneas ejecutables encontradas vs alcanzadas).
- **Ramas:** `BRH/BRF` del lcov.
- **Cobertura combinada:** merge ponderado estilo istanbul (`istanbul-lib-coverage`):
  suma de elementos cubiertos / suma de elementos totales **entre ambas suites**,
  no promedio simple de porcentajes.
- **"Cobertura efectiva":** en el informe 21/08 era una *estimación* cualitativa
  (E2E sin instrumentar). Desde el 23/08 se **mide** con el merge; las estimaciones
  viejas solo se citan para validarlas.

---

## 3. Agregación por módulo (buckets)

Los archivos de `lcov.info` se agrupan por ruta. Buckets canónicos (en orden de
precedencia — un archivo cae en el primero que matchea):

| Bucket | Regla sobre la ruta |
|--------|---------------------|
| tracking/extra-session | contiene `\extra-session\` |
| tracking/workout-session | contiene `\workout-session\` |
| user-profile | contiene `\user-profile\` |
| user core | contiene `\modules\user\` y NO `user-profile` |
| audit-logs | contiene `\audit-logs\` |
| templates/exercise | contiene `\exercise\` |
| auth/google | contiene `\google\` |
| templates/routine-day | contiene `\routine-day\` |
| storage | contiene `\storage\` |
| training-plan | contiene `\training-plan\` |
| tracking/week-log | contiene `\week-log\` |
| tracking/day-log | contiene `\day-log\` |
| ai | contiene `\ai\` |
| common/utils | contiene `\common\utils\` |
| common/filters+interceptors | contiene `\common\` pero no `\utils\` |
| auth/core | contiene `\auth\` pero no `\google\` |
| templates/routine-plan | contiene `\routine-plan\` |
| stats | contiene `\stats\` |
| app (main/module/seed/migrations/scripts) | `main.ts`, `app.module*`, `\database\`, `normalize-ids.ts` |

⚠️ **Cambio metodológico 21→23/08:** en el primer informe los scripts
`database/scripts/check-exercise-references.ts` y `fix-exercise-references.ts`
contaban como `common/utils`; ahora cuentan en "app/database". Esto explica parte
del salto de `common/utils` (26.1% → 95.7%) además de los tests nuevos de `string.utils` y `date.utils`. Al comparar módulos entre informes, revisar esta tabla.

---

## 4. Criterios de inclusión / exclusión

| Elemento | ¿Entra al informe? | Motivo |
|----------|--------------------|--------|
| `.spec.ts` de `src/` | ❌ excluidos de cobertura (config jest) | contaminan el mapa con entradas 0% y bajan el total ~10pp artificialmente |
| `main.ts` | ❌ excluido | bootstrap, no lógica testeable |
| `stats/**` | ✅ listado, pero marcado **experimental** | decisión 21/08: fuera de suite y de prioridades hasta activación (ver AGENTS.md §15) |
| Migrations + seed-runner + scripts de DB | ✅ listados en top gaps, prioridad baja | one-off u operativos |
| day-log | ✅ listado | scaffold; sus números se esperan bajos hasta implementarse |

---

## 5. Ponderación cualitativa (sección "lectura")

Áreas con **peso alto** acordadas (se mantienen estables entre informes):

1. **week-log (+ workout-session / extra-session)** — núcleo del negocio.
2. **IA + training-plan** — lógica pura cara de romper, entrada de LLM.
3. **user / perfil / sesión / avatar** — seguridad e identidad.

Reglas de semáforo:

| Emoji | Criterio (combinado) |
|-------|----------------------|
| 🟢 | ≥80% líneas combinadas o mitigado por E2E verificado |
| 🟡 | 60–80% o huecos puntuales identificados |
| 🔴 | <40% efectivo o lógica pura sin ningún test |

---

## 6. Estructura fija de cada informe

1. Header: fecha, fuente exacta (comandos + conteos verde), alcance numérico.
2. Comparativa con el informe anterior (desde el segundo informe en adelante).
3. Resumen ejecutivo (tabla de métricas globales).
4. Tabla por módulo unit-only con denominadores absolutos (X/Y líneas).
5. Lectura por ponderación (semáforos por área crítica).
6. Hallazgos inesperados.
7. Top archivos sin cubrir (unit), con nota de mitigación E2E si aplica.
8. Estado de recomendaciones previas + nuevas recomendaciones priorizadas.

---

## 7. TASK — Checklist para generar el próximo informe

```bash
# 1. Suite verde completa
npx jest --config jest.config.js --forceExit          # anotar suites/tests
npm run test:e2e                                       # anotar suites/tests

# 2. Coberturas
npm run test:cov            # → coverage/lcov.info (unit)
npm run test:e2e:cov        # → coverage/e2e/
node scripts/merge-coverage.js   # → coverage/combined/ + resumen consola

# 3. Agregación por módulo (copiar script de análisis temporal o rehacer):
#    - Parsear coverage/lcov.info → tabla por bucket (sección 3) + top archivos LF-LH
#    - Parsear coverage/combined/coverage-final.json → tabla combinada por bucket

# 4. Redactar documents/reports/cobertura-tests-<fecha>.md siguiendo la sección 6,
#    con columna/tabla de comparativa contra el informe anterior.

# 5. Actualizar este documento si cambió:
#    - algún bucket o regla de clasificación
#    - alguna exclusión (specs/main/stats)
#    - la definición de "cobertura efectiva"
```

### Referencia histórica

| Informe | Líneas unit | Ramas unit | Combinada | Suites/T unit | Suites/T e2e |
|---------|------------|-----------|-----------|---------------|--------------|
| [2026-08-21](./cobertura-tests-2026-08-21.md) | 40.1% | 35.7% | ≈60% (estimada) | 46/240 | 21/112 (sin medir) |
| [2026-08-23](./cobertura-tests-2026-08-23.md) | 50.1% | 49.1% | **67.5% / 60.7% (medida)** | 55/456 | 22/117 (instrumentado) |
