<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" alt="WaveFit API Logo" width="120" />
</p>

<h1 align="center">🏋️ WaveFit API</h1>

<p align="center">
  <strong>Backend para tu compañero de entrenamiento personal.</strong><br/>
  API GraphQL para gestionar ejercicios, rutinas y seguimiento de entrenamiento.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-11-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" />
  <img src="https://img.shields.io/badge/GraphQL-Apollo-E10098?style=for-the-badge&logo=graphql&logoColor=white" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
</p>

<p align="center">
  <a href="https://wave-fit.vercel.app/">🌐 Ver Demo Frontend</a> •
  <a href="https://github.com/PabloKazalukian/wave-fit">🔗 Repositorio Frontend</a>
</p>

---

## ✨ Funcionalidades

### Disponibles

- 📋 **Gestión de ejercicios** — CRUD completo del catálogo de ejercicios
- 🗓️ **Planificación de rutinas** — RoutinePlan → RoutineDay → Exercises
- 💪 **Seguimiento de entrenamiento** — WorkoutSession, WeekLog, ExtraSession
- 🔐 **Autenticación segura** — JWT (cookie HttpOnly) + Google OAuth (PKCE)
- 📝 **Auditoría de cambios** — Registro automático de modificaciones en la DB

### Próximamente

- 📈 **Estadísticas avanzadas** — Endpoints para analíticas de rendimiento
- 🔄 **WebSockets** — Actualizaciones en tiempo real

---

## 🛠️ Stack Tecnológico

| Categoría     | Tecnología         |
| ------------- | ------------------ |
| **Framework** | NestJS 11          |
| **API**       | GraphQL (Apollo)   |
| **Database**  | MongoDB (Mongoose) |
| **Auth**      | Passport + JWT     |
| **OAuth**     | Google (PKCE)      |
| **Testing**   | Jest               |
| **Deploy**    | Render             |

> 🔗 **Frontend:** Angular 20 + TailwindCSS + Apollo — [Ver repositorio](https://github.com/PabloKazalukian/wave-fit) | [Demo en producción](https://wave-fit.vercel.app/)

---

## 🚀 Instalación

### Pre-requisitos

- Node.js (v18+)
- MongoDB (local o Atlas)
- npm

### Setup

```bash
# Clonar el repositorio
git clone https://github.com/PabloKazalukian/wave-fit-api.git
cd wave-fit-api

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# Compilar TypeScript
npm run build

# Correr en modo desarrollo
npm run start:dev
```

La API está disponible en `http://localhost:3000/`

---

## 📂 Estructura del Proyecto

```
src/
├── app.module.ts              # Módulo raíz
├── main.ts                    # Entry point
├── common/                    # Filters, interceptors, guards
├── modules/
│   ├── auth/                  # JWT + Google OAuth
│   │   ├── guards/
│   │   ├── google/
│   │   ├── auth.service.ts
│   │   ├── auth.resolver.ts
│   │   └── jwt.strategy.ts
│   ├── user/                  # Gestión de usuarios
│   ├── routines/
│   │   ├── templates/
│   │   │   ├── exercise/      # Catálogo de ejercicios
│   │   │   ├── routine-day/  # Días de rutina
│   │   │   └── routine-plan/ # Planes semanales
│   │   └── tracking/
│   │       ├── workout-session/
│   │       ├── week-log/
│   │       └── extra-session/
│   └── audit-logs/           # Registro de cambios
└── documents/
    └── config/                # Documentación técnica
```

---

## 📡 GraphQL Playground

En desarrollo, podés acceder al Playground en:

```
http://localhost:3000/graphql
```

### Ejemplo de Query

```graphql
query {
  me {
    id
    email
    name
  }
}
```

### Ejemplo de Mutation (Login)

```graphql
mutation {
  login(identifier: "user@example.com", password: "password123")
}
```

---

## 📖 Documentación

La documentación técnica se encuentra en [`/documents`](./documents/config/):

- [Flujos de login](./documents/config/login_flows.md) — Email/password y Google OAuth
- [Configuración de cookies](./documents/config/cookie_configuration.md) — HttpOnly, Secure, SameSite
- [Autenticación](./documents/config/authentication.md) — Principios y diseño
- [Módulo Auth](./documents/config/auth_module.md) — Arquitectura detallada

---

## 🧪 Tests

```bash
# Tests unitarios
npm test

# Tests con coverage
npm run test:cov

# Tests e2e
npm run test:e2e

# Modo watch
npm run test:watch
```

---

## 👤 Autor

**[Pablo Kazalukian](https://github.com/PabloKazalukian)**

> 🔗 [Repositorio Frontend](https://github.com/PabloKazalukian/wave-fit)
