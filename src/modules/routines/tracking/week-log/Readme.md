# Week-Log Tests - Documentación

## 📋 Resumen

Tests completos para el módulo `week-log` que validan:

- ✅ Creación, lectura, actualización y eliminación de WeekLogs
- ✅ Autenticación y autorización de usuarios
- ✅ Validación de permisos (usuarios solo pueden acceder a sus propios datos)
- ✅ Validación de inputs y DTOs
- ✅ Queries especiales: WeekLog activo y WorkoutSession actual
- ✅ Manejo de errores y casos edge

## 🗂️ Archivos Generados

```
week-log/
├── week-log.service.spec.ts        # Tests del servicio (19 tests)
├── week-log.resolver.spec.ts       # Tests del resolver (28 tests)
├── week-log.service.ts             # Implementación del servicio
├── week-log.resolver.ts            # Implementación del resolver
└── dto/
    ├── create-week-log.input.ts    # DTO para crear WeekLog
    └── update-week-log.input.ts    # DTO para actualizar WeekLog
```

## 🚀 Ejecutar los Tests

### Ejecutar todos los tests de week-log

```bash
npm test -- week-log
```

### Ejecutar solo tests del service

```bash
npm test -- week-log.service.spec.ts
```

### Ejecutar solo tests del resolver

```bash
npm test -- week-log.resolver.spec.ts
```

### Ejecutar con coverage

```bash
npm test -- week-log --coverage
```

### Ejecutar en modo watch

```bash
npm test -- week-log --watch
```

## 📊 Cobertura de Tests

### WeekLogService (19 tests)

#### ✅ create()

- [x] Crear WeekLog para usuario autenticado
- [x] Validar campos requeridos
- [x] Validar rango de fechas (endDate > startDate)
- [x] Crear WeekLog sin campos opcionales

#### ✅ findAll()

- [x] Retornar todos los WeekLogs del usuario
- [x] Retornar array vacío si no hay WeekLogs
- [x] Solo retornar WeekLogs del usuario autenticado

#### ✅ findOne()

- [x] Retornar WeekLog por ID
- [x] NotFoundException si no existe
- [x] ForbiddenException si pertenece a otro usuario

#### ✅ findActiveWeekLog()

- [x] Retornar WeekLog activo (completed: false)
- [x] Retornar null si no hay WeekLog activo
- [x] Retornar el más reciente si hay múltiples activos

#### ✅ update()

- [x] Actualizar WeekLog del usuario autenticado
- [x] NotFoundException si no existe
- [x] ForbiddenException si pertenece a otro usuario
- [x] Permitir actualizaciones parciales

#### ✅ remove()

- [x] Eliminar WeekLog del usuario autenticado
- [x] NotFoundException si no existe
- [x] ForbiddenException si pertenece a otro usuario

#### ✅ getCurrentWorkoutSession()

- [x] Retornar WorkoutSession del día actual
- [x] Retornar null si no hay workout hoy
- [x] Retornar null si no hay WeekLog activo

### WeekLogResolver (28 tests)

#### ✅ Authentication & Authorization

- [x] Requerir autenticación para todas las operaciones
- [x] Extraer usuario del contexto GraphQL

#### ✅ createWeekLog()

- [x] Crear WeekLog para usuario autenticado
- [x] Validar CreateWeekLogInput
- [x] Rechazar rango de fechas inválido
- [x] Requerir autenticación

#### ✅ findAllWeekLogs()

- [x] Retornar todos los WeekLogs del usuario
- [x] Retornar array vacío si no hay WeekLogs
- [x] Solo retornar WeekLogs del usuario autenticado
- [x] Requerir autenticación

#### ✅ findOneWeekLog()

- [x] Retornar WeekLog por ID
- [x] Error si no existe
- [x] Error si pertenece a otro usuario
- [x] Requerir autenticación

#### ✅ findActiveWeekLog()

- [x] Retornar WeekLog activo
- [x] Retornar null si no hay activo
- [x] Requerir autenticación

#### ✅ getCurrentWorkoutSession()

- [x] Retornar WorkoutSession actual
- [x] Retornar null si no hay workout hoy
- [x] Requerir autenticación

#### ✅ updateWeekLog()

- [x] Actualizar WeekLog
- [x] Error si no existe
- [x] Error si pertenece a otro usuario
- [x] Permitir actualizaciones parciales
- [x] Requerir autenticación

#### ✅ removeWeekLog()

- [x] Eliminar WeekLog
- [x] Error si no existe
- [x] Error si pertenece a otro usuario
- [x] Requerir autenticación

#### ✅ GraphQL Context

- [x] Extraer usuario correctamente
- [x] Manejar contexto sin usuario

#### ✅ Input Validation

- [x] Validar CreateWeekLogInput DTO
- [x] Validar UpdateWeekLogInput DTO

#### ✅ Error Handling

- [x] Manejar errores de base de datos
- [x] Manejar errores de validación

## 🔒 Seguridad Implementada

### 1. Autenticación Obligatoria

Todos los endpoints requieren que el usuario esté autenticado mediante el `GqlAuthGuard`.

### 2. Autorización por Usuario

- Usuarios solo pueden ver sus propios WeekLogs
- Usuarios solo pueden modificar sus propios WeekLogs
- Usuarios solo pueden eliminar sus propios WeekLogs

### 3. Validación de Permisos

El servicio verifica en cada operación que:

```typescript
if (weekLog.userId.toString() !== userId) {
  throw new ForbiddenException('You do not have permission...');
}
```

## 🎯 Queries GraphQL Disponibles

### Crear WeekLog

```graphql
mutation {
  createWeekLog(
    createWeekLogInput: {
      startDate: "2024-01-01"
      endDate: "2024-01-07"
      planId: "plan-id-123"
      notes: "Mi primera semana"
    }
  ) {
    id
    userId
    startDate
    endDate
    notes
    completed
  }
}
```

### Listar mis WeekLogs

```graphql
query {
  weekLogs {
    id
    startDate
    endDate
    completed
    workouts {
      date
      exercises {
        exerciseId
        reps
        weights
      }
    }
  }
}
```

### Obtener WeekLog activo

```graphql
query {
  activeWeekLog {
    id
    startDate
    endDate
    workouts {
      date
      notes
    }
  }
}
```

### Obtener WorkoutSession actual (de hoy)

```graphql
query {
  currentWorkoutSession {
    date
    routineDayId
    exercises {
      exerciseId
      reps
      weights
      notes
    }
    notes
  }
}
```

### Actualizar WeekLog

```graphql
mutation {
  updateWeekLog(
    updateWeekLogInput: {
      id: "week-log-id"
      notes: "Notas actualizadas"
      completed: true
    }
  ) {
    id
    notes
    completed
  }
}
```

### Eliminar WeekLog

```graphql
mutation {
  removeWeekLog(id: "week-log-id") {
    id
  }
}
```

## ⚙️ Configuración Necesaria

### 1. Guard de Autenticación

Asegúrate de tener un `GqlAuthGuard` en tu proyecto:

```typescript
// auth/guards/gql-auth.guard.ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }
}
```

### 2. Módulo Week-Log

```typescript
// week-log.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeekLogService } from './week-log.service';
import { WeekLogResolver } from './week-log.resolver';
import { WeekLog, WeekLogSchema } from './schema/week-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WeekLog.name, schema: WeekLogSchema }]),
  ],
  providers: [WeekLogResolver, WeekLogService],
  exports: [WeekLogService],
})
export class WeekLogModule {}
```

### 3. Dependencias

Asegúrate de tener instaladas:

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/graphql": "^12.0.0",
    "@nestjs/mongoose": "^10.0.0",
    "mongoose": "^8.0.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0"
  },
  "devDependencies": {
    "@nestjs/testing": "^10.0.0",
    "jest": "^29.0.0"
  }
}
```

## 🔍 Validaciones Implementadas

### CreateWeekLogInput

- `startDate`: Date (requerido)
- `endDate`: Date (requerido, debe ser > startDate)
- `planId`: String (opcional)
- `notes`: String (opcional)
- `completed`: Boolean (opcional, default: false)

### UpdateWeekLogInput

- `id`: String (requerido)
- Todos los demás campos son opcionales (hereda de CreateWeekLogInput)

## 🐛 Casos Edge Cubiertos

1. ✅ Usuario intenta acceder a WeekLog de otro usuario
2. ✅ Usuario intenta actualizar WeekLog de otro usuario
3. ✅ Usuario intenta eliminar WeekLog de otro usuario
4. ✅ WeekLog no existe (NotFoundException)
5. ✅ Rango de fechas inválido (endDate <= startDate)
6. ✅ Usuario no autenticado intenta cualquier operación
7. ✅ No hay WeekLog activo (retorna null)
8. ✅ No hay WorkoutSession para hoy (retorna null)
9. ✅ Usuario sin WeekLogs (retorna array vacío)
10. ✅ Actualizaciones parciales de WeekLog

## 📝 Próximos Pasos

Para completar la funcionalidad de workout-session:

1. Implementar `workout-session.service.ts` con lógica similar
2. Implementar `workout-session.resolver.ts` con guards
3. Crear tests para workout-session
4. Integrar WorkoutSession con WeekLog (agregar/actualizar workouts en un WeekLog)
5. Implementar extra-session de manera similar

## 💡 Tips para Desarrollo

### Ejecutar tests mientras desarrollas

```bash
npm test -- week-log --watch --verbose
```

### Ver coverage detallado

```bash
npm test -- week-log --coverage --coverageReporters=html
# Luego abrir: coverage/lcov-report/index.html
```

### Debug de tests

```typescript
// Agregar en el test:
console.log('DEBUG:', JSON.stringify(result, null, 2));
```

## 📚 Referencias

- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [GraphQL Testing](https://docs.nestjs.com/graphql/quick-start)
- [Mongoose Testing](https://mongoosejs.com/docs/jest.html)
- [Jest Documentation](https://jestjs.io/docs/getting-started)

---
