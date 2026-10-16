/**
 * Regression tests for Phase 1 item 6's extension: admin security event
 * audit logging — login failure (both the unknown-email/inactive-account
 * path and the wrong-password path in handleAdminLogin), MFA verification
 * failure, and recovery-code logins getting their own distinct action
 * (mfa_recovery_code_used) instead of being folded into a plain 'login'
 * entry. login/logout/MFA-enroll/MFA-disable were already covered before
 * this change — see test-admin-session-lifetime.mjs and
 * test-mfa-controller-wiring.mjs.
 *
 * The hard requirement across every new call site: never record the
 * submitted password, TOTP code, or recovery code value — only which
 * method was attempted/used and (where a real account was matched) which
 * account.
 *
 * Following this codebase's established convention of verifying Supabase-
 * touching controller logic at the source level rather than stubbing a
 * Supabase client (see test-admin-session-lifetime.mjs).
 *
 *   npx tsx --test scripts/test-security-event-audit-log.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const loginSource = readFileSync(join(root, 'src/controllers/adminAuth.controller.ts'), 'utf8');
const mfaSource = readFileSync(join(root, 'src/controllers/mfa.controller.ts'), 'utf8');

function sliceFn(source, name) {
  const start = source.indexOf(`export async function ${name}`);
  assert.ok(start >= 0, `${name} must exist`);
  return source.slice(start);
}

/* -------------------------------------------- handleAdminLogin failures --- */

test('1. the unknown-email/inactive-account branch writes a login_failed audit entry before throwing', () => {
  const fn = sliceFn(loginSource, 'handleAdminLogin');
  const branch = fn.slice(fn.indexOf('if (!user || !user.active)'), fn.indexOf('const ok = await bcrypt.compare'));
  const auditIndex = branch.indexOf('writeAuditLog(');
  const throwIndex = branch.indexOf("throw unauthorized('Invalid email or password.')");
  assert.ok(auditIndex >= 0 && throwIndex >= 0);
  assert.ok(auditIndex < throwIndex, 'audit log must be written before the throw');
  assert.match(branch, /action:\s*'login_failed'/);
});

test('2. the unknown-email/inactive-account entry never includes an actor sub (no real account confirmed) and records only the attempted email, never a password', () => {
  const fn = sliceFn(loginSource, 'handleAdminLogin');
  const branch = fn.slice(fn.indexOf('if (!user || !user.active)'), fn.indexOf('const ok = await bcrypt.compare'));
  const callStart = branch.indexOf('writeAuditLog(');
  const callEnd = branch.indexOf('});', callStart) + '});'.length;
  const call = branch.slice(callStart, callEnd);
  assert.doesNotMatch(call, /actor:/);
  assert.match(call, /attempted_email:\s*email/);
  assert.doesNotMatch(call, /password/i);
});

test('3. the wrong-password branch writes a login_failed audit entry attributed to the matched account, before throwing', () => {
  const fn = sliceFn(loginSource, 'handleAdminLogin');
  const branch = fn.slice(fn.indexOf('const ok = await bcrypt.compare'), fn.indexOf('/**\n   * Phase 1 item 5'));
  const auditIndex = branch.indexOf('writeAuditLog(');
  const throwIndex = branch.indexOf("throw unauthorized('Invalid email or password.')");
  assert.ok(auditIndex >= 0 && throwIndex >= 0);
  assert.ok(auditIndex < throwIndex);
  const call = branch.slice(auditIndex, auditIndex + 400);
  assert.match(call, /action:\s*'login_failed'/);
  assert.match(call, /sub:\s*user\.id/);
});

test('4. the wrong-password audit entry never records the submitted password, only a generic reason', () => {
  const fn = sliceFn(loginSource, 'handleAdminLogin');
  const branch = fn.slice(fn.indexOf('const ok = await bcrypt.compare'), fn.indexOf('/**\n   * Phase 1 item 5'));
  const callStart = branch.indexOf('writeAuditLog(');
  const call = branch.slice(callStart, callStart + 400);
  assert.match(call, /reason:\s*'wrong_password'/);
  assert.doesNotMatch(call, /parsed\.data\.password/);
});

/* ---------------------------------------------- handleMfaLoginVerify --- */

test('5. a failed MFA verification writes an mfa_verify_failed audit entry before throwing, recording only which method was attempted', () => {
  const fn = sliceFn(mfaSource, 'handleMfaLoginVerify');
  const branch = fn.slice(fn.indexOf('if (!verified)'), fn.indexOf('const token = signAdminToken'));
  assert.match(branch, /action:\s*'mfa_verify_failed'/);
  assert.match(branch, /method:\s*parsed\.data\.recovery_code \? 'recovery_code' : 'totp'/);
  assert.doesNotMatch(branch, /parsed\.data\.code\b/);
  assert.doesNotMatch(branch, /parsed\.data\.recovery_code,/);
});

test('6. the mfa_verify_failed audit write happens BEFORE the throw, not after (an unreachable statement would never actually log anything)', () => {
  const fn = sliceFn(mfaSource, 'handleMfaLoginVerify');
  const branch = fn.slice(fn.indexOf('if (!verified)'), fn.indexOf('const token = signAdminToken'));
  const auditIndex = branch.indexOf('writeAuditLog(');
  const throwIndex = branch.indexOf("throw unauthorized('That code is incorrect.')");
  assert.ok(auditIndex >= 0 && throwIndex >= 0);
  assert.ok(auditIndex < throwIndex);
});

test('7. a successful recovery-code login records action mfa_recovery_code_used, not plain login', () => {
  const fn = sliceFn(mfaSource, 'handleMfaLoginVerify');
  const successBlock = fn.slice(fn.indexOf('const token = signAdminToken'));
  assert.match(successBlock, /action:\s*usedRecoveryCode \? 'mfa_recovery_code_used' : 'login'/);
});

test('8. usedRecoveryCode is only ever set true inside the recovery_code branch, never the TOTP branch', () => {
  const fn = sliceFn(mfaSource, 'handleMfaLoginVerify');
  const totpBranch = fn.slice(fn.indexOf('if (parsed.data.code)'), fn.indexOf('} else if (parsed.data.recovery_code)'));
  const recoveryBranch = fn.slice(
    fn.indexOf('} else if (parsed.data.recovery_code)'),
    fn.indexOf('if (!verified)')
  );
  assert.doesNotMatch(totpBranch, /usedRecoveryCode = true/);
  assert.match(recoveryBranch, /usedRecoveryCode = true/);
});

/* --------------------------------------------- notification exclusion --- */

test('9. login_failed and mfa_verify_failed are both excluded from the staff-action notification spam; mfa_recovery_code_used is deliberately NOT excluded', () => {
  const auditSource = readFileSync(join(root, 'src/lib/audit.ts'), 'utf8');
  const [, listSource] = auditSource.match(/const ROUTINE_SESSION_ACTIONS = new Set\(\[([^\]]*)\]\);/) ?? [];
  assert.ok(listSource, 'ROUTINE_SESSION_ACTIONS must exist');
  assert.match(listSource, /'login_failed'/);
  assert.match(listSource, /'mfa_verify_failed'/);
  assert.doesNotMatch(listSource, /'mfa_recovery_code_used'/);
});
