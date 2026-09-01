/**
 * Regression tests for the marketing unsubscribe & explicit resubscription
 * workflow (P4-I3):
 *   server/src/controllers/marketingUnsubscribe.controller.ts
 *   server/src/lib/marketingUnsubscribeToken.ts
 *   server/src/controllers/marketingContacts.controller.ts (resubscribe)
 *
 * Same established convention as test-marketing-contacts.mjs and
 * test-marketing-contacts-import.mjs: pure decision functions are unit-
 * tested directly with synthetic inputs (no live Supabase connection is
 * used or needed), and route-level checks mount the REAL routers, relying
 * on requests failing before ever reaching Supabase.
 *
 * No live Supabase connection, no real Production credentials, no
 * marketing contact created, unsubscribed, or resubscribed against a real
 * database. No email sent to any provider.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-marketing-unsubscribe.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from '../src/config/env.js';
import { marketingUnsubscribeSchema } from '../src/validation/schemas.js';
import {
  marketingContactResubscribeSchema,
  assertMarketingStatusTransition,
} from '../src/validation/adminSchemas.js';
import { verifyAdminToken, isSessionRevoked, requirePermission } from '../src/middleware/adminAuth.js';
import {
  handleMarketingUnsubscribe,
  resolveUnsubscribeOutcome,
  NEUTRAL_SUCCESS_MESSAGE,
  INVALID_LINK_MESSAGE,
} from '../src/controllers/marketingUnsubscribe.controller.js';
import {
  assertResubscribeEligible,
  buildResubscribePayload,
} from '../src/controllers/marketingContacts.controller.js';
import { applyExistingClassification } from '../src/controllers/marketingContactsImport.controller.js';
import {
  createMarketingUnsubscribeToken,
  verifyMarketingUnsubscribeToken,
  UNSUBSCRIBE_TOKEN_TTL_DAYS,
} from '../src/lib/marketingUnsubscribeToken.js';
import { router } from '../src/routes/index.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, jsonErrorHandler, notFoundHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const publicRoutesSource = readFileSync(join(root, 'src/routes/index.ts'), 'utf8');
const adminRoutesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const unsubscribeControllerSource = readFileSync(
  join(root, 'src/controllers/marketingUnsubscribe.controller.ts'),
  'utf8'
);
const unsubscribeTokenSource = readFileSync(join(root, 'src/lib/marketingUnsubscribeToken.ts'), 'utf8');
const contactsControllerSource = readFileSync(
  join(root, 'src/controllers/marketingContacts.controller.ts'),
  'utf8'
);
const opsSqlSource = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');

const TEST_CONTACT_ID = '11111111-1111-1111-1111-111111111111';

function startPublicApp() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use(router);
    app.use(jsonErrorHandler);
    app.use(notFoundHandler);
    app.use(errorHandler);
    const server = app.listen(0, () => resolve(server));
  });
}

function startAdminApp() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
    const server = app.listen(0, () => resolve(server));
  });
}

function fnSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  if (endMarker) assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const handleUnsubscribeSource = fnSlice(unsubscribeControllerSource, 'export async function handleMarketingUnsubscribe');
const resubscribeFnSource = fnSlice(
  contactsControllerSource,
  'export async function resubscribeMarketingContact'
);

// --- 1/2. Public endpoint, no raw email --------------------------------------

test('1. the unsubscribe endpoint is public — no auth required', async () => {
  const server = await startPublicApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/marketing/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'garbage' }),
    });
    assert.notEqual(res.status, 401, 'expected no auth requirement, so no 401');
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.equal(body.message, INVALID_LINK_MESSAGE);
  } finally {
    server.close();
  }
});

test('2. a raw email address cannot be used to unsubscribe (schema accepts only `token`)', async () => {
  assert.equal(marketingUnsubscribeSchema.safeParse({ email: 'a@example.com' }).success, false);
  assert.equal(marketingUnsubscribeSchema.safeParse({ token: 'x', email: 'a@example.com' }).success, false);
  assert.equal(marketingUnsubscribeSchema.shape.token !== undefined, true);
  assert.equal('email' in marketingUnsubscribeSchema.shape, false);

  const server = await startPublicApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/marketing/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'a@example.com' }),
    });
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.message, INVALID_LINK_MESSAGE);
  } finally {
    server.close();
  }
});

// --- 3-11. Token integrity and minimal claims --------------------------------

test('3. a valid purpose-specific token is accepted', () => {
  const token = createMarketingUnsubscribeToken(TEST_CONTACT_ID);
  const decoded = verifyMarketingUnsubscribeToken(token);
  assert.equal(decoded.contactId, TEST_CONTACT_ID);
});

test('4. a malformed token is rejected generically', () => {
  assert.throws(() => verifyMarketingUnsubscribeToken('not-a-real-token'));
});

test('5. a tampered token is rejected', () => {
  const token = createMarketingUnsubscribeToken(TEST_CONTACT_ID);
  const parts = token.split('.');
  const lastChar = parts[2].slice(-1);
  parts[2] = parts[2].slice(0, -1) + (lastChar === 'A' ? 'B' : 'A');
  assert.throws(() => verifyMarketingUnsubscribeToken(parts.join('.')));
});

test('6. a differently-typed token (e.g. CSV import preview) is rejected', () => {
  const wrongType = jwt.sign(
    { type: 'marketing_contacts_import_preview', adminId: 'x', rows: [] },
    env.ADMIN_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '20m' }
  );
  assert.throws(() => verifyMarketingUnsubscribeToken(wrongType), /Not a marketing contacts unsubscribe token/);
});

test('7. an Admin session JWT cannot function as an unsubscribe token', () => {
  const sessionToken = jwt.sign({ sub: 'admin-1', role: 'staff', permissions: [], tv: 0 }, env.ADMIN_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
  assert.throws(() => verifyMarketingUnsubscribeToken(sessionToken), /Not a marketing contacts unsubscribe token/);
});

test('8. an unsubscribe token cannot function as an Admin session token', () => {
  const token = createMarketingUnsubscribeToken(TEST_CONTACT_ID);
  // Succeeds at the raw JWT-decode level (same secret) — verifyAdminToken
  // itself does not check a `type` claim, matching the real code path.
  const decoded = verifyAdminToken(token);
  assert.equal(decoded.sub, undefined, 'an unsubscribe token payload has no admin id to look up');
  // requireAdmin's downstream DB lookup would find no row for an
  // undefined id — isSessionRevoked (the real, exported decision
  // function) treats that as revoked, so requireAdmin rejects it (401).
  assert.equal(isSessionRevoked({ data: null, error: null }, 0), true);
});

test('9/10/11. the token carries only type/contactId — no email, name, or audience/patient classification', () => {
  const token = createMarketingUnsubscribeToken(TEST_CONTACT_ID);
  const decoded = jwt.decode(token);
  assert.deepEqual(Object.keys(decoded).sort(), ['contactId', 'exp', 'iat', 'type']);
  assert.equal('email' in decoded, false);
  assert.equal('name' in decoded, false);
  assert.equal('audience_type' in decoded, false);
  assert.equal('marketing_status' in decoded, false);
});

test('token lifetime is a long but bounded 180 days, not the CSV preview 20-minute window', () => {
  assert.equal(UNSUBSCRIBE_TOKEN_TTL_DAYS, 180);
  const token = createMarketingUnsubscribeToken(TEST_CONTACT_ID);
  const decoded = jwt.decode(token);
  const seconds = decoded.exp - decoded.iat;
  assert.equal(seconds, 180 * 24 * 60 * 60);
});

// --- 12-16. Status transition + idempotence ----------------------------------

test('12. pending -> unsubscribed produces a real write with a server timestamp', () => {
  const outcome = resolveUnsubscribeOutcome('pending', '2026-01-01T00:00:00.000Z');
  assert.deepEqual(outcome, { action: 'unsubscribe', unsubscribed_at: '2026-01-01T00:00:00.000Z' });
});

test('13. subscribed -> unsubscribed produces a real write with a server timestamp', () => {
  const outcome = resolveUnsubscribeOutcome('subscribed', '2026-01-01T00:00:00.000Z');
  assert.deepEqual(outcome, { action: 'unsubscribe', unsubscribed_at: '2026-01-01T00:00:00.000Z' });
});

test('14. unsubscribed -> unsubscribe is idempotent (noop, no write)', () => {
  assert.deepEqual(resolveUnsubscribeOutcome('unsubscribed', '2026-01-01T00:00:00.000Z'), { action: 'noop' });
});

test('15. repeated unsubscribe never rewrites unsubscribed_at (noop performs no write at all)', () => {
  // A 'noop' outcome carries no timestamp field and the controller only
  // ever calls .update() inside the 'unsubscribe' branch — proven both by
  // the pure function's return shape and by the controller source.
  const outcome = resolveUnsubscribeOutcome('unsubscribed', '2026-01-01T00:00:00.000Z');
  assert.equal('unsubscribed_at' in outcome, false);
  assert.match(handleUnsubscribeSource, /if \(outcome\.action === 'unsubscribe'\) \{/);
});

test("16. suppressed remains suppressed — never weakened to unsubscribed", () => {
  assert.deepEqual(resolveUnsubscribeOutcome('suppressed', '2026-01-01T00:00:00.000Z'), { action: 'noop' });
});

// --- 17. No public enumeration ------------------------------------------------

test('17. the public response text is identical regardless of the contact\'s actual state (no enumeration)', () => {
  // Every reachable non-error path falls through to a single shared
  // success-response call site — not one response call per branch — so
  // there is exactly one place in the whole function that can send a
  // success message, and it always uses the one neutral constant.
  const successCallCount = (handleUnsubscribeSource.match(/res\.json\(\{ success: true/g) || []).length;
  assert.equal(successCallCount, 1, 'expected exactly one shared success-response call site');
  assert.match(handleUnsubscribeSource, /res\.json\(\{ success: true, message: NEUTRAL_SUCCESS_MESSAGE \}\);/);
});

// --- 18/19. Consent provenance preserved --------------------------------------

test('18/19. consent_source and consent_at are never included in the unsubscribe update payload', () => {
  const updateCallStart = handleUnsubscribeSource.indexOf('.update({');
  const updateCallEnd = handleUnsubscribeSource.indexOf('})', updateCallStart);
  const updatePayload = handleUnsubscribeSource.slice(updateCallStart, updateCallEnd);
  assert.doesNotMatch(updatePayload, /consent_source/);
  assert.doesNotMatch(updatePayload, /consent_at/);
  assert.match(updatePayload, /marketing_status/);
  assert.match(updatePayload, /unsubscribed_at/);
});

// --- 20. Server-controlled timestamp ------------------------------------------

test('20. unsubscribed_at is always the server-computed timestamp, never caller-supplied', () => {
  assert.equal(Object.keys(marketingUnsubscribeSchema.shape).length, 1);
  assert.ok('token' in marketingUnsubscribeSchema.shape, 'the request schema accepts nothing but token');
  const outcome = resolveUnsubscribeOutcome('pending', '2030-06-15T12:00:00.000Z');
  assert.equal(outcome.unsubscribed_at, '2030-06-15T12:00:00.000Z');
});

// --- 21. Rate limiting ---------------------------------------------------------

test('21. the public unsubscribe route is rate limited', () => {
  assert.match(publicRoutesSource, /marketingUnsubscribeLimiter/);
  assert.match(
    publicRoutesSource,
    /router\.post\('\/api\/marketing\/unsubscribe', marketingUnsubscribeLimiter, asyncHandler\(handleMarketingUnsubscribe\)\)/
  );
});

// --- 22. GET does not mutate ----------------------------------------------------

test('22. there is no GET route for the unsubscribe endpoint — only POST can mutate', () => {
  assert.doesNotMatch(publicRoutesSource, /router\.get\('\/api\/marketing\/unsubscribe'/);
  assert.match(publicRoutesSource, /router\.post\('\/api\/marketing\/unsubscribe'/);
});

test('22b. a GET request to the unsubscribe path is not handled by this router (no accidental mutation route)', async () => {
  const server = await startPublicApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/marketing/unsubscribe`, { method: 'GET' });
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

// --- 23/24. Resubscribe requires Admin auth + permission ----------------------

test('23. resubscribe requires Admin auth', async () => {
  const server = await startAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-contacts/${TEST_CONTACT_ID}/resubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('24. resubscribe requires the marketing_contacts permission, wired the same way as every other marketing-contacts route', () => {
  const block = fnSlice(adminRoutesSource, 'Explicit resubscription (P4-I3)', "'/marketing-contacts/import/preview'");
  assert.match(block, /'\/marketing-contacts\/:id\/resubscribe'/);
  assert.match(block, /requireAdmin,/);
  assert.match(block, /requirePermission\('marketing_contacts'\)/);

  const guard = requirePermission('marketing_contacts');
  let denied;
  guard({ admin: { role: 'staff', permissions: [] } }, {}, (err) => {
    denied = err;
  });
  assert.equal(denied.status, 403);
});

// --- 25. UUID validation ---------------------------------------------------------

test('25. a malformed contact id on resubscribe is rejected before reaching the handler (401 checked first, same as every other id route)', async () => {
  const server = await startAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-contacts/not-a-uuid/resubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('25b. resubscribeMarketingContact validates the id with the same uuidParam schema as the rest of the controller', () => {
  assert.match(contactsControllerSource, /const uuidParam = z\.string\(\)\.uuid\(\);/);
  assert.match(resubscribeFnSource, /uuidParam\.safeParse\(req\.params\.id\)/);
});

// --- 26/29. Resubscribe eligibility ------------------------------------------

test('26. unsubscribed is eligible for resubscription (does not throw)', () => {
  assert.doesNotThrow(() => assertResubscribeEligible('unsubscribed'));
});

test('27. generic PATCH still rejects unsubscribed -> subscribed and suppressed -> subscribed', () => {
  assert.throws(() => assertMarketingStatusTransition('unsubscribed', 'subscribed'));
  assert.throws(() => assertMarketingStatusTransition('suppressed', 'subscribed'));
});

test('28. CSV import still cannot reactivate an existing unsubscribed contact', () => {
  const rows = [
    {
      classification: 'new',
      email_normalized: 'a@example.com',
      marketing_status: 'subscribed',
      consent_source: 'csv_import',
    },
  ];
  applyExistingClassification(rows, new Map([['a@example.com', 'unsubscribed']]));
  assert.equal(rows[0].classification, 'existing_unsubscribed');
});

test('29. suppressed -> resubscribe is rejected (422), never eligible', () => {
  assert.throws(() => assertResubscribeEligible('suppressed'), (err) => err.status === 422);
});

test('already-subscribed resubscribe attempt is a 409 conflict, not a silent no-op', () => {
  assert.throws(() => assertResubscribeEligible('subscribed'), (err) => err.status === 409);
});

test('pending is not eligible for the dedicated resubscribe endpoint (422) — it uses normal PATCH instead', () => {
  assert.throws(() => assertResubscribeEligible('pending'), (err) => err.status === 422);
});

// --- 30. Explicit confirmation required ---------------------------------------

test('30. resubscribe requires the literal confirmation field confirm: true', () => {
  assert.equal(marketingContactResubscribeSchema.safeParse({ confirm: true }).success, true);
  assert.equal(marketingContactResubscribeSchema.safeParse({}).success, false);
  assert.equal(marketingContactResubscribeSchema.safeParse({ confirm: false }).success, false);
  assert.equal(marketingContactResubscribeSchema.safeParse({ confirm: 'true' }).success, false);
  assert.equal(marketingContactResubscribeSchema.safeParse({ confirm: 1 }).success, false);
});

// --- 31-34. New consent event -------------------------------------------------

test('31. resubscribe always sets consent_source to manual', () => {
  const payload = buildResubscribePayload('2026-03-01T00:00:00.000Z');
  assert.equal(payload.consent_source, 'manual');
  assert.equal(payload.marketing_status, 'subscribed');
});

test('32. resubscribe sets consent_at to the server-computed timestamp', () => {
  const payload = buildResubscribePayload('2026-03-01T00:00:00.000Z');
  assert.equal(payload.consent_at, '2026-03-01T00:00:00.000Z');
});

test('33. a caller cannot supply consent_at (the request schema accepts only `confirm`)', () => {
  assert.deepEqual(Object.keys(marketingContactResubscribeSchema.shape), ['confirm']);
  assert.equal(marketingContactResubscribeSchema.safeParse({ confirm: true, consent_at: '2020-01-01' }).success, false);
});

test('34. historical unsubscribed_at is preserved — the resubscribe payload never includes it', () => {
  const payload = buildResubscribePayload('2026-03-01T00:00:00.000Z');
  assert.equal('unsubscribed_at' in payload, false);
});

// --- 35. Audit contains no email ------------------------------------------------

test('35. the Admin resubscribe audit log contains no email, name, or raw request body', () => {
  const auditStart = resubscribeFnSource.indexOf('writeAuditLog({');
  const auditEnd = resubscribeFnSource.indexOf('});', auditStart);
  const auditCall = resubscribeFnSource.slice(auditStart, auditEnd);
  assert.doesNotMatch(auditCall, /\.email\b/);
  assert.doesNotMatch(auditCall, /req\.body/);
  assert.doesNotMatch(auditCall, /authorization/i);
  assert.match(auditCall, /previous_status/);
  assert.match(auditCall, /new_status/);
});

// --- 36/37. No email-provider or patient-system calls ---------------------------

test('36. no email-provider integration exists anywhere in the unsubscribe/resubscribe path', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    for (const src of [unsubscribeControllerSource, unsubscribeTokenSource, resubscribeFnSource]) {
      assert.doesNotMatch(src, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
    }
  }
});

test('37. no patient-system integration exists anywhere in the unsubscribe/resubscribe path', () => {
  for (const term of ['charm', 'medicalmine']) {
    for (const src of [unsubscribeControllerSource, unsubscribeTokenSource, resubscribeFnSource]) {
      assert.doesNotMatch(src, new RegExp(term, 'i'), `unexpected patient-system reference "${term}"`);
    }
  }
});

// --- 38. No DB migration ---------------------------------------------------------

test('38. no database migration was introduced for P4-I3', () => {
  // P4-I2A's own migration already contains a legitimate
  // "alter table marketing_contacts enable row level security" — that is
  // not a schema change and predates this phase. What P4-I3 must NOT add
  // is a new column (an "add column" alteration) or a new table.
  assert.doesNotMatch(opsSqlSource, /alter table (public\.)?marketing_contacts\s+add column/i);
  assert.doesNotMatch(opsSqlSource, /create table.*unsubscribe/i);
  assert.doesNotMatch(opsSqlSource, /create table.*marketing.*token/i);
});

// --- 39/40. Existing regressions still pass (spot checks; the full suites --
// --- are run separately as part of the P4-I3 regression pass) --------------

test('39. a spot-check P4-I2C invariant still holds: same-status no-op is allowed', () => {
  assert.doesNotThrow(() => assertMarketingStatusTransition('pending', 'pending'));
});

test('40. a spot-check P4-I2E invariant still holds: existing suppressed is protected, not reactivated', () => {
  const rows = [{ classification: 'new', email_normalized: 'b@example.com' }];
  applyExistingClassification(rows, new Map([['b@example.com', 'suppressed']]));
  assert.equal(rows[0].classification, 'existing_suppressed');
});
