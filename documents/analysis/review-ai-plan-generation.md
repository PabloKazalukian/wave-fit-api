# Review: Módulos AI, Training-Plan, User-Profile y Week-Log

> **Fecha:** 2026-08-21
> **Alcance:** `src/modules/ai`, `src/modules/training-plan`, `src/modules/user/user-profile`, `src/modules/routines/tracking/week-log`
> **Criterio:** Todo lo descripto fue verificado contra el código real. Nada es asumido.

> ## ✅ Estado 2026-08-29 (actualización posterior a la implementación)
>
> Este documento es un **histórico trazable** de la revisión original. Todos los puntos fueron abordados en la implementación posterior. La **fuente vigente** es:
> - Generación de planes: `src/modules/training-plan/README.md`
> - Capa transversal de IA (rate limit, retry): `src/modules/ai/README.md`
> - Config general: `documents/config/ai.md`
>
> Resumen del estado real por punto: **ver tabla del Resumen ejecutivo abajo.**

## Flujo actual de generación (contexto)

```
TrainingPlanResolver.generatePlan (comment)
  → TrainingPlanService.generate(userId, comment)          [training-plan.service.ts:113]
    → PlanGeneratorService.generatePlan(userId, comment)   [plan-generator.service.ts:64]
        1. planValidator.validate(userId)                  — completitud del perfil
        2. userProfileService.getFullProfileContext(userId)
        3. goalModel.create(...)                           — snapshot de objetivo (ANTES de la IA)
        4. exerciseService.findAll()                       — catálogo para el prompt
        5. buildPlanPrompts(aiContext, exercises, comment)
        6. aiService.executePrompt({ providerName: 'groq', ... })
        7. parser.parse(rawContent)                        — validación estructural
        8. buildWeekLogFromPlan(...)                       — WeekLogDomain + sessions EN MEMORIA
    ← GeneratePlanResult
  → trainingPlanModel.create({ ..., aiSnapshot })          — solo persiste el TrainingPlan
```

**Observación importante (verificada):** el `WeekLogDomain` y las `sessions` que construye el generador **nunca se persisten** en este flujo — `training-plan.service.ts:119` solo usa `result.weekLog.startDate`. El WeekLog real se crea por separado vía `createWeekLog` (`create-week-log.use-case.ts`), que arma las sesiones desde un `RoutinePlan` (template), no desde la salida de la IA.

---

## Resumen ejecutivo

| # | Punto | Estado original (2026-08-21) | Estado real 2026-08-29 |
|---|-------|------------------------------|------------------------|
| 1 | Idempotencia en generación | ❌ No implementado | ✅ Resuelto: `generating` (userId+comment) en `TrainingPlanService` + `inFlight` (userId) en `PlanGeneratorService` |
| 2 | Validación en modificación de plan | ⚠️ Parcial | ⚠️ Parcial: el materializer valida/descarta nombres contra el catálogo real; sigue pendiente `@Max` de longitud en `comment` |
| 3 | Logging de causa de fallo | ⚠️ Parcial | ✅ Resuelto: Loggers + audit + contenido crudo truncado (500 chars) en JSON inválido |
| 4 | Rate limit por usuario | ❌ No implementado | ✅ Resuelto: `AiUsage` + `AiRateLimitService` (fixed window UTC, upsert atómico, 429) |
| 5 | Flag de origen AI vs MANUAL | ❌ No implementado | ✅ Resuelto por diseño: ruta manual **eliminada**; `TrainingPlan` es solo-IA (`aiSnapshot` requerido). `RoutinePlan` mantiene `isAiGenerated` |
| 6 | Manejo de fallos de Groq (retry/backoff/timeout) | ❌ No implementado | ✅ Resuelto: loop externo con presupuesto global + `maxRetries:0` en el SDK |

---

## 1. Idempotencia en generación de Plan-Training

- **Estado actual:** ❌ No implementado
- **Ubicación en código:** No encontrado. La cadena completa `generatePlan` → `generate()` → `generatePlan()` no contiene ningún lock, mutex, registro de requests en vuelo, constraint única ni deduplicación. Un grep por `lock|mutex|inFlight|generating` sobre `src/` no arroja resultados en estos módulos. El único control existente es el guard de UI en el front.
- **Riesgo si no se resuelve:**
  - Doble llamada a Groq por reintento de red / doble tab / reaparición de la app en background → doble costo de tokens y latencia duplicada.
  - Efecto secundario verificado: cada ejecución crea un documento `Goal` **antes** de llamar a la IA (`plan-generator.service.ts:83-87`). Dos requests concurrentes = dos Goals huérfanos + dos TrainingPlans duplicados en estado `draft`.
- **Propuesta:**
  - Lock **en memoria por instancia** en `PlanGeneratorService` (la app hoy es single-instance; no requiere Redis):

    ```ts
    // plan-generator.service.ts
    private readonly inFlight = new Map<string, Promise<GeneratePlanResult>>();

    async generatePlan(userId: string, comment = ''): Promise<GeneratePlanResult> {
      const existing = this.inFlight.get(userId);
      if (existing) return existing; // segunda llamada espera el mismo resultado

      const task = this.doGenerate(userId, comment).finally(() =>
        this.inFlight.delete(userId),
      );
      this.inFlight.set(userId, task);
      return task;
    }
    ```

    Devolver la misma promesa convierte la carrera en idempotente: ambas peticiones reciben el mismo plan y se llama a Groq una sola vez.
  - Si a futuro hay múltiples instancias, reemplazar por lock en Mongo: colección `generation_locks` con índice único `{ userId: 1 }` + `expiresAt` (TTL), adquirida con `findOneAndUpdate` + upsert. Mismo punto de corte, sin cambiar interfaces.
  - Complemento barato: mover `goalModel.create()` a **después** de que la IA respondió y el parseo fue exitoso, para no dejar snapshots huérfanos cuando algo falla a mitad del flujo.

---

## 2. Validación de la modificación sobre plan ya creado

- **Estado actual:** ⚠️ Parcial
- **Ubicación en código:**
  - No existe un endpoint/mutation separado de "modificar plan". La modificación con comentario reutiliza **exactamente el mismo camino**: `generatePlan(comment)` → `buildPlanPrompts(..., comment)` (`plan-generator.prompt.ts:180-183`), donde el comentario se agrega al final del user prompt.
  - `planValidator.validate(userId)` (`plan-validator.service.ts:16`) corre en **todas** las invocaciones, incluida la modificación → las reglas de creación sí aplican también acá (misma función).
  - **Pero** esas reglas son solo de *completitud del perfil* (birthDate, heightCm, weightKg, goal, schedule). La validación de la **salida** de la IA (`plan-generator.parser.ts:47-67`) es puramente estructural: 7 días, `order` numérico, `isRest` booleano, `exerciseId` presente. Verificado que **no existe**:
    - validación de que los `exerciseId` devueltos por la IA existan en el catálogo (`buildWeekLogFromPlan` mapea `e.exerciseId` directo, sin chequear contra `exerciseService.findAll()`);
    - validación de límites de negocio sobre el output (días/semana vs. schedule del usuario, duración de sesión, volumen);
    - límite de longitud ni sanitización del `comment` (el arg GraphQL no tiene `@MaxLength`).
- **Riesgo si no se resuelve:** la IA puede devolver IDs inexistentes → sesiones con referencias rotas (mismo problema que ya motivó los scripts `check-exercise-refs` / `fix-exercise-refs`). Un comentario malicioso o muy largo puede desviar el plan sin ningún control server-side.
- **Propuesta:**
  - Extraer la validación de negocio del output a un método de `PlanValidatorService` (p. ej. `validateParsedPlan(parsed, exercises)`), invocado en `generatePlan` **después** de `parser.parse()` y antes de `buildWeekLogFromPlan`. Al estar en el único camino de generación, cubre creación y modificación por igual:

    ```ts
    const parsedPlan = this.parser.parse(rawContent);
    const catalogCheck = this.planValidator.validateExerciseIds(
      parsedPlan,
      exercisesForAI,
    );
    if (!catalogCheck.valid) {
      // log diferenciado (ver punto 3) con los IDs inválidos
      throw new BadRequestException('AI response contains unknown exercise IDs');
    }
    ```
  - Agregar `@Max(500)` (o similar) al arg `comment` en el resolver y recortarlo en `buildPlanPrompts`.

---

## 3. Logging de causa de fallo

- **Estado actual:** ⚠️ Parcial
- **Ubicación en código:**
  - Lo único que loguea es el filtro global `GraphQLExceptionFilter` (`src/common/filters/gql-exception.filter.ts:17-20`): registra `fieldName` + stack de cualquier excepción. Los `BadRequestException` del parser tienen mensajes descriptivos ("AI response missing days array"), así que esos stacks sí llegan al log.
  - **No existe logging propio ni diferenciado en** `AiService` ni `PlanGeneratorService` (ninguna de las dos clases tiene `Logger`). Consecuencias verificadas:
    - Si `JSON.parse(rawContent)` falla (`plan-generator.service.ts:123` y `plan-generator.parser.ts:33`), se loguea el stack del SyntaxError pero **no el contenido crudo** que devolvió la IA → imposible diagnosticar JSON malformado post-mortem.
    - Errores de Groq/LangChain (timeout, 429, caída) burbujean como error genérico sin clasificación de causa.
    - No hay registro de duración de la llamada ni tokens consumidos por request (el `console.log` de tokenUsage está comentado en `ai.service.ts:49`).
- **Riesgo si no se resuelve:** ante un "falló" reportado por un usuario, no hay forma de distinguir si fue IA caída, JSON truncado o IDs inventados; el debugging depende de reproducir el issue.
- **Propuesta:**
  - Agregar `private readonly logger = new Logger(AiService.name)` y loguear en `executePrompt`: provider, duración (`Date.now()` antes/después), `tokensUsed`, y en catch clasificar el error (timeout vs HTTP status vs desconocido) antes de re-lanzar.
  - En `PlanGeneratorParser.parse`, envolver `JSON.parse` en try/catch y loguear `rawContent` truncado (primeros ~500 chars) con `Logger.error` antes de lanzar.
  - En el chequeo de `exerciseId` propuesto en el punto 2, loguear la lista de IDs inválidos recibidos.
  - Taxonomía mínima de causas para filtrar en logs: `AI_PROVIDER_ERROR`, `AI_MALFORMED_JSON`, `AI_UNKNOWN_EXERCISE_ID`, `PLAN_VALIDATION_FAILED`, `RATE_LIMIT_EXCEEDED`.

---

## 4. Rate limit de generaciones por usuario

- **Estado actual:** ❌ No implementado
- **Ubicación en código:** No encontrado. No hay `@nestjs/throttler` en `package.json`, ni Redis, ni ninguna colección/tabla de uso. `AiService.executePrompt` (`ai.service.ts:17`) es el único punto de llamada a Groq y hoy no tiene control previo. Consumidor actual: solo `PlanGeneratorService` (verificado por grep).
- **Riesgo si no se resuelve:** un usuario (o un script) puede disparar generaciones ilimitadas → costo directo en tokens/cuota de Groq y riesgo de agotar la API key para todos los usuarios.
- **Propuesta:** fixed window counter en el **módulo AI**, con Mongo (que ya es la única dependencia de estado del proyecto), siguiendo el patrón clásico del módulo (service + schema, como `ai.service.ts` / `groq.provider.ts`):
  1. **Schema** `src/modules/ai/schema/ai-usage.schema.ts`:

     ```ts
     @Schema({ timestamps: true })
     export class AiUsage extends Document {
       @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
       @Prop({ required: true }) windowStart: Date; // inicio del día UTC
       @Prop({ type: Number, default: 0 }) count: number;
     }
     // Índice único: garantiza un doc por usuario/ventana y hace el upsert atómico
     AiUsageSchema.index({ userId: 1, windowStart: 1 }, { unique: true });
     ```
  2. **Servicio** `src/modules/ai/ai-rate-limit.service.ts`: método `assertWithinLimit(userId)` que calcula `windowStart` (inicio del día UTC), hace `findOneAndUpdate({ userId, windowStart }, { $inc: { count: 1 } }, { upsert: true, new: true })` y lanza `new HttpException('AI generation limit exceeded', 429)` si `count > limit`. Límite desde env (`AI_DAILY_LIMIT`, default sugerido: 10).
  3. **Punto de corte:** al inicio de `AiService.executePrompt`, agregando `userId` a las opciones:

     ```ts
     async executePrompt(options: { userId: string; providerName: string; ... }) {
       await this.rateLimit.assertWithinLimit(options.userId); // ANTES de model.invoke
       ...
     }
     ```

     Al vivir en `AiService`, cubre automáticamente a todo consumidor futuro del módulo AI (requisito planteado). `PlanGeneratorService.generatePlan` ya tiene `userId` a mano para pasarlo (:105).
  4. **Ajustes menores derivados:**
     - Registrar `MongooseModule.forFeature([{ name: AiUsage.name, schema: AiUsageSchema }])` en `AiModule` y exportar `AiRateLimitService`.
     - Agregar `429: 'RATE_LIMITED'` al mapa `getHttpErrorCode` del exception filter (`gql-exception.filter.ts:162-173`), porque hoy un 429 caería en `INTERNAL_SERVER_ERROR`.
     - Por el orden actual del flujo, el corte en `executePrompt` ocurre **después** de crear el `Goal`; mover esa creación después de la respuesta exitosa de la IA evita consumir cuota y dejar documentos huérfanos (mismo ajuste que el punto 1).

---

## 5. Flag de origen en Plan-Training (AI vs MANUAL)

- **Estado actual:** ❌ No implementado
- **Ubicación en código:** `training-plan.schema.ts` no tiene ningún campo `source`/`origin`/`createdBy`. Dato colateral verificado: `aiSnapshot` es `required: true` (:92) y `TrainingPlanService.create()` (ruta manual, :24-42) **no setea** `aiSnapshot` → hoy la creación manual fallaría en la validación de Mongoose. Es decir, el schema actual asume que todo plan es de IA.
- **Riesgo si no se resuelve:** imposible distinguir planes generados de manuales para métricas (módulo Stats), UI, o políticas futuras (ej. regenerar solo planes de IA); y la rama manual está efectivamente rota por el snapshot requerido.
- **Propuesta:**
  - Enum y campo con default, en `training-plan.schema.ts`:

    ```ts
    export enum PlanSource {
      AI = 'ai',
      MANUAL = 'manual',
    }

    @Prop({ enum: PlanSource, default: PlanSource.AI })
    source: PlanSource;
    ```
  - **Compatibilidad con datos existentes:** Mongoose aplica defaults al hidratar documentos que no tienen el campo, así que todos los planes actuales leerán `source: 'ai'` sin migración. Opcionalmente, backfill explícito siguiendo el patrón ya existente en `src/database/migrations/00X-...migration.ts` (hay 3 ejemplos con su comando npm asociado).
  - Relajar `aiSnapshot` para planes manuales: `@Prop({ type: AiSnapshotSchema, required: false })` o validar condicionalmente según `source` (pre-save hook), y reflejar el campo en `training-plan.entity.ts` (GraphQL) y en `CreateTrainingPlanInput` (default `'manual'` en `create()`, `'ai'` en `generate()`).

---

## 6. Manejo de fallos de Groq (timeout, 429, caída)

- **Estado actual:** ❌ No implementado
- **Ubicación en código:** `groq.provider.ts:12-18` instancia `ChatGroq` solo con `model`, `apiKey` y `temperature` — sin `timeout`, sin `maxRetries`, sin configuración de reintento visible. `AiService.executePrompt` hace un único `await model.invoke(messages)` (`ai.service.ts:40`) sin try/catch, sin reintentos y sin timeout propio. Grep de `retry|backoff|429` en `src/`: cero resultados en código (solo una mención en un doc de stats).
- **Riesgo si no se resuelve:** un 429 transitorio o un blip de red convierte la generación en un error para el usuario aunque un reintento inmediato lo hubiera resuelto; y sin timeout explícito, una llamada colgada mantiene la mutación abierta indefinidamente mientras el usuario espera en pantalla.
- **Propuesta:** mecanismo acotado, coherente con un flujo síncrono:
  1. **Configuración explícita del cliente** en `GroqProvider` (el SDK subyacente de LangChain expone estas opciones):

     ```ts
     this.model = new ChatGroq({
       model: 'llama-3.3-70b-versatile',
       apiKey: process.env.GROQ_API_KEY,
       temperature: 0,
       timeout: 45_000,   // techo duro por intento
       maxRetries: 2,     // reintento interno del SDK ante errores transitorios
     });
     ```
  2. **Reintento externo mínimo en `AiService`** (una sola capa, no anidada): máximo 2 intentos totales con backoff corto fijo (~1s), solo para errores transitorios (network/timeout/HTTP 5xx/429). Ante 429 conviene respetar `Retry-After` si viene; ante error de validación/parseo **no** reintentar (no es transitorio). Presupuesto total acotado: ~90s peor caso, aceptable para una pantalla de "generando...".
  3. Integrarse con el logging del punto 3: cada intento fallido se loguea con su causa antes del siguiente, y el error final expone al cliente un mensaje genérico ("no se pudo generar el plan, intentá de nuevo") manteniendo el detalle en logs.

---

## Notas adicionales encontradas durante la revisión

1. **Resultado de generación parcialmente descartado:** `GeneratePlanResult.weekLog` y `.sessions` no se persisten en `generate()` (solo se usa `startDate`). Si la intención es que la IA genere la semana real de tracking, falta conectar ese output con `weekLogRepository.create` + `workoutSessionService.insertMany` (hoy `createWeekLog` arma sesiones desde un `RoutinePlan` template, no desde la IA).
2. **`Goal` creado antes de la IA:** relevante para los puntos 1 y 4 (documentos huérfanos ante fallo o rate-limit).
3. **`console.log`/`console.error` sueltos** en `create-week-log.use-case.ts:69-82` y `week-log.service.ts:180` — candidatos a migrar a `Logger` junto con el punto 3.
