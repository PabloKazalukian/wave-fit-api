# Plan: DLQ para Stats usando Audit-Logs

**Fecha:** 2026-09-04
**Estado:** Pendiente
**Módulos afectados:** `stats`, `audit-logs`

---

## 1. Problema Actual

El `StatsEventPublisher` envía eventos a AWS SQS cuando un usuario completa un workout o finaliza un week-log. Si SQS falla:

- El error se loguea con `Logger.error()` pero **se pierde el evento silenciosamente**
- No hay registro persistente de la falla
- No hay forma de re procesar eventos fallidos
- No hay alertas para errores críticos

```typescript
// Código actual en stats-event-publisher.ts (línea 97-101)
} catch (error) {
  this.logger.error(`[publishToSQS] Error al enviar mensaje a SQS: ${error.message}`, error.stack);
  // El evento se pierde aquí - no hay DLQ ni persistencia
}
```

---

## 2. Solución Propuesta

Usar el módulo `audit-logs` como **Dead Letter Queue (DLQ) persistente**:

```
SQS falla → AuditLogsService.logAsync() → MongoDB (audit_logs collection)
```

### 2.1 Beneficios

| Beneficio | Descripción |
|-----------|-------------|
| **Persistencia** | Los errores se guardan en MongoDB, no se pierden |
| **Queryable** | Se pueden consultar vía GraphQL (`auditLogs` query) |
| **Zero costo** | Ya existe la infraestructura (schema, service, tests) |
| **Fire-and-forget** | `logAsync()` no bloquea el request original |
| **Auditoría** | Cumple con el patrón de auditoría del proyecto |
| **Extensible** | Futuros workers pueden procesar estos logs |

### 2.2 Arquitectura Resultante

```
Usuario completa workout
    ↓
StatsEventPublisher intenta enviar a SQS
    ↓
┌─────────────────────────────────────────┐
│  SI SQS falla:                          │
│    → auditLogsService.logAsync({        │
│        action: 'SQS_PUBLISH_FAILED',    │
│        entity: 'StatsEventPublisher',   │
│        success: false,                  │
│        errorMessage: error.message,     │
│        metadata: { triggerType, ... }   │
│      })                                 │
├─────────────────────────────────────────┤
│  SI SQS éxito (opcional):               │
│    → auditLogsService.logAsync({        │
│        action: 'SQS_PUBLISH_SUCCESS',   │
│        entity: 'StatsEventPublisher',   │
│        success: true,                   │
│        metadata: { triggerType, ... }   │
│      })                                 │
└─────────────────────────────────────────┘
    ↓
Request original SIEMPRE exitosa
```

---

## 3. Archivos a Modificar

### 3.1 `src/modules/stats/stats-event-publisher.ts`

**Cambios:**

1. Inyectar `AuditLogsService` en el constructor
2. Importar `AuditLogsModule` en `stats.module.ts`
3. Agregar logging de éxito en SQS publish
4. Agregar logging de fallo en SQS publish

**Estructura del log de error:**

```typescript
{
  action: 'SQS_PUBLISH_FAILED',
  entity: 'StatsEventPublisher',
  userId: Types.ObjectId,           // del evento original
  success: false,
  errorMessage: error.message,
  metadata: {
    triggerType: 'workout-session.saved' | 'week-log.finalized',
    entityId: string,                // workoutSessionId o weekLogId
    queueUrl: string,                // STATS_SQS_QUEUE_URL
    stack: error.stack,              // stack trace completo
    timestamp: number,               // Date.now() del evento original
  },
  timestamp: new Date(),
}
```

**Estructura del log de éxito (opcional):**

```typescript
{
  action: 'SQS_PUBLISH_SUCCESS',
  entity: 'StatsEventPublisher',
  userId: Types.ObjectId,
  success: true,
  metadata: {
    triggerType: 'workout-session.saved' | 'week-log.finalized',
    entityId: string,
    queueUrl: string,
    messageId: string,               // ID de SQS si está disponible
  },
  timestamp: new Date(),
}
```

### 3.2 `src/modules/stats/stats.module.ts`

**Cambios:**

- Agregar `AuditLogsModule` en los `imports`

---

## 4. Implementación Detallada

### 4.1 StatsEventPublisher - Código Modificado

```typescript
// stats-event-publisher.ts
import { AuditLogsService } from '../audit-logs/audit-logs.service';

@Injectable()
export class StatsEventPublisher implements OnModuleInit {
  private readonly logger = new Logger(StatsEventPublisher.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLogsService: AuditLogsService,  // NUEVO
  ) {}

  // ... onModuleInit igual ...

  private async publishToSQS(payload: {
    userId: string;
    triggerType: string;
    entityId: string;
  }): Promise<void> {
    const queueUrl = process.env.STATS_SQS_QUEUE_URL;

    if (!queueUrl) {
      this.logger.warn('[publishToSQS] STATS_SQS_QUEUE_URL no configurado. Evento ignorado.');
      return;
    }

    try {
      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          userId: payload.userId,
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          timestamp: new Date().toISOString(),
        }),
        MessageGroupId: `stats-${payload.userId}`,  // CAMBIO: por usuario, no grupo único
        MessageDeduplicationId: `${payload.userId}-${payload.triggerType}-${Date.now()}`,
      });

      const result = await this.sqsClient.send(command);

      // LOG DE ÉXITO (opcional)
      this.auditLogsService.logAsync({
        action: 'SQS_PUBLISH_SUCCESS',
        entity: 'StatsEventPublisher',
        userId: new Types.ObjectId(payload.userId),
        success: true,
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl,
          messageId: result.MessageId,
        },
      });

      this.logger.log(`[publishToSQS] Evento enviado: ${payload.triggerType} para usuario ${payload.userId}`);

    } catch (error) {
      // LOG DE FALLO - DLQ via AuditLogs
      this.auditLogsService.logAsync({
        action: 'SQS_PUBLISH_FAILED',
        entity: 'StatsEventPublisher',
        userId: new Types.ObjectId(payload.userId),
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          triggerType: payload.triggerType,
          entityId: payload.entityId,
          queueUrl,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        },
      });

      this.logger.error(
        `[publishToSQS] Error al enviar mensaje a SQS: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
```

### 4.2 StatsModule - Imports

```typescript
// stats.module.ts
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    // ... existing imports ...
    AuditLogsModule,  // NUEVO
  ],
  // ...
})
export class StatsModule {}
```

---

## 5. Cambios Adicionales Recomendados

### 5.1 MessageGroupId por Usuario

**Problema actual:** `MessageGroupId: 'workout-session-group'` serializa TODOS los usuarios.

**Solución:** Cambiar a `MessageGroupId: \`stats-${userId}\`` para paralelismo real.

### 5.2 DeduplicationId Mejorado

**Problema actual:** `${Date.now()}-${Math.random()}` nunca colisiona, deshabilitando dedup real.

**Solución:** `${userId}-${triggerType}-${entityId}` para deduplicar eventos idénticos.

---

## 6. Testing

### 6.1 Unit Tests para StatsEventPublisher

Crear `src/modules/stats/stats-event-publisher.spec.ts`:

```typescript
describe('StatsEventPublisher', () => {
  // Test: SQS exitoso → logAsync con success: true
  // Test: SQS falla → logAsync con success: false
  // Test: SQS no configurado → warn y return temprano
  // Test: publishToSQS recibe payload correcto
});
```

### 6.2 Verificación Manual

1. Configurar `STATS_SQS_QUEUE_URL` con una cola inválida
2. Completar un workout
3. Verificar que se crea un audit log con `action: 'SQS_PUBLISH_FAILED'`
4. Consultar vía GraphQL: `auditLogs({ action: 'SQS_PUBLISH_FAILED' })`

---

## 7. Plan de Email Alerts (Futuro)

### 7.1 Opción Simple: Cron Job

```typescript
// using @nestjs/schedule
@Cron('0 8 * * *')  // Diario a las 8am
async checkCriticalErrors() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const errors = await this.auditLogsService.findAll({
    action: 'SQS_PUBLISH_FAILED',
    success: false,
    startDate: yesterday,
  });

  if (errors.length > 0) {
    await this.sendAlertEmail(errors);
  }
}
```

### 7.2 Opción Real-Time: Event Pattern

```typescript
@OnEvent('audit-log.created')
handleAuditLog(payload: { action: string; success: boolean }) {
  if (payload.action === 'SQS_PUBLISH_FAILED' && !payload.success) {
    this.sendImmediateAlert(payload);
  }
}
```

### 7.3 Opción AWS: SNS

```
Audit Log created → MongoDB Change Stream → Lambda → SNS → Email
```

---

## 8. Checklist de Implementación

- [ ] Inyectar `AuditLogsService` en `StatsEventPublisher`
- [ ] Agregar `AuditLogsModule` a `StatsModule` imports
- [ ] Agregar log de éxito en `publishToSQS`
- [ ] Agregar log de fallo en `publishToSQS`
- [ ] Corregir `MessageGroupId` por usuario
- [ ] Corregir `MessageDeduplicationId` para dedup real
- [ ] Crear tests unitarios para `StatsEventPublisher`
- [ ] Verificar variables de entorno (`AWS_ACCESS_KEY` vs `AWS_ACCESS_KEY_ID`)
- [ ] Documentar en `src/modules/stats/README.md`
- [ ] (Opcional) Implementar cron job para email alerts

---

## 9. Referencias

- **Audit Logs Module:** `src/modules/audit-logs/audit-logs.service.ts`
- **Stats Event Publisher:** `src/modules/stats/stats-event-publisher.ts`
- **SQS Publisher Pattern:** AWS SDK `@aws-sdk/client-sqs`
- **Testing Guide:** `documents/config/testing.md`

---

## 10. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| `logAsync()` falla al guardar error | Baja | Bajo | Ya tiene catch interno con `Logger.error()` |
| Performance impact por logs adicionales | Baja | Bajo | `logAsync()` es fire-and-forget, no bloquea |
| Audit logs collection crece mucho | Media | Bajo | TTL index o archival policy futura |
| SQS sigue fallando sin detectar | Media | Alto | Email alerts en fase 2 |

---

**Próximos pasos:** Marcar este plan como "en progreso" y comenzar la implementación siguiendo el checklist.
