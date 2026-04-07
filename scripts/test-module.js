const glob = require('glob');
const path = require('path');
const { execSync } = require('child_process');

const moduleName = process.argv[2];

if (!moduleName) {
  console.error('Usage: npm run test:module -- <module-name>');
  console.error('Example: npm run test:module -- week-log');
  console.error('\nAvailable modules:');

  const files = glob.sync('src/modules/**/*.spec.ts');
  const modules = new Set();

  files.forEach((file) => {
    const parts = file.replace(/\\/g, '/').split('/');
    const modulesIdx = parts.indexOf('modules');
    if (modulesIdx !== -1 && parts[modulesIdx + 1]) {
      modules.add(parts[modulesIdx + 1]);
    }
  });

  if (modules.size === 0) {
    console.log('  (No test files found)');
  } else {
    Array.from(modules)
      .sort()
      .forEach((m) => console.log(`  - ${m}`));
  }
  process.exit(1);
}

console.log(`\n🔍 Searching for tests in module: ${moduleName}\n`);

const searchPatterns = [
  `src/modules/${moduleName}/**/*.spec.ts`,
  `src/modules/**/${moduleName}/**/*.spec.ts`,
];

let matchedFiles = [];

searchPatterns.forEach((pattern) => {
  const files = glob.sync(pattern);
  matchedFiles = [...matchedFiles, ...files];
});

matchedFiles = [...new Set(matchedFiles)];

if (matchedFiles.length === 0) {
  console.error(`❌ No tests found for module: ${moduleName}`);
  process.exit(1);
}

console.log(`📁 Found ${matchedFiles.length} test file(s):`);
matchedFiles.forEach((f) => console.log(`  - ${f}`));
console.log('\n▶️  Running tests...\n');

const jestArgs = [
  '--config',
  './jest.config.js',
  ...matchedFiles,
  '--no-coverage',
];

try {
  execSync(`npx jest ${jestArgs.join(' ')}`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
} catch (error) {
  process.exit(1);
}
