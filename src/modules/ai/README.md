# AI Module — Capa transversal de acceso al LLM

> Este módulo es una **capa transversal** (no un dominio): expone el único punto de llamada al LLM (`AiService.executePrompt`), rate limit por usuario, reintentos con presupuesto y auditoría. Lo consumen módulos de generación como `training-plan`. La documentación de generación de planes vive en `src/modules/training-plan/README.md` y `documents/config/ai.md`.

## Rol

`AiService.executePrompt()` es el **único punto de llamada al LLM** del proyecto. Orquesta:

1. **Rate limit** por usuario (fixed window diario UTC) antes de invocar el modelo.
2. Resolución del **proveedor** desde el registry `'AI_PROVIDERS'` (patrón estrategia).
3. Armado de mensajes LangChain (`SystemMessage` + `HumanMessage`).
4. **Reintentos** de errores transitorios con backoff y **presupuesto global** de tiempo.
5. **Auditoría** (`AI_PROMPT_EXECUTED`) y logging de causa/duration/tokens.

```ts
const { rawContent, modelUsed, promptUsed, tokensUsed } =
  await aiService.executePrompt({
    providerName: 'groq',
    systemPrompt,
    userPrompt,
    userId, // opcional: si se pasa, aplica rate limit por usuario
  });
```

## Proveedores (`AI_PROVIDERS`)

- Interfaz `IAiProvider { name: string; getModel(): BaseChatModel }` en `interfaces/ai-proider.interface.ts`.
- Registro vía token `'AI_PROVIDERS'` (un `Map<name, provider>`) construido en `ai.module.ts` (patrón estrategia; exportado para los consumidores).
- Hoy solo existe **`GroqProvider`** (`name = 'groq'`):
  - Modelo: `openai/gpt-oss-120b`
  - `temperature: 0`, `reasoningEffort: 'low'`
  - `maxTokens` desde `AI_MAX_OUTPUT_TOKENS` (default 5000)
  - `timeout` desde `AI_CALL_TIMEOUT_MS` (default 45000)
  - `maxRetries: 0` — **la única capa de reintentos vive en `AiService`** (no en el SDK).
  - Añadir un provider nuevo = implementar `IAiProvider`, registrarlo en `ai.module.ts`.

## Rate limit

- Colección `ai_usage` (`schemas/ai-usage.schema.ts`): `userId`, `windowStart`, `count`.
  - Índice único `{ userId, windowStart }` → **una ventana por usuario y día**.
  - Índice **TTL** en `windowStart` (2 días) → purga automática.
- `AiRateLimitService.assertWithinLimit(userId)`:
  - `findOneAndUpdate({ upsert: true, $inc: { count: 1 } })` **atómico**.
  - Ante `E11000` (carrera del primer insert) reintenta una vez.
  - Si `count > limit` → `HttpException 429` con `code: RATE_LIMIT_EXCEEDED`, `limit` y `resetAt`.
- Límite: `AI_DAILY_LIMIT` (default 10).
- Exposición **sin** modificar contador: `AiResolver.aiUsageStatus` → `AiUsageStatusOutput { used, limit, remaining, resetAt }`.

## Reintentos (retry/backoff)

- **Solo errores transitorios** se reintentan (`transient: true`): network (`E*`/`UND_ERR`), timeout (`ETIMEDOUT`/`ECONNABORTED`/msg timeout), 5xx, `429`, y **respuesta vacía** (`AI_EMPTY_RESPONSE`, incluye modelos de razonamiento que agotan tokens).
- `AI_MAX_ATTEMPTS` intentos (default 3) dentro de un **presupuesto global** `AI_TOTAL_BUDGET_MS` (default 80000) compartido entre intentos + backoffs. Si el presupuesto no alcanza, se abandona.
- Backoff: `min(1000 * attempt, 4000) ms`; respeta `Retry-After` (header o mensaje "try again in Xs/ms") en `429`.
- `maxRetries: 0` en el proveedor → la transparencia total del retry está en `AiService`.

## Taxonomía de errores y auditoría

`AI_CAUSE` (`ai-error-causes.ts`): `AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON` (usado por parser de training-plan), `AI_EMPTY_RESPONSE`, `AI_UNKNOWN_EXERCISE_NAME` (usado por materializer), `RATE_LIMIT_EXCEEDED`.

Cada llamada registra audit `AI_PROMPT_EXECUTED` (`success: true|false`) con metadata: `provider`, `modelUsed`, `durationMs`, `tokensUsed` (+ `cause`/`httpStatus`/`attempts` en fallos).

## Configuración (env)

| Variable | Default | Descripción |
|---|---|---|
| `GROQ_API_KEY` | — | API key de Groq |
| `PREFERRED_AI_PROVIDER` | `groq` | Proveedor usado por `training-plan` |
| `AI_DAILY_LIMIT` | `10` | Máx. llamadas IA por usuario/día UTC |
| `AI_CALL_TIMEOUT_MS` | `45000` | Timeout por intento del cliente ChatGroq |
| `AI_MAX_ATTEMPTS` | `3` | Intentos totales ante fallos transitorios |
| `AI_TOTAL_BUDGET_MS` | `80000` | Presupuesto global compartido entre intentos |
| `AI_MAX_OUTPUT_TOKENS` | `5000` | Presupuesto de tokens de salida (evita content vacío) |

## Cómo consumir `AiService` desde un módulo nuevo

1. Importar `AiModule` (exporta `AiService` y `AiRateLimitService`).
2. Inyectar `AiService`.
3. Construir `systemPrompt` y `userPrompt` (LangChain messages).
4. Llamar `executePrompt({ providerName, systemPrompt, userPrompt, userId })`.
5. Devuelve `{ rawContent, modelUsed, promptUsed, tokensUsed }`; manejar los `AI_CAUSE` según corresponda (p.ej. parsear con un parser propio y lanzar `AI_MALFORMED_JSON` si el JSON no es válido).

> Detalle de uso en generación de planes: `src/modules/training-plan/README.md` y `documents/config/ai.md`.
