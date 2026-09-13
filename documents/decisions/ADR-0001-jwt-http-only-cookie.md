> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0001: JWT transported in an HttpOnly cookie `token`

## Context

The API authenticates requests with JSON Web Tokens. The common default is to send the JWT in an `Authorization: Bearer <token>` header, which forces the frontend to store the token somewhere script-accessible (memory or local storage) and re-attach it to every request. That storage is exposed to XSS: any injected script can read the token and impersonate the user.

## Decision

Transport the JWT in an **HttpOnly cookie named `token`** instead of an Authorization header:

- The client never has programmatic access to the token (`HttpOnly`); a script cannot read it, which mitigates XSS token theft.
- Extraction is configured in the Passport `JwtStrategy` through a custom extractor that reads the cookie, not the header.
- Resolvers that require a user are protected with `@UseGuards(GqlAuthGuard)`, which validates the token and attaches the user to `req.user`.
- The frontend must send cookies with credentials (CORS `credentials: true`), and the GraphQL module exposes `{ req, res }` in the context so resolvers can set/clear the cookie.

Cookie attributes are environment-dependent:

| Attribute | Development | Production |
|---|---|---|
| `HttpOnly` | `true` | `true` |
| `Secure` | `false` | `true` |
| `SameSite` | `'lax'` | `'none'` (cross-site requests, needed for Render) |
| `MaxAge` | 7 days | 7 days |

## Consequences

- **Positive:** session persistence is server-controlled; the token stays invisible to client scripts; the login flows (email/password and Google OAuth) both converge on the same cookie, so downstream code never sees credentials.
- **Negatives:** the cookie is sent automatically by the browser, so CSRF considerations apply (mitigated with `SameSite`); the frontend cannot read the token (e.g., for expiry checks) without the backend exposing status; tooling that only sends headers must be adapted to cookies.
- **Distinction:** service-to-service access (stats worker) does not use the user cookie; it authenticates with a service JWT (`role: SERVICE`) via `ServiceAuthGuard`.

## Status

Accepted