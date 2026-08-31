/**
 * Regression tests for P4-D5 (Paubox REST Email API migration).
 *
 * Repeated production SMTP tests (P4-D4) could not be confirmed as reaching
 * an external mailbox or the Paubox Mail Log despite Nodemailer resolving
 * cleanly, so outbound mail moved from SMTP/Nodemailer to Paubox's REST
 * Email API (https://api.paubox.com/v1/email/messages). This supersedes
 * test-contact-email-delivery-hardening.mjs (P4-D4), whose assertions
 * checked SMTP/Nodemailer-specific implementation details that no longer
 * apply.
 *
 * These are source-structure checks (matching every other test in this
 * codebase — no live network call, no real send, no real API key needed).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-paubox-rest-api-migration.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { contactSchema } from '../src/validation/schemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/services/email.service.ts'), 'utf8');

function slice(fnStart, fnEnd) {
  const start = source.indexOf(fnStart);
  assert.ok(start > -1, `expected to find "${fnStart}"`);
  const end = fnEnd ? source.indexOf(fnEnd, start) : source.length;
  return source.slice(start, end === -1 ? undefined : end);
}

test('nodemailer is no longer imported or called in this file', () => {
  assert.doesNotMatch(source, /^import nodemailer/m);
  assert.doesNotMatch(source, /nodemailer\.\w+\(/);
});

test('exactly one shared Paubox REST transport function exists, used by both Contact and Admin paths', () => {
  const sendCalls = (source.match(/sendViaPauboxApi\(/g) || []).length;
  // 1 definition + 2 call sites (Contact, Admin outbound).
  assert.equal(sendCalls, 3, 'expected exactly one shared send function definition plus two call sites');
});

test('1. Contact REST request uses the LifeWell MAIL_FROM identity, not a visitor-supplied value', () => {
  const contactFn = slice('export async function sendContactNotification', 'export type OutboundMail');
  assert.doesNotMatch(contactFn, /from:\s*input\.email/);
  const sharedFn = slice('async function sendViaPauboxApi', 'export async function sendContactNotification');
  assert.match(sharedFn, /from:\s*env\.MAIL_FROM/);
});

test('2. Contact resolves the correct practice To address via resolveInboxEmail(), unchanged', () => {
  assert.match(source, /const inbox = await resolveInboxEmail\(\);/);
  const contactFn = slice('export async function sendContactNotification', 'export type OutboundMail');
  assert.match(contactFn, /to:\s*\{\s*address:\s*inbox\s*\}/);
});

test('3. Contact Reply-To uses a structured address object built from the already-validated visitor name/email', () => {
  const contactFn = slice('export async function sendContactNotification', 'export type OutboundMail');
  assert.match(contactFn, /replyTo:\s*\{\s*name:\s*input\.name,\s*address:\s*input\.email\s*\}/);
});

test('4. The visitor email is never used as From anywhere in this file', () => {
  assert.doesNotMatch(source, /from:\s*input\.email/);
  assert.doesNotMatch(source, /from:\s*`.*\$\{input\.email\}/);
});

test('5. Admin outbound mail uses the same shared Paubox REST transport as Contact', () => {
  const outboundFn = slice('export async function sendOutboundMail');
  assert.match(outboundFn, /await sendViaPauboxApi\(\{/);
});

test('6. the Contact message is used only transiently in the request body — no persistence call in this file', () => {
  assert.doesNotMatch(source, /\.from\('leads'\)/);
  assert.doesNotMatch(source, /\.from\('email_messages'\)/);
  assert.doesNotMatch(source, /\.insert\(/);
});

test('7. leads.message remains non-persisted (P4-B2, structurally unaffected by the transport change)', () => {
  const leadsSource = readFileSync(join(root, 'src/controllers/leads.controller.ts'), 'utf8');
  assert.doesNotMatch(leadsSource, /message:\s*input\.message/);
});

test('8. email_messages.body minimization remains intact (P4-B2, structurally unaffected by the transport change)', () => {
  const contactControllerSource = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
  assert.match(contactControllerSource, /not stored here/i);
});

test('9. the Paubox API key never enters any log call in this file', () => {
  const logCalls = source.match(/logger\.(info|warn|error)\([^;]*\);/gs) || [];
  assert.ok(logCalls.length > 0);
  for (const call of logCalls) {
    assert.doesNotMatch(call, /PAUBOX_API_KEY/);
    assert.doesNotMatch(call, /SMTP_PASSWORD/);
  }
});

test('10. the Authorization header is built once, at the fetch call site, and never logged', () => {
  const authUsages = source.match(/Authorization:/g) || [];
  assert.equal(authUsages.length, 1, 'Authorization header should be constructed in exactly one place');
  const logCalls = source.match(/logger\.(info|warn|error)\([^;]*\);/gs) || [];
  for (const call of logCalls) {
    assert.doesNotMatch(call, /Authorization/);
    assert.doesNotMatch(call, /Bearer/);
  }
});

test('11. a success response parses the Paubox sourceTrackingId and surfaces httpStatus, not the raw body', () => {
  const sharedFn = slice('async function sendViaPauboxApi');
  assert.match(sharedFn, /sourceTrackingId/);
  assert.match(sharedFn, /res\.ok/);
  assert.match(sharedFn, /res\.status/);
  const contactSuccessLog = slice("logger.info('Contact notification accepted by Paubox Email API'", '});');
  assert.match(contactSuccessLog, /httpStatus: result\.httpStatus/);
  assert.match(contactSuccessLog, /sourceTrackingId: result\.sourceTrackingId/);
});

test('12-14. HTTP error responses (401/403/422/429/5xx) are all normalized to { ok: false, httpStatus, errorMessage } without ever including the raw response body', () => {
  const sharedFn = slice('async function sendViaPauboxApi');
  assert.match(sharedFn, /ok:\s*res\.ok/);
  assert.match(sharedFn, /errorMessage:\s*res\.ok\s*\?\s*undefined\s*:\s*`Paubox API responded \$\{res\.status\}`/);
  // The raw response body is only ever read to extract sourceTrackingId — it
  // is never assigned to errorMessage or otherwise logged wholesale.
  assert.doesNotMatch(sharedFn, /errorMessage:\s*body/);
  assert.doesNotMatch(sharedFn, /errorMessage:\s*await res\.text\(\)/);
});

test('15. a network/timeout failure is caught inside the shared function and normalized, never left to throw an unhandled rejection', () => {
  const sharedFn = slice('async function sendViaPauboxApi');
  assert.match(sharedFn, /new AbortController\(\)/);
  assert.match(sharedFn, /setTimeout\(\(\) => controller\.abort\(\), PAUBOX_TIMEOUT_MS\)/);
  assert.match(sharedFn, /catch \(error\) \{/);
  assert.match(sharedFn, /timedOut/);
  assert.match(sharedFn, /'Paubox API network error'/);
});

test('16. no PHI/personal content (message, name, email, phone) is passed to any logger call in this file', () => {
  const logCalls = source.match(/logger\.(info|warn|error)\([^;]*\);/gs) || [];
  assert.ok(logCalls.length > 0);
  for (const call of logCalls) {
    // input.message.length (a number) is safe, established metadata — only
    // the raw field itself would leak content.
    assert.doesNotMatch(call, /input\.message(?!\.length)/);
    assert.doesNotMatch(call, /input\.name\b/);
    assert.doesNotMatch(call, /input\.email\b/);
    assert.doesNotMatch(call, /input\.phone\b/);
  }
});

test('SMTP failure behavior is preserved: Contact still throws on failure, still logs only a sanitized reason', () => {
  const contactFn = slice('export async function sendContactNotification', 'export type OutboundMail');
  assert.match(contactFn, /logger\.error\('Contact notification failed', \{/);
  assert.match(contactFn, /throw serverError\('Unable to deliver the message'\);/);
});

test('unconfigured behavior is preserved: production still throws rather than silently degrading', () => {
  const contactFn = slice('export async function sendContactNotification', 'export type OutboundMail');
  assert.match(contactFn, /if \(isProduction\) \{\s*throw serverError\('Mail transport is not configured'\);/);
});

test('the API key is reused from SMTP_PASSWORD — no new secret was introduced', () => {
  assert.match(source, /const PAUBOX_API_KEY = env\.SMTP_PASSWORD;/);
  assert.doesNotMatch(source, /PAUBOX_API_KEY:/); // not read as a distinct env schema field
});

test('the endpoint is the documented Paubox REST Email API URL', () => {
  assert.match(source, /https:\/\/api\.paubox\.com\/v1\/email\/messages/);
});

test('contactSchema still strips control characters from name, protecting the Reply-To header construction', () => {
  const attempt = 'Evil\r\nBcc: attacker@example.com';
  const parsed = contactSchema.safeParse({
    name: attempt,
    email: 'visitor@example.com',
    message: 'A message long enough to pass the minimum length check.',
    consent: true,
  });
  assert.equal(parsed.success, true);
  assert.doesNotMatch(parsed.data.name, /[\r\n]/);
});
