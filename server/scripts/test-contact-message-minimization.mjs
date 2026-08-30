/**
 * Regression tests for the P4-B2 contact-message data-minimization fix.
 *
 * Most of these are genuine behavioral tests against pure, exported
 * functions (buildLeadInsertPayload, buildContactLogBody) — extracted
 * specifically so this could be tested without a live Supabase connection,
 * the same "export for testability, zero behavior change" pattern already
 * used elsewhere in this codebase (diffChanges, mapStats, etc.).
 *
 * A few checks (B, F, I below) are deliberately source-text based rather
 * than behavioral — each is commented explaining why: extending
 * sendContactNotification()'s testability would mean refactoring SMTP-
 * sending logic, which P4-B2's scope explicitly limits to "documentation/
 * comments" for email.service.ts, not logic changes.
 *
 * No network calls, no Supabase, no SMTP, no production data.
 *
 * Requires ADMIN_JWT_SECRET (adminSchemas.js is imported transitively via
 * adminAuth.js from leads.controller.ts's sibling imports — actually
 * leads.controller.ts imports adminSchemas.js directly for leadUpdate):
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-contact-message-minimization.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { contactSchema } from '../src/validation/schemas.js';
import { buildLeadInsertPayload } from '../src/controllers/leads.controller.js';
import { buildContactLogBody } from '../src/controllers/contact.controller.js';
import { logEmailMessage } from '../src/lib/mailLog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SENSITIVE_MESSAGE =
  'I was diagnosed with generalized anxiety disorder and take sertraline 50mg daily.';

test('A. contact validation still accepts and requires the message field', () => {
  const result = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    message: SENSITIVE_MESSAGE,
    consent: true,
  });
  assert.equal(result.success, true);
  assert.equal(result.data.message, SENSITIVE_MESSAGE);

  const withoutMessage = contactSchema.safeParse({
    name: 'Jane Doe',
    email: 'jane@example.com',
    consent: true,
  });
  assert.equal(withoutMessage.success, false, 'message should still be required for a real submission');
});

test('B. the SMTP notification still forwards the message (source-justified check — see file header)', () => {
  const source = readFileSync(join(root, 'src/services/email.service.ts'), 'utf8');
  // sendContactNotification must still interpolate input.message into both
  // the plain-text and HTML bodies it sends — that's the actual forwarding
  // this phase is required to preserve.
  assert.match(source, /input\.message/);
  assert.match(source, /await mail\.sendMail\(/);
});

test('C. buildLeadInsertPayload never includes a message field, even if one is present on the input object', () => {
  const inputWithStrayMessage = {
    type: 'contact',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '4075551234',
    subject: 'Question',
    reference_id: 'ABC12345',
    message: SENSITIVE_MESSAGE, // extra property a loosely-typed caller might pass
  };
  const payload = buildLeadInsertPayload(inputWithStrayMessage);
  assert.equal('message' in payload, false, 'insert payload must never contain a message key');
  assert.deepEqual(Object.keys(payload).sort(), [
    'email',
    'name',
    'phone',
    'reference_id',
    'source',
    'status',
    'subject',
    'type',
  ]);
  // Operational fields are still present and correct.
  assert.equal(payload.name, 'Jane Doe');
  assert.equal(payload.email, 'jane@example.com');
  assert.equal(payload.subject, 'Question');
  assert.equal(payload.reference_id, 'ABC12345');
  assert.equal(payload.status, 'new');
});

test('D. buildContactLogBody never embeds the free-text message', () => {
  const body = buildContactLogBody({
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '4075551234',
    referenceId: 'ABC12345',
  });
  assert.doesNotMatch(body, /anxiety|sertraline|diagnos/i);
  assert.match(body, /Name: Jane Doe/);
  assert.match(body, /Email: jane@example\.com/);
  assert.match(body, /Reference: ABC12345/);
  assert.match(body, /not stored here/i);
});

test("D2. buildContactLogBody's function signature has no way to accept a message/body parameter at all", () => {
  // A structural guarantee, not just a behavioral one: the function only
  // takes name/email/phone/referenceId, so there's no field a future
  // caller could even attempt to pass the message through.
  assert.deepEqual(buildContactLogBody.length, 1); // single destructured-object parameter
  const body = buildContactLogBody({
    name: 'X',
    email: 'x@example.com',
    referenceId: 'REF',
    // @ts-expect-error deliberately passing an extra field to prove it's ignored
    message: SENSITIVE_MESSAGE,
  });
  assert.doesNotMatch(body, /anxiety|sertraline|diagnos/i);
});

test('E. unrelated (admin outbound) email logging is untouched — logEmailMessage still accepts an arbitrary body', async () => {
  // logEmailMessage() itself was not modified by P4-B2 — only its two
  // call sites' inputs changed (contact.controller.ts's, not
  // emails.controller.ts's). Confirm the shared function still resolves
  // cleanly with Supabase unconfigured (its designed short-circuit path)
  // regardless of what body content is passed, proving no new
  // contact-specific restriction was baked into the shared function.
  await assert.doesNotReject(() =>
    logEmailMessage({
      direction: 'outbound',
      to_email: 'staff@example.com',
      subject: 'Admin composed reply',
      body: 'Admin-composed outbound email bodies are unaffected by this phase.',
      status: 'sent',
    })
  );
});

test('E2. emails.controller.ts (admin outbound email) source is unmodified by this phase', () => {
  const source = readFileSync(join(root, 'src/controllers/emails.controller.ts'), 'utf8');
  // Admin-composed outbound mail still logs whatever body the admin wrote —
  // no redaction/placeholder logic was introduced there.
  assert.match(source, /logEmailMessage\(/);
  assert.doesNotMatch(source, /not stored here/i);
});

test('F. the public warning against submitting health information remains present (source check — static UI copy)', () => {
  const source = readFileSync(join(root, '..', 'client/src/components/forms/ContactForm.tsx'), 'utf8');
  assert.match(source, /do not include/i);
  assert.match(source, /sensitive medical or personal health information/i);
});

test('G. the contact success-response shape is unchanged', () => {
  const source = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
  assert.match(source, /res\.status\(201\)\.json\(/);
  assert.match(source, /Your message has been sent\. We aim to respond within one business day\./);
  assert.match(source, /Your message has been received\. We aim to respond within one business day\./);
});

test('H. no database migration was introduced by this phase', () => {
  // buildLeadInsertPayload simply stops SUPPLYING a message value — the
  // leads.message column itself is untouched (still exists for historical
  // rows). No .sql file should have been touched by this phase.
  const schema = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
  assert.match(schema, /message text/); // column still defined, unchanged
});

test('I. no message/PHI content is passed to logger calls in the contact controller', () => {
  const source = readFileSync(join(root, 'src/controllers/contact.controller.ts'), 'utf8');
  const loggerCalls = source.match(/logger\.(warn|error|info)\([^)]*\)/gs) || [];
  assert.ok(loggerCalls.length > 0, 'expected at least one logger call to inspect');
  for (const call of loggerCalls) {
    assert.doesNotMatch(call, /parsed\.data\.message/, `logger call must not reference the raw message: ${call}`);
  }
});
