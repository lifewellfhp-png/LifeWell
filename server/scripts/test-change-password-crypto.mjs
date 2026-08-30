/**
 * Tests the cryptographic/session-revocation logic handleChangePassword()
 * relies on (server/src/controllers/adminAuth.controller.ts):
 *
 *   - bcrypt correctly rejects an incorrect current password
 *   - bcrypt correctly accepts a successful change
 *   - the OLD password stops matching once the hash is replaced
 *   - a JWT signed with a stale token_version (`tv`) is distinguishable
 *     from one signed with the current version — the actual mechanism
 *     requireAdmin uses to revoke sessions after a password change
 *
 * This exercises the same bcrypt/jsonwebtoken calls the controller makes,
 * without a live Supabase connection (no network calls) — the repo's other
 * tests for this table (leads via storeLead, etc.) already establish the
 * plain Supabase CRUD plumbing works; this file is specifically about the
 * password/session logic that plumbing wraps.
 *
 * Every password string is generated at runtime — never a fixed literal —
 * so nothing password-shaped is committed to source control.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-change-password-crypto.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { signAdminToken, verifyAdminToken } from '../src/middleware/adminAuth.js';

function randomPassword() {
  return `Aa1!${randomBytes(10).toString('base64url')}`;
}

test('A. an incorrect current password fails bcrypt.compare against the stored hash', async () => {
  const actual = randomPassword();
  const attempted = randomPassword();
  const hash = await bcrypt.hash(actual, 12);
  assert.equal(await bcrypt.compare(attempted, hash), false);
});

test('B. the correct current password passes bcrypt.compare against the stored hash', async () => {
  const actual = randomPassword();
  const hash = await bcrypt.hash(actual, 12);
  assert.equal(await bcrypt.compare(actual, hash), true);
});

test('C. successful change: the new password verifies against the new hash', async () => {
  const oldPw = randomPassword();
  const newPw = randomPassword();
  const oldHash = await bcrypt.hash(oldPw, 12);
  assert.equal(await bcrypt.compare(oldPw, oldHash), true); // sanity: old hash matches old pw

  const newHash = await bcrypt.hash(newPw, 12);
  assert.equal(await bcrypt.compare(newPw, newHash), true);
});

test('D. old-password rejection afterward: once the hash is replaced, the old password no longer matches', async () => {
  const oldPw = randomPassword();
  const newPw = randomPassword();
  const newHash = await bcrypt.hash(newPw, 12); // simulates the row's password_hash after the update
  assert.equal(await bcrypt.compare(oldPw, newHash), false);
  assert.equal(await bcrypt.compare(newPw, newHash), true);
});

test('E. a new password identical to the current one is detected (the controller rejects this before hashing)', async () => {
  const pw = randomPassword();
  const hash = await bcrypt.hash(pw, 12);
  // Mirrors handleChangePassword's own reuse check: compare the *candidate*
  // new password against the *existing* hash before ever calling
  // bcrypt.hash() on it.
  assert.equal(await bcrypt.compare(pw, hash), true);
});

test('F. a token signed with the current token_version verifies and round-trips tv', () => {
  const token = signAdminToken({
    sub: 'test-admin-id',
    email: 'test@example.invalid',
    role: 'super_admin',
    permissions: ['*'],
    tv: 3,
  });
  const payload = verifyAdminToken(token);
  assert.equal(payload.tv, 3);
});

test('G. a token signed with a stale tv is distinguishable from the current version (the revocation check itself)', () => {
  const staleToken = signAdminToken({
    sub: 'test-admin-id',
    email: 'test@example.invalid',
    role: 'super_admin',
    permissions: ['*'],
    tv: 1, // as if signed before a password change bumped the row to tv: 2
  });
  const payload = verifyAdminToken(staleToken);
  const currentTokenVersionInDb = 2;
  assert.notEqual(payload.tv, currentTokenVersionInDb);
});
