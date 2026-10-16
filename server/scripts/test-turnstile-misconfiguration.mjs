/**
 * Regression tests for the "secret misconfigured, not a failed bot check"
 * distinction added to Phase 1 item 7 before merge: if Cloudflare's
 * response says the secret itself is wrong (missing-input-secret /
 * invalid-input-secret), the submission is still accepted (it's OUR bug,
 * not the visitor's), AND an admin_audit_logs entry is written so an
 * operator actually notices — distinct from both a genuine bot-check
 * rejection (still blocked) and a network/outage error (accepted silently,
 * no audit entry, since there's nothing actionable to fix on our end).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     TURNSTILE_SECRET_KEY=test-turnstile-secret \
 *     npx tsx --test scripts/test-turnstile-misconfiguration.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

process.env.ADMIN_JWT_SECRET ??= 'test-only-admin-jwt-secret-not-for-production-000000';
process.env.TURNSTILE_SECRET_KEY ??= 'test-turnstile-secret';

const { verifyTurnstile } = await import('../src/lib/turnstile.ts');

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contactSource = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
const newsletterSource = readFileSync(join(root, 'src/controllers/newsletter.controller.ts'), 'utf8');

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

function stubFetch(impl) {
  globalThis.fetch = async (url, init) => impl(url, init);
}

/* ------------------------------------------------------- verifyTurnstile --- */

test('1. invalid-input-secret is accepted (ok: true) and flagged misconfigured', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-secret'] }), { status: 200 }));
  const result = await verifyTurnstile('any-token');
  assert.equal(result.ok, true);
  assert.equal(result.misconfigured, true);
  assert.deepEqual(result.errorCodes, ['invalid-input-secret']);
});

test('2. missing-input-secret is also treated as misconfigured', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['missing-input-secret'] }), { status: 200 }));
  const result = await verifyTurnstile('any-token');
  assert.equal(result.ok, true);
  assert.equal(result.misconfigured, true);
});

test('3. a genuine token-side error code (e.g. timeout-or-duplicate) is NOT treated as misconfigured, and still rejects', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['timeout-or-duplicate'] }), { status: 200 }));
  const result = await verifyTurnstile('replayed-token');
  assert.equal(result.ok, false);
  assert.equal(result.misconfigured, undefined);
});

test('4. a response with BOTH a misconfiguration code and a token-side code is still flagged misconfigured (our bug takes priority — can\'t trust a bot-check result from a verify call that was itself malformed)', async () => {
  stubFetch(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-secret', 'invalid-input-response'] }), { status: 200 }));
  const result = await verifyTurnstile('any-token');
  assert.equal(result.ok, true);
  assert.equal(result.misconfigured, true);
});

/* ------------------------------------------------------- controller wiring --- */

function sliceFn(source, name) {
  const marker = `export async function ${name}`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `${name} must exist`);
  const next = source.indexOf('export async function', start + marker.length);
  return source.slice(start, next >= 0 ? next : source.length);
}

test('5. handleContact writes an audit log entry when Turnstile reports misconfigured, before the ok check', () => {
  const fn = sliceFn(contactSource, 'handleContact');
  const misconfigIndex = fn.indexOf('if (turnstile.misconfigured)');
  const auditIndex = fn.indexOf('writeAuditLog(', misconfigIndex);
  const okCheckIndex = fn.indexOf('if (!turnstile.ok)');
  assert.ok(misconfigIndex >= 0 && auditIndex >= 0 && okCheckIndex >= 0);
  assert.ok(misconfigIndex < auditIndex && auditIndex < okCheckIndex);
  const block = fn.slice(misconfigIndex, okCheckIndex);
  assert.match(block, /action:\s*'turnstile_misconfigured'/);
  assert.match(block, /resource:\s*'turnstile'/);
  assert.match(block, /errorCodes:\s*turnstile\.errorCodes/);
});

test('6. handleNewsletter writes the same audit log entry on misconfiguration', () => {
  const fn = sliceFn(newsletterSource, 'handleNewsletter');
  const misconfigIndex = fn.indexOf('if (turnstile.misconfigured)');
  const auditIndex = fn.indexOf('writeAuditLog(', misconfigIndex);
  const okCheckIndex = fn.indexOf('if (!turnstile.ok)');
  assert.ok(misconfigIndex >= 0 && auditIndex >= 0 && okCheckIndex >= 0);
  assert.ok(misconfigIndex < auditIndex && auditIndex < okCheckIndex);
  const block = fn.slice(misconfigIndex, okCheckIndex);
  assert.match(block, /action:\s*'turnstile_misconfigured'/);
  assert.match(block, /resource:\s*'turnstile'/);
});

test('7. the misconfiguration audit entry never includes the raw submitted token (naming the env var to fix, e.g. "TURNSTILE_SECRET_KEY", is a helpful hint, not a leak — only the actual secret/token VALUES must never appear)', () => {
  for (const source of [contactSource, newsletterSource]) {
    const misconfigStart = source.indexOf('if (turnstile.misconfigured)');
    const callEnd = source.indexOf('});', misconfigStart) + '});'.length;
    const block = source.slice(misconfigStart, callEnd);
    assert.doesNotMatch(block, /parsed\.data\.turnstile_token/);
    assert.doesNotMatch(block, /env\.TURNSTILE_SECRET_KEY/);
  }
});
