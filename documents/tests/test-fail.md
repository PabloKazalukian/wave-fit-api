# Tests E2E que Fallan - WeekLog

## Resumen

**Total de Tests:** 56  
**Pasados:** 52  
**Fallidos:** 4

**Archivos con problemas:**

- `test/e2e/week-log/find-one.spec.ts` (2 tests fallidos)
- `test/e2e/week-log/remove-week-log.spec.ts` (2 tests fallidos)

---

## 1. find-one.spec.ts

### Test 1: "should only allow user to access their own week-logs"

**Problema:**

```
TypeError: Cannot read properties of null (reading 'createWeekLog')
```

**Causa:** El usuario ya tiene un WeekLog activo de la función `completeActiveWeek()`. Al intentar crear otro, el sistema lanza `ConflictException: Already active week`.

**Solución sugerida:**

1. En el `beforeEach`, ya se llama a `completeActiveWeek()` pero el test también llama a `completeActiveWeek()` al inicio, lo cual puede generar conflicto.
2. Modificar el test para usar semanas diferentes o ajustar la lógica de completitud:

```typescript
// Opción 1: Usar semanas diferentes para cada usuario
const offset = Math.floor(Math.random() * 10);
const startOfWeek = new Date(today);
startOfWeek.setDate(today.getDate() - today.getDay() - offset * 7);

// Opción 2: Eliminar el WeekLog activo antes de crear uno nuevo
await request(app.getHttpServer())
  .post('/graphql')
  .set('Cookie', [authCookie])
  .send({
    query: `
      mutation {
        updateWeekLog(input: {
          id: "${activeWeekId}"
          completed: true
          active: false
        }) { id }
      }
    `,
  });
```

---

### Test 2: "should not return deleted week-logs"

**Problema:**

```
TypeError: Cannot read properties of null (reading 'createWeekLog')
```

**Causa:** Mismo problema que el test anterior - no se puede crear un WeekLog porque ya existe uno activo.

**Solución sugerida:**
Similar al test anterior, usar semanas diferentes o limpiar el WeekLog activo antes de crear uno nuevo.

---

## 2. remove-week-log.spec.ts

### Test 1: "should not return deleted week-log in findOne"

**Problema:**

```
expect(findResponse.body.errors).toBeDefined()
Received: undefined
```

El test espera un error al buscar un WeekLog eliminado, pero `findOne` retorna `undefined` en lugar de un error.

**Causa:** La verificación de soft delete puede no estar funcionando correctamente en el flujo de este test específico.

**Solución sugerida:**
Verificar que el WeekLog fue correctamente eliminado (soft delete) antes de hacer el findOne:

```typescript
// Verificar que fue eliminado
const verifyResponse = await request(app.getHttpServer())
  .post('/graphql')
  .set('Cookie', [authCookie])
  .send({
    query: `
      query {
        findOne(id: "${weekLogId}") {
          id
          deleted
        }
      }
    `,
  });

// El resultado debería ser error porque está eliminado
expect(verifyResponse.status).toBe(200);
expect(verifyResponse.body.errors).toBeDefined();
```

También revisar el método `findOne` en `week-log.service.ts` para asegurar que filtra correctamente los registros con `deleted: true`.

---

### Test 2: "should keep other week-logs intact when deleting one"

**Problema:**

```
expect(countBefore).toBe(2)
Received: 3
```

**Causa:** La función `completeActiveWeek()` puede estar dejando WeekLogs huérfanos o hay datos de tests anteriores que no se limpian correctamente.

**Solución sugerida:**

1. Asegurar que solo hay un WeekLog activo antes de crear nuevos:

```typescript
// Limpiar cualquier WeekLog activo antes de crear
const activeCheck = await request(app.getHttpServer())
  .post('/graphql')
  .set('Cookie', [authCookie])
  .send({
    query: `
      query {
        activeWeekLog {
          hasActiveWeek
          week { id }
        }
      }
    `,
  });

if (activeCheck.body.data.activeWeekLog.hasActiveWeek) {
  const activeId = activeCheck.body.data.activeWeekLog.week.id;
  await request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [authCookie])
    .send({
      query: `
        mutation {
          updateWeekLog(input: {
            id: "${activeId}"
            completed: true
            active: false
          }) { id }
        }
      `,
    });
}
```

2. Usar semanas con suficiente separación para evitar conflictos:

```typescript
function getWeekDates(
  baseDate: Date,
  weeksOffset: number,
): { start: string; end: string } {
  const date = new Date(baseDate);
  date.setDate(date.getDate() + weeksOffset * 7); // Usar semanas completas

  const startOfWeek = new Date(date);
  startOfWeek.setDate(date.getDate() - date.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  return {
    start: startOfWeek.toISOString().split('T')[0],
    end: endOfWeek.toISOString().split('T')[0],
  };
}
```

---

## Problema Común Identificado

La función auxiliar `completeActiveWeek()` que se usa en `beforeEach` no está siendo llamada consistentemente en todos los tests, o los WeekLogs creados no se están completando correctamente antes de intentar crear nuevos.

### Solución Global Recomendada

Crear una función helper más robusta en `test/e2e/helpers/week-log.helper.ts`:

```typescript
export async function createAndCompleteWeekLog(
  app: INestApplication<App>,
  cookie: string,
  weekOffset: number = 0,
) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay() - weekOffset * 7);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // 1. Verificar si hay un WeekLog activo
  const activeCheck = await request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie])
    .send({
      query: `
        query {
          activeWeekLog {
            hasActiveWeek
            week { id }
          }
        }
      `,
    });

  // 2. Si existe, completarlo
  if (activeCheck.body.data?.activeWeekLog?.hasActiveWeek) {
    const activeId = activeCheck.body.data.activeWeekLog.week.id;
    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', [cookie])
      .send({
        query: `
          mutation {
            updateWeekLog(input: {
              id: "${activeId}"
              completed: true
              active: false
            }) { id }
          }
        `,
      });
  }

  // 3. Crear nuevo WeekLog
  const createResponse = await request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie])
    .send({
      query: `
        mutation {
          createWeekLog(createWeekLogInput: {
            startDate: "${startOfWeek.toISOString().split('T')[0]}"
            endDate: "${endOfWeek.toISOString().split('T')[0]}"
            timezone: "America/Argentina/Buenos_Aires"
          }) { id }
        }
      `,
    });

  const weekLogId = createResponse.body.data.createWeekLog.id;

  // 4. Completar el nuevo WeekLog
  await request(app.getHttpServer())
    .post('/graphql')
    .set('Cookie', [cookie])
    .send({
      query: `
        mutation {
          updateWeekLog(input: {
            id: "${weekLogId}"
            completed: true
            active: false
          }) { id }
        }
      `,
    });

  return weekLogId;
}
```

---

## Archivos Modificados

| Archivo                 | Tests Totales | Pasados | Fallidos |
| ----------------------- | ------------- | ------- | -------- |
| find-one.spec.ts        | 5             | 3       | 2        |
| find-all.spec.ts        | 6             | 6       | 0        |
| remove-week-log.spec.ts | 6             | 4       | 2        |
| **Total**               | **17**        | **13**  | **4**    |

---

## Fecha de Generación

2026-05-11
