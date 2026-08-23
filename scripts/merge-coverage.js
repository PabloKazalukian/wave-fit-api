/**
 * Mergea los reportes de cobertura de unitarios (coverage/coverage-final.json)
 * y e2e (coverage/e2e/coverage-final.json) en un reporte combinado
 * (coverage/combined/) y muestra un resumen por módulo.
 *
 * Uso: npm run test:cov && npm run test:e2e:cov && node scripts/merge-coverage.js
 */
const fs = require('fs');
const path = require('path');
const libCoverage = require('istanbul-lib-coverage');

const ROOT = path.resolve(__dirname, '..');
const SOURCES = [
  { name: 'unit', file: path.join(ROOT, 'coverage', 'coverage-final.json') },
  {
    name: 'e2e',
    file: path.join(ROOT, 'coverage', 'e2e', 'coverage-final.json'),
  },
];
const OUT_DIR = path.join(ROOT, 'coverage', 'combined');

function loadCoverage(file) {
  if (!fs.existsSync(file)) {
    console.warn(`[merge-coverage] No se encontró ${file}, se omite.`);
    return null;
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const merged = libCoverage.createCoverageMap({});

  for (const source of SOURCES) {
    const data = loadCoverage(source.file);
    if (!data) continue;
    const map = libCoverage.createCoverageMap(data);
    console.log(
      `[merge-coverage] ${source.name}: ${Object.keys(data).length} archivos`,
    );
    merged.merge(map.toJSON());
  }

  if (merged.files().length === 0) {
    console.error('[merge-coverage] No hay datos de cobertura para mergear.');
    process.exit(1);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, 'coverage-final.json'),
    JSON.stringify(merged.toJSON(), null, 2),
  );

  const rows = merged
    .files()
    .map((file) => {
      const s = merged.fileCoverageFor(file).toSummary();
      return {
        file: path.relative(ROOT, file),
        lines: s.lines.pct,
        branches: s.branches.pct,
        fns: s.functions.pct,
        stmts: s.statements.pct,
      };
    })
    .sort((a, b) => a.file.localeCompare(b.file));

  const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2) : '0.00');
  const pad = (s, n) => String(s).padEnd(n);

  console.log('\n=== Cobertura combinada (unit + e2e) ===\n');
  for (const r of rows) {
    console.log(
      `${pad(r.file, 90)} ${pad(fmt(r.lines), 8)} ${pad(fmt(r.branches), 10)} ${pad(fmt(r.fns), 8)} ${fmt(r.stmts)}`,
    );
  }

  // Totales ponderados por cantidad de elementos (estilo istanbul)
  const summary = merged.getCoverageSummary();
  const pct = (k) => fmt(summary[k].pct);
  console.log('\n--- Totales ponderados ---');
  console.log(
    `Líneas: ${pct('lines')}% | Branches: ${pct('branches')}% | Funciones: ${pct('functions')}% | Statements: ${pct('statements')}%`,
  );
  console.log(`\nReporte combinado escrito en ${OUT_DIR}`);
}

main();
