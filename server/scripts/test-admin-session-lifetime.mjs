/**
 * Regression tests for Phase 1 item 4: "8-hour absolute lifetime, 30-minute
 * idle timeout, and a logout that invalidates the token server-side
 * (token_version)."
 *
 * The absolute lifetime and the logout revocation are both server-side and
 * directly testable here. The idle timeout itself is enforced by the admin
 * app's own cookie Max-Age sliding (see admin/scripts/test-admin-session-
 * middleware.mjs and test-admin-api-proxy.mjs) — nothing for this repo to
 * test, since Express never sees cookies at all, only the Bearer token.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-admin-session-lifetime.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { signAdminToken } from '../src/middleware/adminAuth.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const adminAuthMiddlewareSource = readFileSync(join(root, 'src/middleware/adminAuth.ts'), 'utf8');
const controllerSource = readFileSync(join(root, 'src/controllers/adminAuth.controller.ts'), 'utf8');
const routesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const auditSource = readFileSync(join(root, 'src/lib/audit.ts'), 'utf8');

function basePayload(overrides = {}) {
  return { sub: 'user-1', email: 'a@example.com', role: 'super_admin', permissions: ['*'], tv: 0, ...overrides };
}

function decodePayload(token) {
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

/* ------------------------------------------------ absolute lifetime --- */

test('A. signAdminToken signs with an 8-hour absolute lifetime, not the old 30 days', () => {
  const token = signAdminToken(basePayload());
  const { iat, exp } = decodePayload(token);
  assert.equal(exp - iat, 8 * 60 * 60);
});

test('B. source: signAdminToken literally reads "8h", not "30d"', () => {
  assert.match(adminAuthMiddlewareSource, /expiresIn:\s*'8h'/);
  assert.doesNotMatch(adminAuthMiddlewareSource, /expiresIn:\s*'30d'/);
});

/* --------------------------------------------------------- logout --- */

test('C. handleAdminLogout exists and requires an authenticated admin', () => {
  assert.match(controllerSource, /export async function handleAdminLogout/);
  const fn = controllerSource.slice(controllerSource.indexOf('export async function handleAdminLogout'));
  assert.match(fn, /if \(!admin\) throw unauthorized/);
});

test('D. handleAdminLogout bumps token_version (the actual revocation mechanism requireAdmin checks)', () => {
  const fn = controllerSource.slice(
    controllerSource.indexOf('export async function handleAdminLogout'),
    controllerSource.indexOf('export async function handleAdminLogout') + 1500
  );
  assert.match(fn, /token_version/);
  assert.match(fn, /\.update\(\{\s*token_version:\s*nextTokenVersion/);
});

test('E. handleAdminLogout writes an audit log entry with action "logout"', () => {
  const fn = controllerSource.slice(
    controllerSource.indexOf('export async function handleAdminLogout'),
    controllerSource.indexOf('export async function handleAdminLogout') + 2000
  );
  assert.match(fn, /action:\s*'logout'/);
});

test('F. POST /auth/logout is wired with requireAdmin', () => {
  assert.match(routesSource, /adminRouter\.post\(\s*'\/auth\/logout',\s*requireAdmin,\s*asyncHandler\(handleAdminLogout\)\)/);
});

test('G. a "logout" audit action is excluded from the staff-action notification spam, same as "login" (both are routine session events, not content changes)', () => {
  assert.match(auditSource, /input\.action !== 'login' && input\.action !== 'logout'/);
});
