# Procesos de Login

Documento técnico sobre los flujos de inicio de sesión soportados por Wave-Fit.

## 1. Login Tradicional (Email/Password)

**Resolver:** `AuthResolver.login`

1. El resolver recibe `identifier` (email o username) y `password`.
2. Llama a `AuthService.validateUser`.
3. Si las credenciales son válidas (verificadas con bcrypt), se genera un JWT.
4. **Respuesta:**
   - Se establece la cookie `token` en la respuesta HTTP.
   - Retorna `true` como resultado de la mutación.

## 2. Login con Google (OAuth2)

**Resolver:** `GoogleResolver.loginWithGoogle`

Este flujo permite a los usuarios autenticarse usando sus cuentas de Google.

1. El frontend envía un `code` y un `codeVerifier`.
2. `GoogleService` intercambia estos valores por tokens oficiales de Google.
3. Se obtiene la información del perfil del usuario desde Google APIs.
4. El sistema busca al usuario por email en nuestra base de datos:
   - Si existe, se vincula/actualiza.
   - Si no existe, se crea un nuevo usuario con la información de Google.
5. Se genera un JWT local de Wave-Fit.
6. **Respuesta:**
   - Se establece la cookie `token` en la respuesta HTTP.
   - Retorna el objeto `user` y (opcionalmente) el `access_token` para compatibilidad.

## Logout

**Resolver:** `AuthResolver.logout`

Para cerrar la sesión, el servidor limpia la cookie `token` mediante la instrucción `clearCookie`, invalidando la sesión en el navegador del cliente de forma segura.
