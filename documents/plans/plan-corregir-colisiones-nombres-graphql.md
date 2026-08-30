# Plan: Corregir colisiones de nombres GraphQL en tracking

> Fecha: 2026-08-29
> Estado: ✅ IMPLEMENTADO

## Implementación (2026-08-29)

Se aplicó la convención acordada: **los métodos TypeScript quedan como están** (`findAll` / `findOne`), pero se cambió el **`name` override** de las operaciones GraphQL para eliminar la colisión. `removeExtraSession` (devuelve `Boolean`) se mantiene como excepción intencionada.

Resolvers tocados:
- `workout-session.resolver.ts` → `workoutSessionFindAll` / `workoutSessionFindOne`
- `extra-session.resolver.ts` → `extraSessionFindAll` / `extraSessionFindOne`
- `day-log.resolver.ts` → `dayLogFindAll` / `dayLogFindOne`

Verificación: `npm run build` ok · unit 59 suites / 584 tests ok · e2e 23 suites / 126 tests ok · `npm test` ok. Los e2e y specs existentes no referenciaban los nombres viejos (usaban las operaciones de week-log o los campos anidados `workoutSession`/`extraSession` del objeto `days[]`), por lo que no requirieron cambios.

---

## Contexto original (histórico)

## Problema

Varias operaciones de tracking exponen el **mismo nombre GraphQL** para operaciones distintas. En el schema generado por Apollo (`autoSchemaFile: true`), la segunda definición con el mismo nombre **oculta a la primera**, de modo que una de las dos operaciones queda inaccesible / impredecible para el cliente.

Las operaciones colisionadas (todas con `name` override explícito):

| Resolver | Operación findAll | Operación findOne | Conflicto |
|----------|-------------------|-------------------|-----------|
| `workout-session` | `workoutSession` | `workoutSession` | duplicado |
| `extra-session` | `extraSession` | `extraSession` | duplicado |
| `day-log` | `dayLog` | `dayLog` | duplicado |

Casos adicionales:

- `removeExtraSession` devuelve `Boolean` (a diferencia del resto de `remove*`, que devuelven la entidad): inconsistencia, no es una colisión de nombre. **Se mantiene como excepción intencionada.**

---

## Impacto / Consideraciones

- Es un **cambio breaking en la API GraphQL**: los clientes que llamen a `workoutSession`/`extraSession`/`dayLog` (sin argumento `id` para listar, o con `id` para un solo registro) deben actualizarse a los nombres nuevos.
- **Frontend Angular (otro repo):** localizar y migrar las llamadas GraphQL de tracking que usan esos nombres.
- No afecta a `week-log` (sus operaciones ya son únicas: `findAll`/`findOne` sin override, no colisionan).

## Notas de decisión

- **Convención de nombres elegida:** `<entidad>FindAll` / `<entidad>FindOne` (p. ej. `workoutSessionFindAll`). Se descartó la variante plural/`ById` (`workoutSessions` / `workoutSessionById`).
- **`removeExtraSession` → `Boolean`:** se mantiene como excepción intencionada (no se unifica a devolver la entidad).
