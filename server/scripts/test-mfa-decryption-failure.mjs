/**
 * Regression test for the "decryption failure in mfa-verify returns a
 * clear error" fix made before merge: if decryptMfaSecret() throws (lost/
 * changed MFA_ENCRYPTION_KEY, corrupted stored value), handleMfaLoginVerify
 * must not let that propagate as a generic uncaught 500 — it should be
 * caught, logged, written to the audit log (resourceId'd to the affected
 * account, so an operator can find it), and answered with a clear,
 * safe-to-expose 503, not an unhandled exception.
 *
 * See README.md's "Locked out of admin" section for the manual recovery
 * path this failure mode points an operator toward.
 *
 *   npx tsx --test scripts/test-mfa-decryption-failure.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/controllers/mfa.controller.ts'), 'utf8');

function sliceFn(name) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const next = source.indexOf('export async function', start + marker.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

const fn = sliceFn('handleMfaLoginVerify');

test('1. decryptMfaSecret is called inside a try/catch, not left to propagate', () => {
  const decryptIndex = fn.indexOf('decryptMfaSecret(');
  const tryIndex = fn.lastIndexOf('try {', decryptIndex);
  const catchIndex = fn.indexOf('} catch (err) {', decryptIndex);
  assert.ok(decryptIndex >= 0 && tryIndex >= 0 && catchIndex >= 0);
  assert.ok(tryIndex < decryptIndex && decryptIndex < catchIndex);
});

test('2. a decryption failure throws a safe-to-expose AppError (503), not a bare Error that would surface as a generic 500', () => {
  const catchIndex = fn.indexOf('} catch (err) {');
  const block = fn.slice(catchIndex, catchIndex + 700);
  assert.match(block, /throw new AppError\(/);
  assert.match(block, /503/);
  assert.match(block, /expose:\s*true/);
});

test('3. the error message is clear and actionable, not a raw internal error string', () => {
  const catchIndex = fn.indexOf('} catch (err) {');
  const block = fn.slice(catchIndex, catchIndex + 700);
  assert.match(block, /Two-factor verification is temporarily unavailable/);
});

test('4. the decryption failure is written to the audit log, attributed to the affected account', () => {
  const catchIndex = fn.indexOf('} catch (err) {');
  const block = fn.slice(catchIndex, catchIndex + 700);
  assert.match(block, /action:\s*'mfa_decryption_failed'/);
  assert.match(block, /sub:\s*user\.id/);
});

test('5. the decryption failure is logged server-side with only the error reason, never the stored ciphertext or the encryption key', () => {
  const catchIndex = fn.indexOf('} catch (err) {');
  const block = fn.slice(catchIndex, catchIndex + 300);
  assert.match(block, /logger\.error\('mfa secret decryption failed'/);
  assert.doesNotMatch(block, /mfa_secret_encrypted/);
  assert.doesNotMatch(block, /MFA_ENCRYPTION_KEY/);
});
