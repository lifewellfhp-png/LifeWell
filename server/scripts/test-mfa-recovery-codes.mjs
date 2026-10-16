/**
 * Regression tests for Phase 1 item 5's one-time recovery codes
 * (src/lib/mfaRecoveryCodes.ts) — bcrypt-hashed, single-use, shown in
 * plaintext exactly once at enrollment.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-mfa-recovery-codes.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { generateRecoveryCodes, matchRecoveryCode } from '../src/lib/mfaRecoveryCodes.ts';

test('1. generates 10 codes, each matched by its own hash', async () => {
  const { plaintext, hashes } = await generateRecoveryCodes();
  assert.equal(plaintext.length, 10);
  assert.equal(hashes.length, 10);
  for (let i = 0; i < plaintext.length; i += 1) {
    assert.equal(await bcrypt.compare(plaintext[i], hashes[i]), true);
  }
});

test('2. all 10 generated codes are unique', async () => {
  const { plaintext } = await generateRecoveryCodes();
  assert.equal(new Set(plaintext).size, 10);
});

test('3. codes are formatted XXXX-XXXX, uppercase hex', async () => {
  const { plaintext } = await generateRecoveryCodes();
  for (const code of plaintext) {
    assert.match(code, /^[0-9A-F]{4}-[0-9A-F]{4}$/);
  }
});

test('4. matchRecoveryCode finds the row whose hash matches, and only that one', async () => {
  const { plaintext, hashes } = await generateRecoveryCodes();
  const stored = hashes.map((code_hash) => ({ id: randomUUID(), code_hash, used_at: null }));
  const matchedId = await matchRecoveryCode(plaintext[3], stored);
  assert.equal(matchedId, stored[3].id);
});

test('5. matchRecoveryCode returns null for a code that does not match any stored hash', async () => {
  const { hashes } = await generateRecoveryCodes();
  const stored = hashes.map((code_hash) => ({ id: randomUUID(), code_hash, used_at: null }));
  assert.equal(await matchRecoveryCode('FFFF-FFFF', stored), null);
});

test('6. matchRecoveryCode skips rows already marked used_at, even if the code otherwise matches', async () => {
  const { plaintext, hashes } = await generateRecoveryCodes();
  const stored = hashes.map((code_hash, i) => ({
    id: randomUUID(),
    code_hash,
    used_at: i === 2 ? new Date().toISOString() : null,
  }));
  assert.equal(await matchRecoveryCode(plaintext[2], stored), null);
});

test('7. matching is case-insensitive (lowercase input still matches an uppercase-stored code)', async () => {
  const { plaintext, hashes } = await generateRecoveryCodes();
  const stored = hashes.map((code_hash) => ({ id: randomUUID(), code_hash, used_at: null }));
  const matchedId = await matchRecoveryCode(plaintext[5].toLowerCase(), stored);
  assert.equal(matchedId, stored[5].id);
});
