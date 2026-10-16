/**
 * Regression tests for Phase 1 item 5's MFA-pending token
 * (src/middleware/adminAuth.ts's signMfaPendingToken/verifyMfaPendingToken)
 * and, critically, requireAdmin's explicit rejection of one — the thing
 * that stops a short-lived "I entered the right password but haven't done
 * MFA yet" token from ever being usable as a real session, regardless of
 * what its token_version lookup would have returned.
 *
 * requireAdmin's mfa-pending check runs and returns BEFORE any Supabase
 * call, so this is directly testable with a real forged token and a fake
 * req/res/next, no stubbing needed.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-mfa-pending-token.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  signMfaPendingToken,
  verifyMfaPendingToken,
  signAdminToken,
  requireAdmin,
} from '../src/middleware/adminAuth.ts';

const SECRET = process.env.ADMIN_JWT_SECRET;

test('1. signMfaPendingToken + verifyMfaPendingToken round-trips the sub', () => {
  const token = signMfaPendingToken('user-1');
  const payload = verifyMfaPendingToken(token);
  assert.equal(payload.sub, 'user-1');
  assert.equal(payload.purpose, 'mfa-pending');
});

test('2. the signed token has a 5-minute expiry', () => {
  const token = signMfaPendingToken('user-1');
  const decoded = jwt.decode(token);
  assert.equal(decoded.exp - decoded.iat, 5 * 60);
});

test('3. verifyMfaPendingToken rejects a REAL session token (right secret, wrong purpose)', () => {
  const realToken = signAdminToken({ sub: 'user-1', email: 'a@b.com', role: 'staff', permissions: [], tv: 0 });
  assert.throws(() => verifyMfaPendingToken(realToken), /Not an MFA-pending token/);
});

test('4. verifyMfaPendingToken rejects a token signed with the wrong secret', () => {
  const forged = jwt.sign({ sub: 'user-1', purpose: 'mfa-pending' }, 'a-completely-different-secret-value', {
    algorithm: 'HS256',
  });
  assert.throws(() => verifyMfaPendingToken(forged));
});

/* --------------------- requireAdmin rejects an mfa-pending Bearer token --- */

function fakeReq(token) {
  return { headers: { authorization: `Bearer ${token}` } };
}

function captureNext() {
  const calls = [];
  const next = (err) => calls.push(err);
  return { next, calls };
}

test('5. requireAdmin rejects an mfa-pending token presented as a session Bearer token, with 401', () => {
  const pendingToken = signMfaPendingToken('user-1');
  const { next, calls } = captureNext();
  requireAdmin(fakeReq(pendingToken), {}, next);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].status, 401);
});

test('6. this rejection happens synchronously, before any Supabase lookup could run (no admin property ever gets attached)', () => {
  const pendingToken = signMfaPendingToken('user-1');
  const req = fakeReq(pendingToken);
  const { next } = captureNext();
  requireAdmin(req, {}, next);
  assert.equal(req.admin, undefined);
});

test('7. a REAL session token for an account at token_version 0 is NOT rejected by the mfa-pending check (sanity: the guard is specific to purpose, not a blanket reject)', () => {
  // This only exercises the synchronous pre-check; the async Supabase
  // lookup that follows isn't stubbed here (see test-admin-session-
  // lifetime.mjs for that), so we just assert next() was NOT called
  // synchronously with the mfa-pending rejection message.
  const realToken = signAdminToken({ sub: 'user-1', email: 'a@b.com', role: 'staff', permissions: [], tv: 0 });
  const { next, calls } = captureNext();
  requireAdmin(fakeReq(realToken), {}, next);
  assert.equal(calls.length, 0, 'next() must not have been called synchronously yet');
});
