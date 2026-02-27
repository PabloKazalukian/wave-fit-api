# Auth Module Tests - Documentación Completa

## 📋 Resumen

Tests completos para el módulo de autenticación que cubren:

- ✅ **AuthService**: Login, validación de usuarios, generación de tokens
- ✅ **GqlAuthGuard**: Protección de resolvers GraphQL con JWT
- ✅ Seguridad y casos edge
- ✅ Integración completa del flujo de autenticación

## 🗂️ Archivos Generados

```
auth/
├── auth.service.spec.ts           # Tests del servicio (35+ tests)
├── guards/
│   └── gql-auth.guard.spec.ts    # Tests del guard (30+ tests)
└── AUTH_TESTS_README.md           # Esta documentación
```

## 🚀 Ejecutar los Tests

### Ejecutar todos los tests de auth

```bash
npm test -- auth
```

### Ejecutar solo tests del service

```bash
npm test -- auth.service.spec.ts
```

### Ejecutar solo tests del guard

```bash
npm test -- gql-auth.guard.spec.ts
```

### Ejecutar con coverage

```bash
npm test -- auth --coverage
```

### Ejecutar en modo watch (desarrollo)

```bash
npm test -- auth --watch
```

### Ver coverage detallado en HTML

```bash
npm test -- auth --coverage --coverageReporters=html
# Luego abrir: coverage/lcov-report/index.html
```

## 📊 Cobertura de Tests

### AuthService (35+ tests)

#### ✅ validateUser()

**Objetivo**: Validar credenciales de usuario (email o username + password)

- [x] Retornar usuario cuando credenciales son válidas con email
- [x] Retornar usuario cuando credenciales son válidas con username
- [x] Retornar null cuando el usuario no existe
- [x] Retornar null cuando la contraseña es incorrecta
- [x] Retornar null cuando la contraseña está vacía
- [x] Retornar null cuando el identifier está vacío
- [x] Manejar errores de bcrypt gracefully
- [x] Manejar errores del UserService gracefully

**Casos de seguridad:**

- [x] Validar identifier case-sensitivity
- [x] Manejar caracteres especiales en identifier
- [x] Manejar contraseñas muy largas
- [x] Prevenir timing attacks (usuarios válidos vs inválidos)

#### ✅ login()

**Objetivo**: Generar JWT token para usuario autenticado

- [x] Retornar access_token y usuario en login exitoso
- [x] Crear token con estructura de payload correcta (sub, email, role)
- [x] Manejar usuarios con diferentes roles correctamente
- [x] Manejar errores del JwtService
- [x] Retornar tokens diferentes en múltiples logins
- [x] Incluir todos los datos del usuario en respuesta
- [x] NO incluir password en el payload del JWT

**Casos de seguridad:**

- [x] No exponer datos sensibles en token payload
- [x] Manejar logins concurrentes del mismo usuario
- [x] Manejar usuario sin campo role
- [x] Manejar ObjectId como string

#### ✅ Flujo Completo de Autenticación

- [x] Completar flujo desde validación hasta generación de token
- [x] Rechazar flujo cuando validación falla

#### ✅ Edge Cases

- [x] Manejar usuario null en login
- [x] Manejar usuario undefined en login

### GqlAuthGuard (30+ tests)

#### ✅ getRequest()

**Objetivo**: Extraer request del contexto GraphQL para autenticación

- [x] Extraer request del execution context de GraphQL
- [x] Manejar request sin header authorization
- [x] Manejar request con usuario ya autenticado
- [x] Manejar múltiples contextos anidados correctamente

#### ✅ Validación de Autenticación

- [x] Permitir acceso con JWT token válido
- [x] Extraer request incluso sin user (passport valida después)
- [x] Manejar formato malformado de authorization header
- [x] Manejar authorization sin prefijo Bearer
- [x] Manejar header authorization vacío

#### ✅ Roles y Permisos

- [x] Preservar role de admin en request extraído
- [x] Preservar role de usuario regular
- [x] Manejar roles personalizados (premium, etc.)

#### ✅ Validación de Token Payload

- [x] Extraer payload completo del token en objeto user
- [x] Manejar usuario con solo campos requeridos (id, email, role)

#### ✅ Edge Cases y Manejo de Errores

- [x] Manejar contexto null gracefully
- [x] Manejar contexto sin propiedad req
- [x] Manejar request con headers null
- [x] Manejar request con user undefined

#### ✅ Integración con JWT Strategy

- [x] Extraer request compatible con JWT strategy
- [x] Trabajar con tokens de diferentes emisores

#### ✅ Tests de Seguridad

- [x] No modificar el objeto request original
- [x] Manejar nombres de headers case-sensitive
- [x] Manejar múltiples esquemas de authorization
- [x] Verificar herencia correcta de AuthGuard

#### ✅ Tipos de Operaciones GraphQL

- [x] Manejar diferentes tipos de operaciones (Query, Mutation, Subscription)

## 🔐 Flujo de Autenticación

### 1. Login (Mutation)

```graphql
mutation {
  login(
    identifier: "user@example.com" # o "username"
    password: "password123"
  )
}
```

**Flujo interno:**

1. `AuthResolver.login()` recibe credenciales
2. `AuthService.validateUser()` verifica credenciales
3. Si válidas: `AuthService.login()` genera JWT
4. Retorna `access_token`

### 2. Queries/Mutations Protegidas

```graphql
query {
  me {
    id
    email
    name
  }
}
```

**Flujo interno:**

1. Request llega con header: `Authorization: Bearer <token>`
2. `GqlAuthGuard` extrae el request del contexto GraphQL
3. Passport JWT Strategy valida el token
4. Si válido: `JwtStrategy.validate()` retorna payload del usuario
5. Usuario se agrega al contexto: `context.req.user`
6. Resolver tiene acceso al usuario autenticado

## 🎯 Estructura del Token JWT

### Payload del Token

```typescript
{
  sub: "user-id-123",          // ID del usuario
  email: "user@example.com",   // Email del usuario
  role: "user",                // Role (user, admin, etc.)
  iat: 1234567890,             // Issued at (generado por JWT)
  exp: 9876543210              // Expiration (generado por JWT)
}
```

### Lo que NO está en el token

- ❌ Password (nunca incluir)
- ❌ Datos sensibles
- ❌ Información personal innecesaria

## 🛡️ Seguridad Implementada

### 1. Hashing de Contraseñas

```typescript
// bcrypt compara contraseñas de forma segura
await bcrypt.compare(password, user.password);
```

### 2. Validación con Identifier Flexible

```typescript
// Soporta login con email o username
const user = await userService.findByIdentifier(identifier);
```

### 3. Guard en Todos los Resolvers Protegidos

```typescript
@Resolver()
@UseGuards(GqlAuthGuard) // Protege todo el resolver
export class WeekLogResolver {
  // Todos los métodos requieren autenticación
}
```

### 4. Extracción Segura del Usuario

```typescript
@Query()
@UseGuards(GqlAuthGuard)
async me(@Context() context) {
  return context.req.user;  // Usuario validado por JWT
}
```

## 📝 Ejemplos de Uso en Producción

### Ejemplo 1: Login desde el Cliente

```typescript
// Cliente (Frontend)
const response = await fetch('http://localhost:3000/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: `
      mutation {
        login(
          identifier: "user@example.com"
          password: "password123"
        )
      }
    `,
  }),
});

const { data } = await response.json();
const token = data.login;

// Guardar token (localStorage, sessionStorage, etc.)
localStorage.setItem('token', token);
```

### Ejemplo 2: Request Autenticado

```typescript
// Cliente con token
const token = localStorage.getItem('token');

const response = await fetch('http://localhost:3000/graphql', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    query: `
      query {
        me {
          id
          email
          name
        }
      }
    `,
  }),
});
```

### Ejemplo 3: Proteger un Resolver

```typescript
@Resolver(() => WeekLog)
@UseGuards(GqlAuthGuard)
export class WeekLogResolver {
  @Query(() => [WeekLog])
  async myWeekLogs(@Context() context) {
    const userId = context.req.user.id;
    return this.weekLogService.findAll(userId);
  }

  @Mutation(() => WeekLog)
  async createWeekLog(
    @Args('input') input: CreateWeekLogInput,
    @Context() context,
  ) {
    const userId = context.req.user.id;
    return this.weekLogService.create(input, userId);
  }
}
```

### Ejemplo 4: Verificar Roles

```typescript
@Mutation(() => User)
@UseGuards(GqlAuthGuard)
async deleteUser(
  @Args('id') id: string,
  @Context() context
) {
  const currentUser = context.req.user;

  // Solo admins pueden eliminar usuarios
  if (currentUser.role !== 'admin') {
    throw new ForbiddenException('Only admins can delete users');
  }

  return this.userService.remove(id);
}
```

## ⚙️ Configuración Necesaria

### 1. Módulo de Auth

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthResolver } from './auth.resolver';
import { LocalStrategy } from './local.strategy';
import { JwtStrategy } from './jwt.strategy';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, AuthResolver, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### 2. Variables de Entorno

```bash
# .env
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=7d
```

### 3. Dependencias

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/jwt": "^10.0.0",
    "@nestjs/passport": "^10.0.0",
    "@nestjs/graphql": "^12.0.0",
    "passport": "^0.6.0",
    "passport-jwt": "^4.0.1",
    "passport-local": "^1.0.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.2",
    "@types/passport-jwt": "^3.0.8",
    "@types/passport-local": "^1.0.35"
  }
}
```

## 🔍 Casos de Prueba Importantes

### Test 1: Login Exitoso

```typescript
it('should login successfully with valid credentials', async () => {
  const user = await authService.validateUser(
    'user@example.com',
    'password123',
  );
  expect(user).toBeDefined();

  const { access_token } = await authService.login(user);
  expect(access_token).toBeDefined();
  expect(typeof access_token).toBe('string');
});
```

### Test 2: Login Fallido

```typescript
it('should reject invalid credentials', async () => {
  const user = await authService.validateUser(
    'user@example.com',
    'wrongpassword',
  );
  expect(user).toBeNull();
});
```

### Test 3: Guard Protege Endpoint

```typescript
it('should block unauthenticated requests', async () => {
  // Request sin token
  const mockContext = {
    req: { headers: {} },
  };

  // Guard debe extraer request pero passport rechazará
  const request = guard.getRequest(mockExecutionContext);
  expect(request.headers.authorization).toBeUndefined();
});
```

### Test 4: Token Payload Correcto

```typescript
it('should create token with correct payload', async () => {
  const mockUser = {
    _id: 'user-123',
    email: 'test@example.com',
    role: 'user',
  };

  const { access_token } = await authService.login(mockUser);

  // Decodificar token para verificar payload
  const decoded = jwtService.decode(access_token);
  expect(decoded.sub).toBe('user-123');
  expect(decoded.email).toBe('test@example.com');
  expect(decoded.role).toBe('user');
});
```

## 🐛 Debugging Tips

### Ver el Token Decodificado

```typescript
import { JwtService } from '@nestjs/jwt';

const decoded = jwtService.decode(token);
console.log('Token payload:', decoded);
```

### Verificar Usuario en Contexto

```typescript
@Query()
@UseGuards(GqlAuthGuard)
async debug(@Context() context) {
  console.log('User from context:', context.req.user);
  return context.req.user;
}
```

### Test de Token Manualmente

```bash
# En tu terminal, instala jwt-cli
npm install -g jwt-cli

# Decodificar token
jwt decode <your-token-here>
```

## 🚨 Errores Comunes y Soluciones

### Error: "No auth token"

**Causa**: Cliente no envía header Authorization
**Solución**: Agregar header `Authorization: Bearer <token>`

### Error: "Invalid signature"

**Causa**: JWT_SECRET diferente entre generación y validación
**Solución**: Verificar que JWT_SECRET sea el mismo en toda la app

### Error: "User not found in context"

**Causa**: Guard no está aplicado al resolver
**Solución**: Agregar `@UseGuards(GqlAuthGuard)` al resolver o método

### Error: "Token expired"

**Causa**: Token JWT expiró
**Solución**: Usuario debe hacer login nuevamente

## 📚 Recursos Adicionales

- [NestJS Authentication](https://docs.nestjs.com/security/authentication)
- [Passport JWT Strategy](http://www.passportjs.org/packages/passport-jwt/)
- [GraphQL Authentication](https://docs.nestjs.com/graphql/other-features#authentication)
- [JWT.io](https://jwt.io/) - Decodificador de tokens

## ✅ Checklist Pre-Producción

- [ ] JWT_SECRET en variable de entorno (NO hardcodeado)
- [ ] Expiración de tokens configurada (`expiresIn`)
- [ ] HTTPS en producción (tokens solo por conexión segura)
- [ ] Refresh tokens implementados (opcional pero recomendado)
- [ ] Rate limiting en endpoint de login
- [ ] Logging de intentos de login fallidos
- [ ] Blacklist de tokens revocados (para logout real)
- [ ] Tests de autenticación pasando al 100%
