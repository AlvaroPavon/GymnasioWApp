import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ALLOWED_SCRIPTS = new Set([
  'release:check',
  'release:check:android',
  'build:android',
  'build:ios',
  'submit:android',
  'submit:ios'
]);

const args = process.argv.slice(2);
const script = args.find((value) => !value.startsWith('--'));
const envArgument = args.find((value) => value.startsWith('--release-env-file='));
const envFile = envArgument?.slice('--release-env-file='.length) || '.env.production';
const mobileDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const envPath = path.resolve(mobileDirectory, envFile);

if (!script || !ALLOWED_SCRIPTS.has(script)) {
  console.error(`Usage: node src/release/runWithEnv.mjs <${[...ALLOWED_SCRIPTS].join('|')}> [--release-env-file=.env.production]`);
  process.exit(1);
}

if (!existsSync(envPath)) {
  console.error(`Release environment file not found: ${envPath}`);
  process.exit(1);
}

try {
  process.loadEnvFile(envPath);
} catch (error) {
  console.error(`Could not load the release environment file: ${error.message}`);
  process.exit(1);
}

console.log(`Running npm script "${script}" with environment loaded from ${path.basename(envPath)}.`);
const result = spawnSync('npm', ['run', script], {
  cwd: mobileDirectory,
  env: process.env,
  shell: process.platform === 'win32',
  stdio: 'inherit'
});

if (result.error) {
  console.error(`Could not start npm: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
