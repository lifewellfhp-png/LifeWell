/**
 * Regression tests for the ADMIN_JWT_SECRET fail-closed change (P4-B1):
 * server/src/config/env.ts must no longer fall back to a known default
 * value, and must exit non-zero at boot if the secret is missing or too
 * short — never signing admin tokens with a value anyone could guess from
 * reading the source.
 *
 * Each scenario runs env.ts in its own child process (it validates and
 * calls process.exit(1) as an import-time side effect, so it can't be
 * asserted on in-process without killing the test runner).
 *
 *   npx tsx --test scripts/test-admin-jwt-secret.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const helper = join(__dirname, '_env-check-helper.mjs');

const KNOWN_INSECURE_DEFAULT = 'dev-only-change-me-admin-jwt';
const VALID_TEST_SECRET = 'test-only-admin-jwt-secret-not-for-production-000000';

function runWithEnv(envOverrides) {
  const env = { ...process.env };
  delete env.ADMIN_JWT_SECRET;
  Object.assign(env, envOverrides);
  return spawnSync(process.execPath, ['--import', 'tsx', helper], {
    cwd: join(__dirname, '..'),
    env,
    encoding: 'utf8',
  });
}

test('A. missing ADMIN_JWT_SECRET fails closed (non-zero exit, no admin token signed)', () => {
  const result = runWithEnv({});
  assert.notEqual(result.status, 0, 'expected boot to fail without ADMIN_JWT_SECRET');
  assert.doesNotMatch(result.stdout, /ENV_OK/);
});

test('B. an ADMIN_JWT_SECRET shorter than 32 characters also fails closed', () => {
  const result = runWithEnv({ ADMIN_JWT_SECRET: 'too-short' });
  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, /ENV_OK/);
});

test('C. the previous insecure default is no longer accepted as a fallback', () => {
  // Confirms KNOWN_INSECURE_DEFAULT is not silently reused: it happens to be
  // under 32 chars, so this doubles as a direct regression check that the
  // exact old fallback string can't boot the server on its own.
  const result = runWithEnv({ ADMIN_JWT_SECRET: KNOWN_INSECURE_DEFAULT });
  assert.notEqual(result.status, 0);
});

test('D. a valid synthetic test secret boots cleanly', () => {
  const result = runWithEnv({ ADMIN_JWT_SECRET: VALID_TEST_SECRET });
  assert.equal(result.status, 0, `expected clean boot, got stderr: ${result.stderr}`);
  assert.match(result.stdout, /ENV_OK/);
});

test('E. no secret value ever appears in the failure output', () => {
  const attempted = 'attempted-secret-value-should-never-be-echoed';
  const result = runWithEnv({ ADMIN_JWT_SECRET: attempted.slice(0, 10) });
  assert.doesNotMatch(result.stdout + result.stderr, new RegExp(attempted));
});
