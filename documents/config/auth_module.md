# Módulo de Autenticación (AuthModule)

Este documento describe la arquitectura y configuración del sistema de autenticación en el backend de Wave-Fit.

## Estructura del Módulo

El `AuthModule` es el encargado de centralizar la seguridad de la API. Sus componentes principales son:

- **AuthResolver**: Maneja las mutaciones de GraphQL para `login` y `logout`, además de la query `me`.
- **AuthService**: Contiene la lógica de validación de credenciales y generación de payloads para JWT.
- **JwtStrategy**: Estrategia de Passport para validar el token en cada petición. Está configurada para extraer el JWT de las cookies.
- **GoogleModule**: Integración específica para el flujo OAuth2 con Google.

## Configuración de Seguridad

### Estrategia JWT

La API utiliza JSON Web Tokens firmados con un secreto definido en las variables de entorno (`JWT_SECRET`).

**Extracción del Token:**
El sistema ya no busca el token en el header `Authorization`. En su lugar, utiliza un extractor personalizado que busca la cookie `token`.

### Guards

Se utiliza el `GqlAuthGuard` para proteger los resolvers. Este guard extiende el `AuthGuard` de Passport y adapta el contexto de ejecución de GraphQL para que sea compatible con las estrategias de Passport (que originalmente esperan peticiones Express estándar).

## Flujo de Validación

1. El cliente envía una petición con la cookie `token`.
2. El `GqlAuthGuard` intercepta la petición.
3. `JwtStrategy` extrae y valida el token.
4. Si es válido, adjunta el objeto `user` al contexto de la petición (`req.user`), permitiendo su acceso en los resolvers.
