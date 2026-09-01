/**
 * Regression tests for P4-G4A (admin token revocation consistency + HS256
 * algorithm pinning).
 *
 * Two layers, matching this codebase's established convention of testing
 * the actual sign/verify/decision logic directly rather than against a live
 * Supabase connection (see test-change-password-crypto.mjs):
 *
 *   1. Header/token-level checks run the REAL requireAdmin middleware
 *      mounted in a minimal Express app. No Supabase configuration is
 *      needed for these — every case here (missing header, malformed
 *      token, wrong signature, wrong algorithm, expired token) throws
 *      inside verifyAdminToken() before requireAdmin ever calls
 *      getSupabase(), so this is the real production code path, not a
 *      stand-in for it.
 *   2. DB-outcome-dependent checks (token_version mismatch, DB error,
 *      inactive account, and the updateAdminUser revocation decision) call
 *      the actual exported pure functions — isSessionRevoked() and
 *      shouldRevokeOnUpdate() — with synthetic lookup results standing in
 *      for what a real Supabase query would have returned. These are the
 *      exact functions requireAdmin/updateAdminUser call in production;
 *      this proves the decision itself, not a reimplementation of it.
 *
 * No live Supabase connection, no real Production credentials, no
 * token/secret values printed.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-admin-revocation-hardening.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  signAdminToken,
  verifyAdminToken,
  isSessionRevoked,
  requireAdmin,
} from '../src/middleware/adminAuth.js';
import { shouldRevokeOnUpdate } from '../src/controllers/adminAuth.controller.js';
import { errorHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const middlewareSource = readFileSync(join(root, 'src/middleware/adminAuth.ts'), 'utf8');

const SECRET = process.env.ADMIN_JWT_SECRET;

function basePayload(overrides = {}) {
  return {
    sub: 'test-admin-id',
    email: 'test@example.invalid',
    role: 'super_admin',
    permissions: ['*'],
    tv: 0,
    ...overrides,
  };
}

function startStubServer() {
  return new Promise((resolve) => {
    const app = express();
    app.get('/x', requireAdmin, (_req, res) => res.status(200).json({ success: true }));
    app.use(errorHandler);
    const server = app.listen(0, () => resolve(server));
  });
}

async function requestWithAuth(port, authHeader) {
  const res = await fetch(`http://127.0.0.1:${port}/x`, {
    headers: authHeader ? { Authorization: authHeader } : {},
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

// --- A. Header/token-level (real requireAdmin, no Supabase reached) --------

test('1/5. missing Authorization is rejected with the sign-in-required message, never reaching Supabase', async () => {
  const server = await startStubServer();
  const { port } = server.address();
  try {
    const { status, body } = await requestWithAuth(port, undefined);
    assert.equal(status, 401);
    assert.match(body.message, /sign in required/i);
  } finally {
    server.close();
  }
});

test('6. a malformed token fails with the generic session-expired message', async () => {
  const server = await startStubServer();
  const { port } = server.address();
  try {
    const { status, body } = await requestWithAuth(port, 'Bearer not-a-real-jwt');
    assert.equal(status, 401);
    assert.match(body.message, /session expired/i);
  } finally {
    server.close();
  }
});

test('7. a well-formed but wrong-signature token fails generically', async () => {
  const server = await startStubServer();
  const { port } = server.address();
  try {
    const forged = jwt.sign(basePayload(), 'a-completely-different-secret-value', {
      algorithm: 'HS256',
    });
    const { status, body } = await requestWithAuth(port, `Bearer ${forged}`);
    assert.equal(status, 401);
    assert.match(body.message, /session expired/i);
  } finally {
    server.close();
  }
});

test('8. an expired token fails generically', async () => {
  const server = await startStubServer();
  const { port } = server.address();
  try {
    const expired = jwt.sign(basePayload(), SECRET, { algorithm: 'HS256', expiresIn: '-1s' });
    const { status, body } = await requestWithAuth(port, `Bearer ${expired}`);
    assert.equal(status, 401);
    assert.match(body.message, /session expired/i);
  } finally {
    server.close();
  }
});

test('4. a token signed with an unauthorized algorithm (HS384, same secret) is rejected', async () => {
  const server = await startStubServer();
  const { port } = server.address();
  try {
    const wrongAlg = jwt.sign(basePayload(), SECRET, { algorithm: 'HS384' });
    const { status, body } = await requestWithAuth(port, `Bearer ${wrongAlg}`);
    assert.equal(status, 401);
    assert.match(body.message, /session expired/i);
  } finally {
    server.close();
  }
});

// --- B. Algorithm pinning at the sign/verify level --------------------------

test('2. signAdminToken explicitly signs with HS256', () => {
  const token = signAdminToken(basePayload());
  const header = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8'));
  assert.equal(header.alg, 'HS256');
});

test('3. verifyAdminToken accepts a valid HS256 token', () => {
  const token = signAdminToken(basePayload({ tv: 7 }));
  const payload = verifyAdminToken(token);
  assert.equal(payload.tv, 7);
});

test('4b. verifyAdminToken rejects a token signed with HS512 using the same secret', () => {
  const wrongAlg = jwt.sign(basePayload(), SECRET, { algorithm: 'HS512' });
  assert.throws(() => verifyAdminToken(wrongAlg));
});

test('source: signAdminToken pins algorithm, verifyAdminToken restricts algorithms', () => {
  assert.match(middlewareSource, /jwt\.sign\([^)]*algorithm:\s*'HS256'/s);
  assert.match(middlewareSource, /jwt\.verify\([^)]*algorithms:\s*\['HS256'\]/s);
});

// --- C. isSessionRevoked — the real requireAdmin decision function ---------

test('9. a token_version mismatch is revoked', () => {
  const revoked = isSessionRevoked({ data: { token_version: 2, active: true }, error: null }, 1);
  assert.equal(revoked, true);
});

test('10a. a Supabase lookup error fails closed (revoked)', () => {
  const revoked = isSessionRevoked({ data: null, error: { message: 'db down' } }, 0);
  assert.equal(revoked, true);
});

test('10b/24. no row found (deleted user) fails closed (revoked) — deletion revocation regression', () => {
  const revoked = isSessionRevoked({ data: null, error: null }, 0);
  assert.equal(revoked, true);
});

test('11. an inactive account is revoked even when token_version matches exactly', () => {
  const revoked = isSessionRevoked({ data: { token_version: 3, active: false }, error: null }, 3);
  assert.equal(revoked, true);
});

test('1b. a matching token_version on an active account is NOT revoked (the normal, valid-session case)', () => {
  const revoked = isSessionRevoked({ data: { token_version: 3, active: true }, error: null }, 3);
  assert.equal(revoked, false);
});

test('13. a token issued before a disable (old tv) is rejected once the row reflects the disable', () => {
  // As if signed with tv=0, then updateAdminUser bumped token_version to 1
  // and set active=false.
  const revoked = isSessionRevoked({ data: { token_version: 1, active: false }, error: null }, 0);
  assert.equal(revoked, true);
});

test('15. the token revoked by disable remains invalid after re-enable (token_version is never reset)', () => {
  // Re-enable sets active back to true but must NOT reset token_version —
  // the same stale tv=0 token must still fail.
  const revoked = isSessionRevoked({ data: { token_version: 1, active: true }, error: null }, 0);
  assert.equal(revoked, true);
});

test('16. a fresh token from a real re-login after re-enable (tv matches current) works', () => {
  const revoked = isSessionRevoked({ data: { token_version: 1, active: true }, error: null }, 1);
  assert.equal(revoked, false);
});

test('23. password-change-style revocation still works (mechanism is tv-source-agnostic)', () => {
  // isSessionRevoked doesn't know or care WHY tv changed — proves the
  // underlying mechanism handleChangePassword relies on is unaffected by
  // this phase's changes.
  const revoked = isSessionRevoked({ data: { token_version: 2, active: true }, error: null }, 1);
  assert.equal(revoked, true);
});

// --- D. shouldRevokeOnUpdate — the real updateAdminUser decision function --

test('12. active:true → false increments exactly once (returns true)', () => {
  const revoke = shouldRevokeOnUpdate({ active: true, permissions: ['leads'] }, { active: false });
  assert.equal(revoke, true);
});

test('14. active:false → true (re-enable) does not trigger revocation on its own', () => {
  const revoke = shouldRevokeOnUpdate({ active: false, permissions: ['leads'] }, { active: true });
  assert.equal(revoke, false);
});

test('resubmitting active:false on an already-disabled account is a no-op, not a new revocation', () => {
  const revoke = shouldRevokeOnUpdate({ active: false, permissions: ['leads'] }, { active: false });
  assert.equal(revoke, false);
});

test('17. an actual permission reduction triggers revocation', () => {
  const revoke = shouldRevokeOnUpdate(
    { active: true, permissions: ['leads', 'users'] },
    { permissions: ['leads'] }
  );
  assert.equal(revoke, true);
});

test('18. an actual permission addition/change also triggers revocation (stale claims must not persist)', () => {
  const revoke = shouldRevokeOnUpdate({ active: true, permissions: ['leads'] }, { permissions: ['leads', 'seo'] });
  assert.equal(revoke, true);
});

test('19. the same effective permission set resubmitted in a different order does NOT trigger revocation', () => {
  const revoke = shouldRevokeOnUpdate(
    { active: true, permissions: ['content', 'users'] },
    { permissions: ['users', 'content'] }
  );
  assert.equal(revoke, false);
});

test('20. permissions submitted identical to the current set (same order) does not trigger revocation', () => {
  const revoke = shouldRevokeOnUpdate(
    { active: true, permissions: ['leads', 'seo'] },
    { permissions: ['leads', 'seo'] }
  );
  assert.equal(revoke, false);
});

test('21. an unrelated profile-only update (no active/permissions field submitted) does not trigger revocation', () => {
  const revoke = shouldRevokeOnUpdate({ active: true, permissions: ['leads'] }, {});
  assert.equal(revoke, false);
});

test('22. a combined active-disable + permissions-change update still revokes exactly once (boolean, not summed)', () => {
  const revoke = shouldRevokeOnUpdate(
    { active: true, permissions: ['leads', 'users'] },
    { active: false, permissions: ['leads'] }
  );
  assert.equal(revoke, true);
  // "exactly once" is inherent to the boolean OR — there is no numeric
  // increment count returned by this function to double, and the caller
  // (updateAdminUser) applies +1 a single time regardless of how many of
  // the two conditions were true.
});

// --- E. No unrelated architecture change ------------------------------------

test('25. requirePermission/requireAnyPermission still read permissions from the verified JWT claims on req.admin, unchanged', () => {
  const start = middlewareSource.indexOf('export function requireAnyPermission');
  const end = middlewareSource.indexOf('export function requireSuperAdmin');
  assert.ok(start > -1 && end > start, 'expected to find requireAnyPermission in the source');
  const fnBody = middlewareSource.slice(start, end);
  assert.match(fnBody, /const admin = \(req as AuthedRequest\)\.admin;/);
  assert.match(fnBody, /admin\.permissions\.includes/);
  // No DB call inside this function — permissions still come solely from
  // the already-verified JWT payload requireAdmin attached, not a fresh
  // per-request lookup (no unrelated authorization architecture rewrite).
  assert.doesNotMatch(fnBody, /getSupabase\(\)/);
});
