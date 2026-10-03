import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { buildMongoUri } from './mongo.config';

/**
 * `TEST-001` — how the connection target is resolved.
 * `TEST-002` — that `AppModule` actually uses it.
 * `TEST-003` — the isolated local Mongo's contract.
 * `TEST-004` — that the variable is documented.
 *
 * Everything here is a pure function call or a static read of a repository file:
 * no connection is opened, no database is needed and `docker` is never invoked
 * (`NFR-001`). The suite passes offline on a machine without a container runtime.
 */

const REPO_ROOT = join(__dirname, '..', '..');

/**
 * The connection this repository used before the URI was configurable, recorded
 * as the contract the default must reproduce.
 *
 * `TRAILING_SPACE` is written as an escape rather than typed inline because a
 * trailing space in a template literal is invisible in review and in diffs,
 * which is exactly why it survived. See the Spec's "The trailing space" section:
 * the space is preserved on purpose, not overlooked.
 */
const ATLAS_HOST = 'wavefit.ofapyei.mongodb.net';
const ATLAS_USER = 'kazalukianpablo_db_user';
const TRAILING_SPACE = ' ';

const LOCAL_URI = 'mongodb://localhost:27017/wavefit-perf';

function expectedAtlasUri(password: string): string {
  return `mongodb+srv://${ATLAS_USER}:${password}@${ATLAS_HOST}/${TRAILING_SPACE}`;
}

describe('buildMongoUri (TEST-001, FR-001)', () => {
  it('uses MONGO_URL when it is set', () => {
    expect(buildMongoUri({ MONGO_URL: LOCAL_URI })).toBe(LOCAL_URI);
  });

  it('trims surrounding whitespace from MONGO_URL', () => {
    expect(buildMongoUri({ MONGO_URL: `  ${LOCAL_URI}\n` })).toBe(LOCAL_URI);
  });

  it('prefers MONGO_URL over DB_MONGO_PASSWORD', () => {
    // The explicit target wins outright: a developer pointing the app at an
    // isolated database must not be silently repointed by an inherited password.
    expect(
      buildMongoUri({ MONGO_URL: LOCAL_URI, DB_MONGO_PASSWORD: 'irrelevant' }),
    ).toBe(LOCAL_URI);
  });

  it('builds the Atlas default from DB_MONGO_PASSWORD', () => {
    const password = 's3cret-from-the-environment';
    expect(buildMongoUri({ DB_MONGO_PASSWORD: password })).toBe(
      expectedAtlasUri(password),
    );
  });

  it('reproduces the previous hardcoded URI byte for byte', () => {
    // `BR-001`. The assertion that makes this Spec's central promise checkable:
    // with MONGO_URL unset the application connects to exactly where it
    // connected before. A dropped space, a reordered credential or an added
    // database name all fail here, and none of them is visible at runtime.
    expect(buildMongoUri({ DB_MONGO_PASSWORD: 'pw' })).toBe(
      'mongodb+srv://kazalukianpablo_db_user:pw@wavefit.ofapyei.mongodb.net/ ',
    );
    expect(expectedAtlasUri('pw')).toHaveLength(
      'mongodb+srv://kazalukianpablo_db_user:pw@wavefit.ofapyei.mongodb.net/ '
        .length,
    );
  });

  it('reads the password from the injected environment, not from process.env', () => {
    // The environment is a parameter precisely so this is testable without
    // mutating global state, and so the password is read at call time rather
    // than captured when the module loads.
    const original = process.env.DB_MONGO_PASSWORD;
    process.env.DB_MONGO_PASSWORD = 'from-process-env';
    try {
      expect(buildMongoUri({ DB_MONGO_PASSWORD: 'from-argument' })).toBe(
        expectedAtlasUri('from-argument'),
      );
    } finally {
      if (original === undefined) delete process.env.DB_MONGO_PASSWORD;
      else process.env.DB_MONGO_PASSWORD = original;
    }
  });

  it.each([
    ['absent', {}],
    ['empty', { MONGO_URL: '' }],
    ['whitespace only', { MONGO_URL: '   \t ' }],
  ])(
    'falls back to the Atlas default when MONGO_URL is %s',
    (_label, env) => {
      // `BR-005`. A blank variable is a missing variable: forwarding it would
      // fail at boot with a driver error that names neither the variable nor
      // the fallback.
      expect(buildMongoUri({ ...env, DB_MONGO_PASSWORD: 'pw' })).toBe(
        expectedAtlasUri('pw'),
      );
    },
  );

  it('tolerates an entirely empty environment', () => {
    // Boot must not throw before the connection is attempted: an unconfigured
    // machine gets a driver error about the connection, not a TypeError here.
    expect(() => buildMongoUri({})).not.toThrow();
    expect(buildMongoUri({})).toContain(ATLAS_HOST);
  });
});

describe('AppModule wiring (TEST-002, FR-002)', () => {
  const appModule = (): string =>
    readFileSync(join(REPO_ROOT, 'src', 'app.module.ts'), 'utf8');

  it('resolves the connection through buildMongoUri', () => {
    expect(appModule()).toContain('buildMongoUri()');
    expect(appModule()).toMatch(
      /MongooseModule\.forRoot\(\s*buildMongoUri\(\)/,
    );
  });

  it('keeps no hardcoded Atlas host anywhere under src/', () => {
    // The failure this guards is invisible at runtime: re-inlining the URI
    // restores a fixed target while every suite stays green, because unit and
    // E2E both supply their own connection.
    //
    // Two files are exempt, both for the same reason — each of them contains the
    // host only in order to be the one place that knows about it: the config
    // module, which is its single canonical location (`BR-004`), and this spec,
    // which has to name it to assert on it.
    const exempt = new Set([
      join(REPO_ROOT, 'src', 'config', 'mongo.config.ts'),
      join(REPO_ROOT, 'src', 'config', 'mongo.config.spec.ts'),
    ]);

    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.ts') && !exempt.has(full)) {
          if (readFileSync(full, 'utf8').includes(ATLAS_HOST)) {
            offenders.push(full.slice(REPO_ROOT.length + 1));
          }
        }
      }
    };

    walk(join(REPO_ROOT, 'src'));

    expect(offenders).toEqual([]);
  });
});

describe('isolated local Mongo (TEST-003, FR-003, BR-002)', () => {
  // Read inside each test rather than once per `describe`: a missing or renamed
  // file must fail the assertions that concern it, not abort collection and
  // take the unrelated suites in this file down with it.
  const compose = (): string =>
    readFileSync(join(REPO_ROOT, 'docker-compose.yml'), 'utf8');

  it('defines a single mongo service on the pinned image', () => {
    expect(compose()).toMatch(/^\s{2}mongo:\s*$/m);
    expect(compose()).toContain('image: mongo:8.2');
  });

  it('publishes 27017 and keeps its data in a named volume', () => {
    expect(compose()).toMatch(/"27017:27017"/);
    // A named volume, not an anonymous one: an isolated database whose data
    // survives a restart and is removable on purpose is the whole point.
    //
    // Anchored to column zero on purpose. The service declares a `volumes:` key
    // of its own, indented by four; this is the top-level declaration of the
    // named volume itself.
    expect(compose()).toMatch(/^volumes:\s*$/m);
    expect(compose()).toMatch(/source:\s*mongo-data/);
    expect(compose()).toContain('target: /data/db');
  });

  it('declares a healthcheck', () => {
    expect(compose()).toMatch(/^\s{4}healthcheck:\s*$/m);
    expect(compose()).toContain('mongosh');
  });

  it('defines no service other than mongo', () => {
    // Declining to containerize the API is a decision of this Spec. A second
    // service would need a Dockerfile and a build strategy, which is the
    // concern this Spec exists to keep out of its own scope.
    const services = compose()
      .split(/^services:\s*$/m)[1]
      ?.split(/^\S/m)[0]
      .split('\n')
      .map((line) => line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/)?.[1])
      .filter((name): name is string => Boolean(name));

    expect(services).toEqual(['mongo']);
  });

  it('contains no credentials', () => {
    // `BR-002`. Local development connects without authentication on purpose:
    // credentials here would protect nothing and cost every developer a setup
    // step on every machine.
    expect(compose()).not.toContain('MONGO_INITDB_ROOT_PASSWORD');
    expect(compose()).not.toContain('MONGO_INITDB_ROOT_USERNAME');
  });
});

describe('documented configuration (TEST-004, FR-004)', () => {
  const envExample = (): string =>
    readFileSync(join(REPO_ROOT, '.env.example'), 'utf8');

  it('declares MONGO_URL as an optional override', () => {
    // A missing line here is how the next developer sets a variable nothing
    // reads: the exact dead configuration this Spec removes.
    expect(envExample()).toMatch(/^MONGO_URL=/m);
  });

  it('explains that omitting it keeps the current Atlas target', () => {
    const commented = envExample()
      .split('\n')
      .filter((line) => line.trimStart().startsWith('#'))
      .join('\n');
    expect(commented.toLowerCase()).toContain('optional');
    expect(commented).toContain('MONGO_URL');
  });

  it('shows the isolated local target used with the compose service', () => {
    expect(envExample()).toContain(LOCAL_URI);
  });
});
