/**
 * Source-structure regression tests for Phase 1 item 5's controller and
 * route wiring — the pieces that touch live Supabase and so, following
 * this codebase's established pattern (see test-admin-session-lifetime.mjs),
 * are verified by asserting on the real source text rather than by stubbing
 * a Supabase client.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-mfa-controller-wiring.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const loginControllerSource = readFileSync(join(root, 'src/controllers/adminAuth.controller.ts'), 'utf8');
const mfaControllerSource = readFileSync(join(root, 'src/controllers/mfa.controller.ts'), 'utf8');
const routesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const middlewareSource = readFileSync(join(root, 'src/middleware/index.ts'), 'utf8');

/* ------------------------------------------------- handleAdminLogin --- */

function sliceFn(source, name, approxLength = 2500) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  return source.slice(start, start + approxLength);
}

test('1. handleAdminLogin branches to an mfa-pending response BEFORE signing a real session token', () => {
  const fn = sliceFn(loginControllerSource, 'handleAdminLogin');
  const mfaBranchIndex = fn.indexOf('user.mfa_enabled');
  const signIndex = fn.indexOf('signAdminToken({');
  assert.ok(mfaBranchIndex >= 0, 'must check user.mfa_enabled');
  assert.ok(signIndex >= 0, 'must still sign a real token for the non-MFA path');
  assert.ok(mfaBranchIndex < signIndex, 'the MFA check must come before the real-session signAdminToken call');
});

test('2. the mfa-pending branch returns (early exit) rather than falling through to signAdminToken', () => {
  const fn = sliceFn(loginControllerSource, 'handleAdminLogin');
  const branch = fn.slice(fn.indexOf('if (user.mfa_enabled)'), fn.indexOf('const token = signAdminToken'));
  assert.match(branch, /signMfaPendingToken/);
  assert.match(branch, /return;/);
});

test('3. the mfa-pending branch never writes last_login_at or a login audit entry (that happens in handleMfaLoginVerify instead, once sign-in actually completes)', () => {
  const fn = sliceFn(loginControllerSource, 'handleAdminLogin');
  const branch = fn.slice(fn.indexOf('if (user.mfa_enabled)'), fn.indexOf('const token = signAdminToken'));
  assert.doesNotMatch(branch, /last_login_at/);
  assert.doesNotMatch(branch, /writeAuditLog/);
});

/* --------------------------------------------------- mfa.controller --- */

test('4. handleMfaSetupStart refuses to proceed when mfaConfigured is false, before touching Supabase', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaSetupStart');
  const guardIndex = fn.indexOf('if (!mfaConfigured)');
  const supabaseIndex = fn.indexOf('getSupabase()');
  assert.ok(guardIndex >= 0 && guardIndex < supabaseIndex);
});

test('5. handleMfaSetupStart replaces any prior recovery-code batch before inserting the new one (delete, then insert)', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaSetupStart');
  const deleteIndex = fn.indexOf("admin_mfa_recovery_codes').delete(");
  const insertIndex = fn.indexOf('.insert(');
  assert.ok(deleteIndex >= 0 && insertIndex >= 0 && deleteIndex < insertIndex);
});

test('6. handleMfaSetupVerify requires an existing mfa_secret_encrypted before verifying a code (cannot verify what was never started)', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaSetupVerify');
  assert.match(fn, /if \(!user\?\.mfa_secret_encrypted\)/);
});

test('7. handleMfaSetupVerify only sets mfa_enabled=true AFTER verifyTotpCode succeeds', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaSetupVerify');
  const verifyIndex = fn.indexOf('verifyTotpCode(');
  const enableIndex = fn.indexOf('mfa_enabled: true');
  assert.ok(verifyIndex >= 0 && enableIndex >= 0 && verifyIndex < enableIndex);
});

test('8. handleMfaDisable requires bcrypt.compare of current_password BEFORE clearing mfa_enabled/mfa_secret_encrypted', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaDisable');
  const compareIndex = fn.indexOf('bcrypt.compare(');
  const clearIndex = fn.indexOf('mfa_enabled: false');
  assert.ok(compareIndex >= 0 && clearIndex >= 0 && compareIndex < clearIndex);
});

test('9. handleMfaDisable also deletes the recovery-code batch (disabling MFA must not leave old codes usable)', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaDisable');
  assert.match(fn, /admin_mfa_recovery_codes'\)\s*\.delete\(/);
});

test('10. handleMfaLoginVerify marks a used recovery code with used_at BEFORE treating it as verified', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaLoginVerify');
  const markUsedIndex = fn.indexOf("update({ used_at:");
  const verifiedTrueIndex = fn.indexOf('verified = true;');
  assert.ok(markUsedIndex >= 0 && verifiedTrueIndex >= 0 && markUsedIndex < verifiedTrueIndex);
});

test('11. handleMfaLoginVerify never trusts a recovery code without first checking matchRecoveryCode\'s result', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaLoginVerify');
  assert.match(fn, /const matchedId = await matchRecoveryCode\(/);
  assert.match(fn, /if \(matchedId\) \{/);
});

test('12. handleMfaLoginVerify rejects an account whose mfa_enabled is no longer true (e.g. disabled mid-flow)', () => {
  const fn = sliceFn(mfaControllerSource, 'handleMfaLoginVerify');
  assert.match(fn, /!user\.mfa_enabled/);
});

/* ------------------------------------------------------- route wiring --- */

test('13. POST /auth/mfa-verify is wired with mfaVerifyLimiter (no requireAdmin — there is no real session yet at this point)', () => {
  assert.match(
    routesSource,
    /adminRouter\.post\(\s*'\/auth\/mfa-verify',\s*mfaVerifyLimiter,\s*asyncHandler\(handleMfaLoginVerify\)\)/
  );
});

test('14. all four self-service MFA routes require requireAdmin', () => {
  for (const path of ['/auth/mfa', '/auth/mfa/setup', '/auth/mfa/verify-setup', '/auth/mfa/disable']) {
    const escaped = path.replace(/\//g, '\\/');
    assert.match(routesSource, new RegExp(`'${escaped}',\\s*requireAdmin`), `${path} must require requireAdmin`);
  }
});

test('15. mfaVerifyLimiter exists with the same window/threshold shape as adminLoginLimiter (same brute-force surface)', () => {
  assert.match(middlewareSource, /export const mfaVerifyLimiter = limiter\(\s*15 \* 60 \* 1000,\s*env\.RATE_LIMIT_ADMIN_LOGIN,/);
});
