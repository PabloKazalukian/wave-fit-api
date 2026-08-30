# Plan: Idempotencia, Rate Limit, Logging y Retry en generación de planes (training-plan / AI)

> Fecha: 2026-08-23
> Estado: Plan aprobado, pendiente de implementación

---

## Prompt original del usuario

> bien, quiero que diseñes un plan para implementar en training-plan de:
>
> 1. Idempotencia en generacion.
> 2. Rate limit por usuario,
> 3. Logging diferenciado de fallos,
> 4. retry/backoff ante fallos de groq.
>
> Te estare ahora detallando:
>
> **Implementar un lock en memoria por userId en PlanGeneratorService:** si ya hay una generación en curso para ese usuario, la segunda invocación debe esperar la misma promesa en vuelo (no disparar una segunda llamada a Groq). Usar un `Map<string, Promise<GeneratePlanResult>>` con cleanup en finally. Si dos invocaciones llegan con distinto "comment" mientras la primera sigue en vuelo, la segunda debe rechazarse con un error explícito ("ya hay una generación en curso") en vez de devolver silenciosamente el resultado de la primera con el comment equivocado.
>
> **Fixed window counter en el módulo AI** (no en training-plan), usando Mongo ya que es la única dependencia de estado del proyecto:
> - Schema `ai-usage.schema.ts`: userId, windowStart (inicio del día UTC), count, con índice único `{ userId: 1, windowStart: 1 }`.
> - Servicio `AiRateLimitService.assertWithinLimit(userId)`: findOneAndUpdate con upsert + `$inc` atómico; si count supera el límite (env `AI_DAILY_LIMIT`, default 10), lanzar HttpException 429.
> - Manejar el caso de carrera en el primer insert concurrente (E11000 por índice duplicado): capturar y reintentar una vez, no dejar que explote como error genérico.
> - Punto de corte: al inicio de `AiService.executePrompt`, antes de invocar el modelo. Esto protege a cualquier consumidor futuro del módulo AI, no solo a training-plan.
> - Agregar el código 429 al mapeo de errores del exception filter GraphQL para que no caiga en INTERNAL_SERVER_ERROR.
>
> **Agregar Logger a AiService y PlanGeneratorService** (hoy ninguna de las dos clases lo tiene). Loguear (utilizar audit-log en lo posible):
> - En AiService.executePrompt: provider, duración de la llamada, tokensUsed, y en catch clasificar la causa (timeout / HTTP status / error desconocido) antes de re-lanzar.
> - En el parseo del rawResponse: si JSON.parse falla, loguear el contenido crudo truncado (primeros ~500 chars) antes de lanzar, para poder diagnosticar JSON malformado post-mortem.
> - Si existe o se agrega validación de exerciseId contra el catálogo real, loguear la lista de IDs inválidos recibidos (relevante por el bug de string-vs-ObjectId ya mencionado).
> - Usar una taxonomía mínima de causas para poder filtrar en logs: AI_PROVIDER_ERROR, AI_MALFORMED_JSON, AI_UNKNOWN_EXERCISE_ID, RATE_LIMIT_EXCEEDED.
> - Migrar los console.log/console.error sueltos que encuentres en el flujo de generación a Logger, para consistencia.
>
> **El flujo es síncrono** (el usuario espera en pantalla), así que el mecanismo debe ser acotado:
> - Configurar explícitamente el cliente ChatGroq con timeout (~45s) y maxRetries (~2) propios del SDK.
> - Agregar una única capa de reintento externo en AiService: máximo 2 intentos totales, backoff corto fijo (~1s), solo para errores transitorios (network/timeout/HTTP 5xx/429). Si viene Retry-After en un 429, respetarlo. Errores de validación/parseo NO deben reintentarse (no son transitorios).
> - Definir un presupuesto de tiempo total compartido entre reintentos (no que cada intento tenga su propio timeout independiente sin techo agregado), para no estirar la espera del usuario más allá de ~60-90s peor caso.
> - Integrar con el logging del punto 3: cada intento fallido se loguea con su causa antes del siguiente intento.

---

## Decisiones confirmadas por el usuario

| Pregunta | Decisión |
|---|---|
| ¿SDK maxRetries + capa externa de reintentos? | **`maxRetries=0` en SDK**: ChatGroq solo con timeout=45s. La capa externa controla los reintentos (máx 2 retries), backoff corto, `Retry-After` en 429 y deadline global (~80s). Peor caso acotado. |
| ¿Qué hacer ante exerciseId inválido? | **Loguear + rechazar con 400**: validar contra el catálogo ya cargado para el prompt; si hay IDs desconocidos, loguearlos con causa `AI_UNKNOWN_EXERCISE_ID` y fallar rápido con 400, evitando crear WeekLog/sesiones rotas. |

---

## Fase A — Mapeo 429 en exception filter

**Archivo:** `src/common/filters/gql-exception.filter.ts`

- Agregar `429: 'TOO_MANY_REQUESTS'` al mapa `getHttpErrorCode()` (líneas 162-173). No hace falta nada más: `handleHttpException` ya enruta cualquier `HttpException`.

---

## Fase B — Rate limit por usuario (módulo AI)

### Archivos nuevos

| Archivo | Contenido |
|---|---|
| `src/modules/ai/schemas/ai-usage.schema.ts` | `AiUsage`: `userId` (ObjectId, index), `windowStart` (Date), `count` (default 0). Índice único compuesto `{ userId: 1, windowStart: 1 }`. TTL opcional sobre `windowStart` (~2 días) para auto-purgado |
| `src/modules/ai/ai-rate-limit.service.ts` | Ver abajo |
| `src/modules/ai/ai-rate-limit.service.spec.ts` | Tests del servicio |

### `AiRateLimitService.assertWithinLimit(userId)`

1. `windowStart` = medianoche UTC del día actual (`Date.UTC(y, m, d)`).
2. Límite: `process.env.AI_DAILY_LIMIT` (default **10**).
3. `findOneAndUpdate({ userId, windowStart }, { $inc: { count: 1 } }, { upsert: true, new: true })` — atómico.
4. Catch de `E11000` (carrera del primer insert concurrente): **reintentar una vez** la misma operación; si falla de nuevo, relanzar mapeado (no error genérico).
5. Si `doc.count > limit` → `new HttpException({ message: 'Límite diario de generaciones alcanzado', code: 'RATE_LIMIT_EXCEEDED', limit, resetAt }, 429)`.

### Wiring

`ai.module.ts` agrega `MongooseModule.forFeature([{ name: AiUsage.name, schema: AiUsageSchema }])` y registra/exporta `AiRateLimitService`.

### Punto de corte

Inicio de `AiService.executePrompt` (`src/modules/ai/ai.service.ts:17`):

- El options object gana campo opcional `userId?: string` (retrocompatible con otros callers).
- Si viene `userId` → `assertWithinLimit(userId)`. `PlanGeneratorService` lo pasa.

> Supuesto explícito: 1 generación = 1 unidad consumida aunque falle Groq internamente (los reintentos internos no suman); sin refund por fallo.

---

## Fase C — Lock de idempotencia en `PlanGeneratorService`

En `src/modules/training-plan/plan-generator/plan-generator.service.ts`:

```ts
private readonly inFlight = new Map<string, {
  comment: string;
  promise: Promise<GeneratePlanResult>;
}>();
```

Flujo de `generatePlan(userId, comment)`:

1. Si existe entrada para `userId`:
   - mismo `comment` → retornar la promesa en vuelo (comparte resultado, no dispara segunda llamada a Groq ni crea segundo Goal);
   - distinto `comment` → `ConflictException('Ya hay una generación de plan en curso para este usuario')` (409, ya mapeado por el filtro).
2. Si no hay entrada: registrar `{ comment, promise }` **sincrónicamente** antes del primer `await` (cierra la brecha check-then-act), ejecutar el cuerpo actual en un método privado `doGenerate()`.
3. **Cleanup en `finally`** con guardia de identidad (`if (this.inFlight.get(userId) === entry)`) para no borrar una entrada más nueva.
4. Los waiters comparten la misma promesa: reciben el resultado o el error naturalmente.

Limitación documentada: lock en memoria por instancia (válido con deploy single-node; no hay Redis en el proyecto).

---

## Fase D — Logging diferenciado

### Taxonomía (nuevo `src/modules/ai/ai-error-causes.ts`)

```ts
export const AI_CAUSE = {
  PROVIDER: 'AI_PROVIDER_ERROR',
  MALFORMED_JSON: 'AI_MALFORMED_JSON',
  UNKNOWN_EXERCISE_ID: 'AI_UNKNOWN_EXERCISE_ID',
  RATE_LIMIT: 'RATE_LIMIT_EXCEEDED',
} as const;
```

### Cambios por clase

| Clase | Cambios |
|---|---|
| `AiService` | Agregar `Logger` + inyectar `AuditLogsService` (importando `AuditLogsModule` en `AiModule`). Medir `durationMs` por intento. Éxito: `logger.log` + `auditLogService.logAsync({ action: 'AI_PROMPT_EXECUTED', entity: 'Ai', userId, success: true, metadata: { provider, modelUsed, durationMs, tokensUsed } })`. En catch: clasificar causa (helper abajo), `logger.error` con contexto, audit fire-and-forget con `success: false`, y re-lanzar. Eliminar el `console.log` comentado (L49) |
| `PlanGeneratorParser` | Agregar `Logger`. Envolver `JSON.parse`: si lanza, loguear `AI_MALFORMED_JSON` + contenido crudo truncado (500 chars) y lanzar `BadRequestException` clara |
| `PlanGeneratorService` | Agregar `Logger` + `AuditLogsService`. Loguear inicio/fin con duración total. Nueva validación de `exerciseId` contra catálogo ya cargado (`Set` de `String(e.id)`): si hay inválidos → loguear lista con causa `AI_UNKNOWN_EXERCISE_ID` + audit + `BadRequestException` con los IDs. Fix menor: eliminar el doble `JSON.parse(rawContent)` (L123), reutilizar lo parseado. Audit final `TRAINING_PLAN_GENERATED` |

### Helper de clasificación (en `AiService`, reutilizado por Fase E)

Inspecciona `err.code` (`ETIMEDOUT`/`ECONNABORTED`), mensaje de timeout, `err.response?.status || err.status`, y devuelve la causa de la taxonomía.

Fuera de alcance: los `console.error` de week-log (`create-week-log.use-case.ts`) no pertenecen a este flujo; quedan pendientes para otra tarea.

---

## Fase E — Retry/backoff ante fallos de Groq

### Config SDK (`src/modules/ai/providers/groq.provider.ts`)

```ts
new ChatGroq({
  ...,
  timeout: Number(process.env.AI_CALL_TIMEOUT_MS ?? 45000),
  maxRetries: 0,
});
```

### Capa externa (loop dentro de `executePrompt`, reemplazando la llamada directa de L40)

- `maxAttempts` = `AI_MAX_ATTEMPTS` (default **3**: 1 inicial + 2 retries).
- Presupuesto global: `deadline = Date.now() + AI_TOTAL_BUDGET_MS` (default **80000**). Antes de cada intento y cada sleep se verifica que quepa en el presupuesto; si no, se corta y se lanza el último error.
- Backoff fijo corto: `1000ms * intento` (cap 4s), salvo 429 con header `Retry-After` (parsear segundos/fecha, clampeado al presupuesto restante).
- Solo se reintentan errores transitorios: network/timeout, HTTP 5xx, 429. Errores 4xx y de parseo/validación **no** se reintentan.
- Cada intento fallido: `logger.warn` con intento/max, causa, status y `durationMs` (integración con Fase D). El audit-log final se emite una sola vez con el desenlace.

---

## Variables de entorno nuevas

`.env` + sección 13 de `AGENTS.md`:

```
AI_DAILY_LIMIT=10
AI_CALL_TIMEOUT_MS=45000
AI_MAX_ATTEMPTS=3
AI_TOTAL_BUDGET_MS=80000
```

---

## Tests (Jest unitario, `npx jest --config jest.config.js <ruta>`)

| Spec | Casos clave |
|---|---|
| `gql-exception.filter.spec.ts` (nuevo) | 429 → `extensions.code = 'TOO_MANY_REQUESTS'`, `status: 429` |
| `ai-rate-limit.service.spec.ts` (nuevo) | upsert+$inc; supera límite → HttpException 429; E11000 primer intento → reintenta y éxito; E11000 dos veces → propaga mapeado |
| `ai.service.spec.ts` (update) | proveer mocks de `AiRateLimitService` y `AuditLogsService`; corta rate limit cuando viene `userId`; retry transitorio → 2do intento OK (`jest.useFakeTimers`); 400 → sin retry; presupuesto agotado → 1 solo intento; causas clasificadas en logs (spy de `Logger`) |
| `plan-generator.service.spec.ts` (update) | 2 llamadas concurrentes mismo comment → `executePrompt` 1 vez y mismo resultado; distinto comment en vuelo → `ConflictException`; tras fallo el lock se limpia (3ra llamada genera); IDs inválidos → 400 + log con causa |

Al final: suite completa (`npm test`) + `npm run lint`.

---

## Orden de ejecución

A (filtro) → B (rate limit) → C (lock) → D (logging) → E (retry/backoff, depende del clasificador de D) → tests/lint por fase.
