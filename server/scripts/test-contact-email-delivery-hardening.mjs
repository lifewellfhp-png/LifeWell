/**
 * Regression tests for P4-D4's Contact email delivery correction.
 *
 * Scope: this phase captures previously-discarded Nodemailer SMTP-acceptance
 * metadata (non-sensitive: messageId, recipient counts, provider response
 * text) for both the Contact and Admin-outbound mail paths, and hardens the
 * Contact path's Reply-To construction to use Nodemailer's structured
 * address object instead of a manually-composed string. It does NOT change
 * From, To, the transporter, or any P4-B2 minimization behavior.
 *
 * These are source-structure checks (matching every other test in this
 * codebase — no live SMTP connection, no real send).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-contact-email-delivery-hardening.mjs
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

test('1. Contact and Admin outbound mail still share the same transporter — no separate transport creation was added', () => {
  const createTransportCalls = (source.match(/nodemailer\.createTransport\(/g) || []).length;
  assert.equal(createTransportCalls, 1, 'exactly one transporter should be created, shared by both paths');
  assert.match(source, /function sendContactNotification[\s\S]*?getTransporter\(\)/);
  assert.match(source, /function sendOutboundMail[\s\S]*?getTransporter\(\)/);
});

test('2. Contact From remains env.MAIL_FROM, unchanged', () => {
  const contactFn = source.slice(source.indexOf('export async function sendContactNotification'));
  assert.match(contactFn, /from: env\.MAIL_FROM,/);
});

test('3. Contact To still resolves to the configured LifeWell inbox (resolveInboxEmail), not a hardcoded or visitor-supplied address', () => {
  assert.match(source, /const inbox = await resolveInboxEmail\(\);/);
  const contactFn = source.slice(
    source.indexOf('export async function sendContactNotification'),
    source.indexOf('export type OutboundMail')
  );
  assert.match(contactFn, /to: inbox,/);
});

test('4. The visitor-submitted email is never used as the From address', () => {
  const contactFn = source.slice(
    source.indexOf('export async function sendContactNotification'),
    source.indexOf('export type OutboundMail')
  );
  assert.doesNotMatch(contactFn, /from:\s*input\.email/);
  assert.doesNotMatch(contactFn, /from:\s*`.*\$\{input\.email\}/);
});

test('5. Reply-To now uses a structured Nodemailer address object, not a manually-composed header string', () => {
  assert.match(source, /replyTo:\s*\{\s*name:\s*input\.name,\s*address:\s*input\.email\s*\}/);
  assert.doesNotMatch(source, /replyTo:\s*`\$\{input\.name\}\s*<\$\{input\.email\}>`/);
});

test('6. contactSchema strips control characters (including CR/LF) from name, so a header-injection attempt in the Reply-To display name cannot survive validation', () => {
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

test("6b. contactSchema's email validation rejects a value shaped like a header-injection attempt", () => {
  const parsed = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'visitor@example.com\r\nBcc: attacker@example.com',
    message: 'A message long enough to pass the minimum length check.',
    consent: true,
  });
  assert.equal(parsed.success, false);
});

test('7. P4-B2 free-text minimization is untouched by this phase', () => {
  const leadsSource = readFileSync(join(root, 'src/controllers/leads.controller.ts'), 'utf8');
  const contactControllerSource = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
  assert.doesNotMatch(leadsSource, /message:\s*input\.message/);
  assert.match(contactControllerSource, /not stored here/i);
});

test('8. the SMTP-acceptance success log never includes Contact message/name/email/phone/subject content', () => {
  const logCallStart = source.indexOf("logger.info('Contact notification accepted by SMTP'");
  assert.ok(logCallStart > -1, 'expected the renamed success log call to exist');
  const logCallEnd = source.indexOf('});', logCallStart);
  const logCall = source.slice(logCallStart, logCallEnd);
  assert.doesNotMatch(logCall, /input\.message/);
  assert.doesNotMatch(logCall, /input\.name/);
  assert.doesNotMatch(logCall, /input\.email/);
  assert.doesNotMatch(logCall, /input\.phone/);
  assert.doesNotMatch(logCall, /\btext\b/);
  assert.doesNotMatch(logCall, /\bhtml\b/);
  assert.match(logCall, /messageId: info\.messageId/);
  assert.match(logCall, /acceptedCount: info\.accepted/);
  assert.match(logCall, /rejectedCount: info\.rejected/);
});

test('8b. the success log no longer overclaims final delivery — renamed away from "delivered"', () => {
  assert.doesNotMatch(source, /logger\.info\('Contact notification delivered'/);
  assert.match(source, /logger\.info\('Contact notification accepted by SMTP'/);
});

test('9. SMTP rejection/error behavior is unchanged — Contact still throws, still logs only a sanitized reason', () => {
  const contactFn = source.slice(
    source.indexOf('export async function sendContactNotification'),
    source.indexOf('export type OutboundMail')
  );
  assert.match(contactFn, /logger\.error\('Contact notification failed', \{/);
  assert.match(contactFn, /reason: error instanceof Error \? error\.message : 'unknown'/);
  assert.match(contactFn, /throw serverError\('Unable to deliver the message'\);/);
});

test('10. no API key or SMTP password can enter any log call in this file', () => {
  const logCalls = source.match(/logger\.(info|warn|error)\([^;]*\);/gs) || [];
  assert.ok(logCalls.length > 0, 'expected at least one logger call to inspect');
  for (const call of logCalls) {
    assert.doesNotMatch(call, /SMTP_PASSWORD/);
    assert.doesNotMatch(call, /SMTP_USER/);
    assert.doesNotMatch(call, /\bauth\b/);
    assert.doesNotMatch(call, /env\.SMTP_PASSWORD|env\.SMTP_USER/);
  }
});

test('11. Admin outbound mail gained the same diagnostic logging, without changing its existing failure-path shape', () => {
  const outboundFn = source.slice(source.indexOf('export async function sendOutboundMail'));
  assert.match(outboundFn, /logger\.info\('Outbound mail accepted by SMTP', \{/);
  assert.match(outboundFn, /logger\.warn\('Outbound mail skipped', \{ to: input\.to, reason: error \}\);/);
  assert.match(outboundFn, /logger\.error\('Outbound mail failed', \{ to: input\.to, reason: message \}\);/);
});
