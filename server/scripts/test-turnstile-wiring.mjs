/**
 * Regression tests for Phase 1 item 7's wiring: turnstile_token added to
 * contactSchema/newsletterSchema as optional (real enforcement is the
 * verifyTurnstile() network call, not the field's presence), and both
 * handleContact/handleNewsletter check the honeypot FIRST, then Turnstile,
 * before any persistence/email work — a bot caught by the honeypot never
 * triggers a real Cloudflare API call.
 *
 * Following this codebase's established convention of verifying
 * network-touching controller logic at the source level (see
 * test-admin-session-lifetime.mjs) rather than mocking fetch end-to-end
 * through the full controller (verifyTurnstile itself is unit-tested
 * directly in test-turnstile.mjs).
 *
 *   npx tsx --test scripts/test-turnstile-wiring.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { contactSchema, newsletterSchema } from '../src/validation/schemas.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contactSource = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
const newsletterSource = readFileSync(join(root, 'src/controllers/newsletter.controller.ts'), 'utf8');

/* --------------------------------------------------------- schema --- */

test('1. contactSchema accepts a submission with NO turnstile_token at all (not required — real enforcement is the network call)', () => {
  const result = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    reason: 'scheduling',
    consent: true,
  });
  assert.equal(result.success, true);
});

test('2. newsletterSchema accepts a submission with no turnstile_token', () => {
  const result = newsletterSchema.safeParse({ email: 'jane@example.com' });
  assert.equal(result.success, true);
});

test('3. an oversized turnstile_token is rejected (outer sanity bound, not the real check)', () => {
  const result = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    reason: 'scheduling',
    consent: true,
    turnstile_token: 'x'.repeat(3000),
  });
  assert.equal(result.success, false);
});

/* ------------------------------------------------------- handleContact --- */

test('4. handleContact checks the honeypot BEFORE calling verifyTurnstile', () => {
  const honeypotIndex = contactSource.indexOf("'company' in errors");
  const turnstileIndex = contactSource.indexOf('verifyTurnstile(');
  assert.ok(honeypotIndex >= 0 && turnstileIndex >= 0);
  assert.ok(honeypotIndex < turnstileIndex);
});

test('5. handleContact rejects with badRequest when verifyTurnstile returns false, before any persistence/email work', () => {
  const turnstileIndex = contactSource.indexOf('verifyTurnstile(');
  const storeLeadIndex = contactSource.indexOf('storeLead(');
  const sendIndex = contactSource.indexOf('sendContactNotification(');
  assert.ok(turnstileIndex >= 0 && storeLeadIndex >= 0 && sendIndex >= 0);
  assert.ok(turnstileIndex < storeLeadIndex);
  assert.ok(turnstileIndex < sendIndex);
  const branch = contactSource.slice(turnstileIndex, storeLeadIndex);
  assert.match(branch, /if \(!turnstile\.ok\)/);
  assert.match(branch, /throw badRequest\(/);
});

test('6. handleContact forwards req.ip to verifyTurnstile (so Cloudflare sees the real visitor IP, not this app\'s own)', () => {
  assert.match(contactSource, /verifyTurnstile\(parsed\.data\.turnstile_token,\s*req\.ip\)/);
});

/* ----------------------------------------------------- handleNewsletter --- */

test('7. handleNewsletter checks the honeypot BEFORE calling verifyTurnstile', () => {
  const honeypotIndex = newsletterSource.indexOf("'company' in errors");
  const turnstileIndex = newsletterSource.indexOf('verifyTurnstile(');
  assert.ok(honeypotIndex >= 0 && turnstileIndex >= 0);
  assert.ok(honeypotIndex < turnstileIndex);
});

test('8. handleNewsletter rejects with badRequest when verifyTurnstile returns false, before storeLead/subscribe', () => {
  const turnstileIndex = newsletterSource.indexOf('verifyTurnstile(');
  const storeLeadIndex = newsletterSource.indexOf('storeLead(');
  const subscribeIndex = newsletterSource.indexOf('await subscribe(');
  assert.ok(turnstileIndex >= 0 && storeLeadIndex >= 0 && subscribeIndex >= 0);
  assert.ok(turnstileIndex < storeLeadIndex);
  assert.ok(turnstileIndex < subscribeIndex);
  const branch = newsletterSource.slice(turnstileIndex, storeLeadIndex);
  assert.match(branch, /if \(!turnstile\.ok\)/);
  assert.match(branch, /throw badRequest\(/);
});
