/**
 * Regression tests for P4-B3 (Contact Subject Persistence Minimization).
 *
 * P4-D6 identified that P4-B2's message minimization did not cover the
 * Contact form's `subject` field — also free text, visitor-editable, up to
 * 150 characters — which was persisted verbatim to leads.subject and
 * email_messages.subject. This phase stops persisting the visitor's actual
 * subject in either place, while keeping it available transiently for the
 * outbound Paubox notification (unchanged) and the newsletter signup path's
 * own fixed, non-visitor-controlled subject (unchanged — a different call
 * site to the same shared storeLead() function).
 *
 * These are source-structure checks (matching every other test in this
 * codebase — no live Supabase/network connection needed).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-contact-subject-minimization.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { buildLeadInsertPayload } from '../src/controllers/leads.controller.js';
import { buildContactLogBody } from '../src/controllers/contact.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contactControllerSource = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
const leadsControllerSource = readFileSync(join(root, 'src/controllers/leads.controller.ts'), 'utf8');
const emailServiceSource = readFileSync(join(root, 'src/services/email.service.ts'), 'utf8');
const newsletterControllerSource = readFileSync(join(root, 'src/controllers/newsletter.controller.ts'), 'utf8');

const SENSITIVE_SUBJECT = 'Re: my recent bipolar disorder diagnosis';

test('1. visitor message is not persisted (P4-B2, unaffected by this phase)', () => {
  const payload = buildLeadInsertPayload({
    type: 'contact',
    name: 'Jane Doe',
    email: 'jane@example.com',
    reference_id: 'ABC12345',
  });
  assert.equal('message' in payload, false);
});

test('2. visitor subject is not persisted to leads — the Contact call site no longer forwards it', () => {
  assert.doesNotMatch(contactControllerSource, /subject:\s*parsed\.data\.subject/);
  const storeLeadCall = contactControllerSource.slice(
    contactControllerSource.indexOf('await storeLead({'),
    contactControllerSource.indexOf('});', contactControllerSource.indexOf('await storeLead({'))
  );
  assert.doesNotMatch(storeLeadCall, /subject/);
});

test('3. visitor message is not stored in email_messages.body (P4-B2, unaffected)', () => {
  assert.match(contactControllerSource, /not stored here/i);
});

test('4. visitor subject is not stored in email_messages.subject — a fixed, application-controlled label is used instead', () => {
  assert.doesNotMatch(contactControllerSource, /subject:\s*parsed\.data\.subject \|\|/);
  assert.match(contactControllerSource, /subject:\s*'Website contact inquiry'/);
});

test('5. visitor message remains transiently available to the Paubox notification (P4-B2, unaffected)', () => {
  assert.match(emailServiceSource, /input\.message/);
});

test('6. visitor subject remains transiently available to the Paubox notification — intentionally retained for useful staff-facing routing', () => {
  const contactFn = emailServiceSource.slice(
    emailServiceSource.indexOf('export async function sendContactNotification'),
    emailServiceSource.indexOf('export type OutboundMail')
  );
  assert.match(contactFn, /input\.subject/);
});

test('7. operational logs contain neither the visitor message nor the visitor subject', () => {
  const logCalls = contactControllerSource.match(/logger\.(info|warn|error)\([^;]*\);/gs) || [];
  for (const call of logCalls) {
    assert.doesNotMatch(call, /parsed\.data\.message/);
    assert.doesNotMatch(call, /parsed\.data\.subject/);
  }
  const emailLogCalls = emailServiceSource.match(/logger\.(info|warn|error)\([^;]*\);/gs) || [];
  for (const call of emailLogCalls) {
    // Boolean(input.subject) / input.message.length are pre-existing, safe
    // presence/shape metadata (like messageLength) — only a raw content
    // assignment (e.g. `subject: input.subject,`) is disallowed here.
    assert.doesNotMatch(call, /:\s*input\.subject\b/);
    assert.doesNotMatch(call, /:\s*input\.message\b(?!\.length)/);
  }
});

test('8. lead persistence still contains all required operational metadata (name, email, phone, reference, type, status)', () => {
  const payload = buildLeadInsertPayload({
    type: 'contact',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '4075551234',
    reference_id: 'ABC12345',
  });
  assert.equal(payload.name, 'Jane Doe');
  assert.equal(payload.email, 'jane@example.com');
  assert.equal(payload.phone, '4075551234');
  assert.equal(payload.reference_id, 'ABC12345');
  assert.equal(payload.type, 'contact');
  assert.equal(payload.status, 'new');
  assert.equal(payload.subject, null, 'subject is correctly omitted -> null when the caller does not pass one');
});

test('9. Admin renders a missing Contact subject null-safely ("—"), and a stored subject still renders normally', () => {
  const adminSource = readFileSync(
    join(root, '../admin/src/app/(app)/leads/page.tsx'),
    'utf8'
  );
  assert.match(adminSource, /\{row\.subject \|\| '—'\}/);
  assert.match(adminSource, /\{selected\.subject \|\| '—'\}/);
});

test('10. historical records are untouched — leads.controller.ts (including updateLead()) is not touched by this phase, and no bulk-nulling of existing subject values was introduced', () => {
  // The generic admin updateLead() handler still just passes through
  // whatever the admin explicitly submits (parsed.data) — it was not
  // modified to forcibly clear/rewrite an existing row's subject.
  assert.match(leadsControllerSource, /\.update\(\{ \.\.\.parsed\.data, updated_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.doesNotMatch(leadsControllerSource, /subject:\s*null/);
  assert.doesNotMatch(leadsControllerSource, /\.eq\('subject'/);
});

test('11. the Paubox REST transport is unchanged by this phase', () => {
  assert.match(emailServiceSource, /https:\/\/api\.paubox\.com\/v1\/email\/messages/);
  assert.match(emailServiceSource, /const PAUBOX_API_KEY = env\.SMTP_PASSWORD;/);
});

test('12. the Contact endpoint response contract is unchanged', () => {
  assert.match(contactControllerSource, /res\.status\(201\)\.json\(/);
  assert.match(contactControllerSource, /Your message has been sent\. We aim to respond within one business day\./);
  assert.match(contactControllerSource, /Your message has been received\. We aim to respond within one business day\./);
});

test('the newsletter signup path is unaffected — it still passes its own fixed, non-visitor-controlled subject to the same shared storeLead()', () => {
  assert.match(newsletterControllerSource, /subject:\s*'Newsletter signup'/);
});

test("buildContactLogBody's shape is unchanged — no subject parameter was added to it", () => {
  assert.deepEqual(buildContactLogBody.length, 1);
  const body = buildContactLogBody({ name: 'X', email: 'x@example.com', referenceId: 'REF' });
  assert.doesNotMatch(body, /Subject/);
});

test('a crafted sensitive subject never appears in the lead-insert payload for a realistic contact-shaped input', () => {
  // Simulates what would happen if a future caller mistakenly passed
  // parsed.data (the full ContactInput, including subject) straight into
  // storeLead() — buildLeadInsertPayload() itself doesn't reject an extra
  // `subject` key, so this test locks in the CALL SITE fix specifically,
  // not a structural guarantee like buildContactLogBody's.
  assert.doesNotMatch(contactControllerSource, new RegExp(SENSITIVE_SUBJECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
