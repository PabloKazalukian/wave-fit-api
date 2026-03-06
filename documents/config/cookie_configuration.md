# Configuración de Cookies y Sesión

Wave-Fit utiliza cookies `HttpOnly` para gestionar la persistencia de la autenticación de forma segura.

## Atributos de la Cookie `token`

Las cookies se configuran dinámicamente según el entorno (`NODE_ENV`):

| Atributo     | Valor                         | Descripción                                                                                                                 |
| :----------- | :---------------------------- | :-------------------------------------------------------------------------------------------------------------------------- |
| **HttpOnly** | `true`                        | Impide el acceso al token desde JavaScript (Mitiga XSS).                                                                    |
| **Secure**   | `prod: true` / `dev: false`   | En producción, la cookie solo se envía sobre HTTPS.                                                                         |
| **SameSite** | `prod: 'none'` / `dev: 'lax'` | En producción permite peticiones cross-site seguras (necesario para Render). En desarrollo evita problemas de CORS locales. |
| **MaxAge**   | 7 días                        | Duración de la sesión antes de expirar.                                                                                     |

## Implementación Técnica

### Middleware

Se utiliza `cookie-parser` en `main.ts` para habilitar el manejo de cookies en NestJS.

### CORS

Para que las cookies sean aceptadas desde el frontend, la configuración de CORS en el backend debe tener `credentials: true`:

```typescript
app.enableCors({
  origin: [process.env.FRONTEND_URL, 'http://localhost:4200'],
  credentials: true,
});
```

### Configuración en GraphQL

El módulo de GraphQL (`AppModule`) incluye el objeto `res` (Response) en el contexto para permitir que los resolvers manipulen las cookies:

```typescript
context: ({ req, res }) => ({ req, res });
```
