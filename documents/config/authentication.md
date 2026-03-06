# Documentación General de Autenticación

Este documento proporciona una visión general de los principios y métodos de autenticación implementados en Wave-Fit API.

## Principios de Diseño

1. **Invisibilidad del Token**: El cliente nunca maneja el JWT directamente. Esto reduce la superficie de ataque para scripts maliciosos.
2. **Estrategia Multi-pilar**: Soporte para credenciales locales y proveedores externos (Google).
3. **Persistencia Centrada en el Servidor**: La validez de la sesión es controlada por el backend mediante la expiración de cookies y la validación de JWT.

## Métodos de Autenticación

### 1. JWT (JSON Web Tokens)

El estándar principal para la comunicación entre el frontend y el backend. Cada petición autenticada debe incluir el JWT en la cookie `token`.

### 2. OAuth2 (Google)

Integración con Google para facilitar el registro y login de usuarios, mejorando la tasa de conversión y eliminando la fricción de recordar contraseñas.

## Protección de Rutas (Resolvers)

Cualquier funcionalidad que requiera un usuario identificado debe usar el decorador `@UseGuards(GqlAuthGuard)`.

```typescript
@Query(() => User)
@UseGuards(GqlAuthGuard)
async me(@Context() context) {
  return context.req.user;
}
```

## Seguridad de Contraseñas

Las contraseñas locales se almacenan cifradas utilizando **bcrypt**. Nunca se guardan ni se transmiten contraseñas en texto plano hacia la base de datos.
