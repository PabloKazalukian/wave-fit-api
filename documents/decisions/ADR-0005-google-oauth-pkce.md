> **Status:** Current
> **Last updated:** 2026-09-12

# ADR-0005: Google OAuth with PKCE

## Context

Registering with a password is friction that lowers conversion, so the product adds Google login as a second path. The client is a public SPA: it cannot keep a confidential `client_secret`, and the previous implicit-flow style of exchanging tokens in the browser exposes the flow to interception. The login must also be consistent with the existing session model (ADR-0001): after Google authenticates the user, the API issues its own JWT in the HttpOnly `token` cookie.

## Decision

Implement Google OAuth with the **PKCE** (Proof Key for Code Exchange) flow:

1. The frontend initiates the Google flow and sends a `code` plus the `codeVerifier` to `loginWithGoogle(code, codeVerifier)`.
2. `GoogleService` exchanges `code` + `codeVerifier` with Google for tokens and fetches the user profile.
3. The user is looked up by email: existing users are linked/updated, new users are created from the Google profile.
4. The API issues a local WaveFit JWT and sets the same HttpOnly `token` cookie used by email/password login, returning the `user` object (and the `access_token` for compatibility).

PKCE ties the authorization code to the verifier held by the initiating client, removing the need to store a client secret in the SPA.

## Consequences

- **Positive:** a second, low-friction login path; the security posture does not depend on hiding a secret in the frontend; after login, Google credentials never touch the application storage — only the local HttpOnly cookie exists.
- **Negatives:** the flow needs a `codeVerifier` round-trip managed by the frontend; two login paths must be kept coherent (same cookie, same `GqlAuthGuard` validation); the API depends on Google's token endpoint and profile API at login time.

## Status

Accepted