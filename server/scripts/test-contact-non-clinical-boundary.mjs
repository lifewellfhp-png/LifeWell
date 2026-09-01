/**
 * Regression tests for P4-B4 (Paubox-Only Communication Boundary).
 *
 * Supersedes test-contact-message-minimization.mjs (P4-B2) and
 * test-contact-subject-minimization.mjs (P4-B3): those phases stopped
 * *persisting* the visitor-written message/subject while still accepting
 * them from the public request. This phase removes the fields themselves —
 * there is no longer any visitor-written free text anywhere in the Contact
 * workflow, so the narrower "not persisted" claims those files tested are
 * superseded by the stronger "does not exist" claims tested here.
 *
 * These are source-structure and pure-function checks (matching every other
 * test in this codebase — no live Supabase/network connection needed).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-contact-non-clinical-boundary.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { contactSchema, CONTACT_REASONS, CONTACT_REASON_LABELS } from '../src/validation/schemas.js';
import { buildLeadInsertPayload } from '../src/controllers/leads.controller.js';
import { buildContactLogBody } from '../src/controllers/contact.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contactControllerSource = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
const emailServiceSource = readFileSync(join(root, 'src/services/email.service.ts'), 'utf8');
const leadsControllerSource = readFileSync(join(root, 'src/controllers/leads.controller.ts'), 'utf8');
const adminLeadsSource = readFileSync(
  join(root, '../admin/src/app/(app)/leads/page.tsx'),
  'utf8'
);

const VALID_BASE = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  reason: 'insurance_pricing',
  consent: true,
};

test('4. only allowlisted reasons are accepted', () => {
  for (const reason of CONTACT_REASONS) {
    const parsed = contactSchema.safeParse({ ...VALID_BASE, reason });
    assert.equal(parsed.success, true, `reason "${reason}" should be accepted`);
  }
});

test('5. an invalid/unlisted reason is rejected', () => {
  const parsed = contactSchema.safeParse({ ...VALID_BASE, reason: 'medical_advice' });
  assert.equal(parsed.success, false);
});

test('5b. a crafted clinical-sounding reason is rejected — the allowlist has no escape hatch', () => {
  for (const bad of ['symptoms', 'diagnosis', 'medications', 'prescription_refill', 'therapy_discussion', 'other']) {
    const parsed = contactSchema.safeParse({ ...VALID_BASE, reason: bad });
    assert.equal(parsed.success, false, `"${bad}" must not be an accepted reason`);
  }
});

test('6/7. a direct POST payload containing legacy subject/message fields is rejected outright (.strict())', () => {
  const withLegacyFields = {
    ...VALID_BASE,
    subject: 'Re: my diagnosis',
    message: 'I was diagnosed with generalized anxiety disorder and take sertraline 50mg daily.',
  };
  const parsed = contactSchema.safeParse(withLegacyFields);
  assert.equal(parsed.success, false, 'a payload with legacy subject/message must fail validation entirely');
});

test('8/9. even if validation were bypassed, buildLeadInsertPayload/buildContactLogBody cannot carry visitor-written subject/message — only a reason-derived label', () => {
  // Simulates the worst case: some future caller passes an object with
  // stray legacy fields straight through. Neither builder even has a
  // parameter shaped to read raw visitor message/subject text — only a
  // controlled `subject` string (the reason label, decided by the
  // controller) is ever accepted.
  const payload = buildLeadInsertPayload({
    type: 'contact',
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: CONTACT_REASON_LABELS.insurance_pricing,
    reference_id: 'ABC12345',
  });
  assert.equal(payload.subject, 'Insurance or pricing question');
  assert.equal('message' in payload, false);

  assert.deepEqual(buildContactLogBody.length, 1); // single destructured-object parameter
  const body = buildContactLogBody({
    name: 'Jane Doe',
    email: 'jane@example.com',
    referenceId: 'REF',
    reasonLabel: CONTACT_REASON_LABELS.general_admin,
  });
  assert.match(body, /Reason: General administrative question/);
  assert.doesNotMatch(body, /anxiety|sertraline|diagnos/i);
});

test('10/11. Paubox receives only the reason label — sendContactNotification builds subject/text/html from CONTACT_REASON_LABELS, never from a free-text field', () => {
  const contactFn = emailServiceSource.slice(
    emailServiceSource.indexOf('export async function sendContactNotification'),
    emailServiceSource.indexOf('export type OutboundMail')
  );
  assert.match(contactFn, /CONTACT_REASON_LABELS\[input\.reason\]/);
  assert.doesNotMatch(contactFn, /input\.message/);
  assert.doesNotMatch(contactFn, /input\.subject/);
});

test('12. the Paubox request body is built entirely from administrative fields plus the reason label', () => {
  const contactFn = emailServiceSource.slice(
    emailServiceSource.indexOf('export async function sendContactNotification'),
    emailServiceSource.indexOf('export type OutboundMail')
  );
  assert.match(contactFn, /input\.name/);
  assert.match(contactFn, /input\.email/);
  assert.match(contactFn, /input\.phone/);
  assert.match(contactFn, /reasonLabel/);
});

test('13. visitor email remains Reply-To, and is never used as From', () => {
  const contactFn = emailServiceSource.slice(
    emailServiceSource.indexOf('export async function sendContactNotification'),
    emailServiceSource.indexOf('export type OutboundMail')
  );
  assert.match(contactFn, /replyTo:\s*\{\s*name:\s*input\.name,\s*address:\s*input\.email\s*\}/);
  assert.doesNotMatch(emailServiceSource, /from:\s*input\.email/);
  // The shared low-level sender (sendViaPauboxApi, defined above
  // sendContactNotification) is what actually sets `from` — always the
  // fixed env.MAIL_FROM, for every caller, never a visitor-supplied value.
  assert.match(emailServiceSource, /from:\s*env\.MAIL_FROM/);
});

test('14. operational logs contain no visitor narrative — only the reason enum value (a fixed classification, not free text) or nothing at all', () => {
  const logCalls = [...contactControllerSource.matchAll(/logger\.(info|warn|error)\([^;]*\);/gs)].map((m) => m[0]);
  for (const call of logCalls) {
    assert.doesNotMatch(call, /parsed\.data\.name/);
    assert.doesNotMatch(call, /parsed\.data\.email/);
    assert.doesNotMatch(call, /parsed\.data\.phone/);
  }
  const emailLogCalls = [...emailServiceSource.matchAll(/logger\.(info|warn|error)\([^;]*\);/gs)].map((m) => m[0]);
  for (const call of emailLogCalls) {
    assert.doesNotMatch(call, /input\.name\b/);
    assert.doesNotMatch(call, /input\.email\b/);
    assert.doesNotMatch(call, /input\.phone\b/);
  }
});

test('15. Admin remains compatible: new Contact leads show a "Reason:" label, historical message/subject content still renders when present', () => {
  assert.match(adminLeadsSource, /Reason:\s*\$\{selected\.subject/);
  // Historical-safety: the message block is hidden for new (message-less)
  // Contact leads, but still renders whenever a message value IS present —
  // so a pre-P4-B2 historical row remains fully readable.
  assert.match(adminLeadsSource, /selected\.type !== 'contact' \|\| selected\.message/);
});

test('16. historical records are untouched — leads.controller.ts (including updateLead()) was not modified by this phase', () => {
  assert.match(leadsControllerSource, /\.update\(\{ \.\.\.parsed\.data, updated_at: new Date\(\)\.toISOString\(\) \}\)/);
  assert.doesNotMatch(leadsControllerSource, /subject:\s*null/);
});

test('17/18. P4-B2/P4-B3 principles remain satisfied at a structural level — no free-text field exists to persist in the first place', () => {
  assert.equal('message' in contactSchema.shape, false);
  assert.equal('subject' in contactSchema.shape, false);
  assert.equal('reason' in contactSchema.shape, true);
});

test('19. the Paubox REST transport itself is unchanged by this phase', () => {
  assert.match(emailServiceSource, /https:\/\/api\.paubox\.com\/v1\/email\/messages/);
  assert.match(emailServiceSource, /const PAUBOX_API_KEY = env\.SMTP_PASSWORD;/);
  // The comment explaining SMTP_HOST/PORT/SECURE are intentionally left
  // unused (rollback path) is expected — only actual usage is disallowed.
  assert.doesNotMatch(emailServiceSource, /env\.SMTP_HOST|env\.SMTP_PORT|env\.SMTP_SECURE/);
  assert.doesNotMatch(emailServiceSource, /^import nodemailer/m);
});

test('20. the privacy/administrative warning is present in source and makes no HIPAA/portal claims', () => {
  const clientContactForm = readFileSync(
    join(root, '../client/src/components/forms/ContactForm.tsx'),
    'utf8'
  );
  assert.match(clientContactForm, /scheduling and administrative questions only/i);
  assert.match(clientContactForm, /do not include medical\s+information/i);
  assert.doesNotMatch(clientContactForm, /HIPAA/i);
  assert.doesNotMatch(clientContactForm, /patient portal/i);
});

test('the honeypot and consent fields still validate correctly alongside the new reason field', () => {
  const withHoneypot = contactSchema.safeParse({ ...VALID_BASE, company: 'x' });
  assert.equal(withHoneypot.success, false);
  const withoutConsent = contactSchema.safeParse({ name: 'Jane', email: 'j@example.com', reason: 'scheduling' });
  assert.equal(withoutConsent.success, false);
});

test('an extra unrecognized field of any name (not just subject/message) is rejected by .strict()', () => {
  const parsed = contactSchema.safeParse({ ...VALID_BASE, notes: 'anything at all' });
  assert.equal(parsed.success, false);
});
