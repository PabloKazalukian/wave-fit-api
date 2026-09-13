# Auth Module - Authentication

> Part of the stable module documentation. Specs live under `sdd/`; this document describes the implemented system state.
> **Status:** Current
> **Last updated:** 2026-09-13

## Design principles

1. **Token invisibility**: the client never handles the JWT directly. This reduces the attack surface for malicious scripts (mitigates XSS).
2. **Multi-pillar strategy**: support for local credentials and external providers (Google).
3. **Server-centered persistence**: session validity is controlled by the backend through cookie expiration and JWT validation.

## Module architecture

The `AuthModule` centralizes the API security. Its main components are:

- **AuthResolver**: handles the GraphQL mutations `login` and `logout`, plus the `me` query.
- **AuthService**: contains the credential validation logic and the building of JWT payloads.
- **JwtStrategy**: Passport strategy to validate the token on each request. It is configured to extract the JWT from cookies.
- **GoogleModule**: specific integration for the OAuth2 flow with Google (login via `GoogleResolver.loginWithGoogle`).
- Guards: `GqlAuthGuard` (user JWT from cookie, with a `google-token` fallback) alongside the `ServiceAuthGuard` (service JWTs, used by the stats worker).

### JWT strategy

The API uses JSON Web Tokens signed with a secret defined in the environment variable `JWT_SECRET`.

**Token extraction:** the user JWT is **not** looked up in the `Authorization` header. `JwtStrategy` uses a custom extractor that reads the cookie `token`.

> **Nuance (Google fallback):** `GqlAuthGuard` registers the strategies `['jwt', 'google-token']`. The `jwt` strategy reads only the cookie; the `google-token` strategy additionally accepts a Google ID token via `Authorization: Bearer <id_token>` and resolves/creates the user from it. Only `/auth`-related flows and the Google token path use the header; the project's own JWTs are always cookie-based.

### Guards

`GqlAuthGuard` is used to protect the resolvers. It extends the Passport `AuthGuard` and adapts the GraphQL execution context so it is compatible with the Passport strategies (which originally expect standard Express requests).

## Token in HttpOnly cookie (NOT in header)

The JWT is transmitted in a `HttpOnly` cookie named `token`:

- **Do NOT** use the `Authorization: Bearer <token>` header for the project's own JWTs (only the Google-token fallback described above).
- The client **never** has access to the token (mitigates XSS).
- Token extraction from cookie is configured in `JwtStrategy`.

### Cookie attributes

| Attribute | Value | Description |
|---|---|---|
| **HttpOnly** | `true` | Prevents token access from JavaScript (mitigates XSS). |
| **Secure** | `prod: true` / `dev: false` | In production the cookie is only sent over HTTPS. |
| **SameSite** | `prod: 'none'` / `dev: 'lax'` | In production it allows secure cross-site requests (needed for Render). In development it avoids local CORS issues. |
| **Partitioned** | `prod: true` / `dev: false` | Partitioned cookie (CHIPS): isolated per top-level site. |
| **MaxAge** | 7 days | Cookie persistence on the client. **It does NOT define the JWT validity**: the token itself expires in `4h` (hardcoded `signOptions.expiresIn` in `auth.module.ts`), so a cookie older than 4h no longer authenticates; `JwtStrategy` rejects the token and `GqlAuthGuard` returns 401. |

The cookie is set/cleared dynamically according to `NODE_ENV`.

### Technical implementation

- `cookie-parser` is used in `main.ts` to enable cookie handling in NestJS.
- For the frontend to accept cookies, CORS must have `credentials: true`:

```typescript
// main.ts - the origins are hardcoded; FRONTEND_URL is NOT read here
app.enableCors({
  origin: [
    'https://wave-fit-front.onrender.com',
    'https://wave-fit.vercel.app',
    'http://localhost:4200',
  ],
  credentials: true,
});
```

- The GraphQL module (`AppModule`) includes the `res` (Response) object in the context so resolvers can manipulate cookies:

```typescript
context: ({ req, res }) => ({ req, res });
```

## Resolver protection pattern

Any functionality that requires an identified user must use the `@UseGuards(GqlAuthGuard)` decorator:

```typescript
@Resolver(() => User)
@UseGuards(GqlAuthGuard)
export class UserResolver {
  @Query(() => User)
  async me(@Context() context) {
    return context.req.user;
  }
}
```

### Validation flow

1. The client sends a request with the `token` cookie.
2. `GqlAuthGuard` intercepts the request.
3. `JwtStrategy` extracts and validates the token.
4. If valid, it attaches the `user` object to the request context (`req.user`), making it available in the resolvers.

## Login flows

### 1. Email/Password login

**Resolver:** `AuthResolver.login`

1. The resolver receives `identifier` (email or username) and `password`.
2. It calls `AuthService.validateUser`.
3. If the credentials are valid (verified with bcrypt), a JWT is generated.
4. **Response:**
   - Sets the `token` cookie on the HTTP response.
   - Returns `true` as the mutation result.

Local passwords are stored encrypted using **bcrypt**. Plain-text passwords are never stored or transmitted to the database.

### 2. Google login (OAuth2 PKCE) - `loginWithGoogle`

**Resolver:** `GoogleResolver.loginWithGoogle`

1. The frontend sends a `code` and a `codeVerifier`.
2. `GoogleService` exchanges these values for official Google tokens.
3. The user profile information is obtained from the Google APIs.
4. The system looks up the user by email in our database:
   - If it exists, the account is linked/updated (`googleId` set on creation).
   - If it does not exist, a new user is created with the Google information.
5. If the user has no avatar, the Google picture is downloaded and uploaded to Storage (`Avatars`, `StorageService.uploadFile`), storing `{ storageKey, url, source: 'google' }`.
6. A local Wave-Fit JWT is generated.
7. **Response:**
   - Sets the `token` cookie on the HTTP response.
   - Returns **both** `{ user, access_token }` (the token is included for compatibility; the cookie is the authoritative session).

### Logout

**Resolver:** `AuthResolver.logout`

To end the session, the server clears the `token` cookie via `clearCookie`, safely invalidating the session in the client browser. Returns `Boolean`.

## Environment variables

| Variable | Description |
|---|---|
| `JWT_SECRET` | Secret to sign the JWT (user and service JWTs). |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | Google OAuth redirect URI (used by `GoogleService.getTokens`) |

> **Not used (contrary to older docs):** `JWT_EXPIRATION` (the JWT duration is hardcoded `4h`) and `FRONTEND_URL` (the CORS origins are hardcoded in `main.ts`).

## Historical notes

Older documentation describing a Bearer-header/localStorage token flow (`src/modules/auth/Readme.md`) was removed as it contradicted the implemented HttpOnly-cookie flow. The authoritative behavior is described in this document and in the code (`JwtStrategy` custom cookie extractor).