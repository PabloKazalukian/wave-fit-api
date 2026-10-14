/**
 * Database connection target.
 *
 * `AppModule` resolves the connection through `buildMongoUri()` instead of
 * inlining a URI, so the application can be pointed at an isolated database —
 * a local container, a performance run, a second environment — without editing
 * source. `docker-compose.yml` and `MONGO_URL` are documented in
 * `documents/engineering/local-environments.md`.
 *
 * See `sdd/mongo-connection-config.spec.md`. The rules this file must keep:
 *   - `BR-001` the default is byte-identical to the URI it replaced.
 *   - `BR-002` no password lives here; it is read from the environment.
 *   - `BR-005` a blank `MONGO_URL` is a missing `MONGO_URL`.
 */

/** Credential and host of the shared Atlas cluster, used when `MONGO_URL` is unset. */
const ATLAS_USER = 'kazalukianpablo_db_user';
const ATLAS_HOST = 'wavefit.ofapyei.mongodb.net';

/**
 * The trailing space in `ATLAS_HOST + '/' + ' '` is **preserved on purpose**.
 *
 * The literal this function replaces ended with a space, and `BR-001` requires
 * byte-identity, so the space is carried across exactly. Whether the driver
 * trims it is a separate question from how this repository is configured, and
 * answering it belongs in its own change rather than inside a commit whose
 * claim is that behavior did not move. Once the URI lives here and a test locks
 * it, that question can be answered against a real connection safely.
 */
const ATLAS_URI_TARGET = `${ATLAS_HOST}/ `;

/**
 * Resolves the connection URI.
 *
 * `MONGO_URL` wins whenever it holds a non-empty value; otherwise the Atlas URI
 * is assembled from `DB_MONGO_PASSWORD` exactly as it was assembled inline in
 * `AppModule`.
 *
 * `env` is a parameter rather than a direct read of `process.env` so the
 * resolution is testable without mutating global state, and so the password is
 * read when the URI is built instead of when this module is first imported.
 *
 * @param env Environment to resolve from. Defaults to `process.env`.
 * @returns The connection URI, without credentials committed to the source.
 */
export function buildMongoUri(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.MONGO_URL?.trim();

  // `BR-005`: whitespace-only is treated as absent. Forwarding it would reach
  // the driver as an empty connection string and fail at boot with an error
  // that names neither the variable nor the fallback.
  if (explicit) return explicit;

  // Interpolated verbatim, with no empty-string fallback: a missing
  // `DB_MONGO_PASSWORD` yields `:undefined@` and a driver authentication
  // error, which is what the previous inline literal did. Quietly turning it
  // into an empty password would be a behavior change hidden behind a
  // configuration refactor.
  return `mongodb+srv://${ATLAS_USER}:${env.DB_MONGO_PASSWORD}@${ATLAS_URI_TARGET}`;
}
