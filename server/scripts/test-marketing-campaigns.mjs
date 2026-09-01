/**
 * Regression tests for the Marketing Campaign Drafts Server API (P4-I4B):
 * server/src/controllers/marketingCampaigns.controller.ts.
 *
 * Same established convention as test-marketing-contacts.mjs/
 * test-marketing-unsubscribe.mjs: pure decision functions are unit-tested
 * directly with synthetic inputs (no live Supabase connection is used or
 * needed), and route-level auth checks mount the REAL adminRouter, relying
 * on requests failing before ever reaching Supabase.
 *
 * No live Supabase connection, no real Production credentials, no
 * marketing campaign or marketing contact created, mutated, or emailed.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-marketing-campaigns.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  marketingCampaignCreate,
  marketingCampaignUpdate,
  assertMarketingStatusTransition,
} from '../src/validation/adminSchemas.js';
import { requirePermission } from '../src/middleware/adminAuth.js';
import {
  assertCampaignEditable,
  buildArchivePayload,
  buildRecipientEligibilityFilters,
} from '../src/controllers/marketingCampaigns.controller.js';
import { applyExistingClassification } from '../src/controllers/marketingContactsImport.controller.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, notFoundHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const routesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const controllerSource = readFileSync(join(root, 'src/controllers/marketingCampaigns.controller.ts'), 'utf8');
const opsSqlSource = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');

function startRealAdminApp() {
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
  const end = source.indexOf(endMarker, start);
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

// Bounded to just the original 6 draft-management routes (P4-I4B) — the
// send route (P4-I5B) sits right after this block and has its own
// dedicated tests in test-marketing-campaign-delivery.mjs.
const routeBlock = fnSlice(routesSource, 'Marketing campaign DRAFTS (P4-I4B)', 'Manual campaign delivery (P4-I5B)');
const createFnSource = fnSlice(controllerSource, 'export async function createMarketingCampaign', 'export function assertCampaignEditable');
const updateFnSource = fnSlice(controllerSource, 'export async function updateMarketingCampaign', 'export function buildArchivePayload');
const archiveFnSource = fnSlice(controllerSource, 'export async function archiveMarketingCampaign', 'export type RecipientEligibilityFilters');
const previewFnSource = controllerSource.slice(controllerSource.indexOf('export async function previewMarketingCampaignRecipients'));

const validCreate = {
  name: 'Spring Newsletter',
  subject: 'See what is new this spring',
  content: 'Hello — here is our spring update.',
};

// --- 1/2. Auth + permission ---------------------------------------------------

test('1. every marketing-campaigns route requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  const id = '11111111-1111-1111-1111-111111111111';
  try {
    for (const [method, path] of [
      ['GET', '/api/admin/marketing-campaigns'],
      ['GET', `/api/admin/marketing-campaigns/${id}`],
      ['POST', '/api/admin/marketing-campaigns'],
      ['PATCH', `/api/admin/marketing-campaigns/${id}`],
      ['POST', `/api/admin/marketing-campaigns/${id}/archive`],
      ['GET', `/api/admin/marketing-campaigns/${id}/recipient-preview`],
    ]) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({}),
      });
      assert.equal(res.status, 401, `expected ${method} ${path} to require auth`);
    }
  } finally {
    server.close();
  }
});

test('2. every marketing-campaigns route requires the marketing_campaigns permission (wiring + real middleware)', () => {
  const routeCount = (routeBlock.match(/'\/marketing-campaigns/g) || []).length;
  const permissionCount = (routeBlock.match(/requirePermission\('marketing_campaigns'\)/g) || []).length;
  const requireAdminCount = (routeBlock.match(/requireAdmin,/g) || []).length;
  assert.equal(routeCount, 6, 'expected 6 route registrations (list/get/create/update/archive/preview)');
  assert.equal(permissionCount, 6);
  assert.equal(requireAdminCount, 6);
  assert.doesNotMatch(routeBlock, /requirePermission\('marketing_contacts'\)/, 'must use its own dedicated permission, not marketing_contacts');

  const guard = requirePermission('marketing_campaigns');
  let denied;
  guard({ admin: { role: 'staff', permissions: [] } }, {}, (err) => {
    denied = err;
  });
  assert.equal(denied.status, 403);
  let allowed = false;
  guard({ admin: { role: 'staff', permissions: ['marketing_campaigns'] } }, {}, (err) => {
    allowed = err === undefined;
  });
  assert.equal(allowed, true);
});

// --- 3-6. Create rejects controlled/system fields -----------------------------

test('3. create rejects unknown fields', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, foo: 'bar' }).success, false);
});

test('4. create rejects status', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, status: 'archived' }).success, false);
});

test('5. create rejects created_by', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, created_by: '11111111-1111-1111-1111-111111111111' }).success, false);
});

test('6. create rejects timestamps', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, created_at: '2020-01-01T00:00:00Z' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, updated_at: '2020-01-01T00:00:00Z' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, archived_at: '2020-01-01T00:00:00Z' }).success, false);
});

// --- 7-12. Field validation -----------------------------------------------------

test('7. name is required, nonblank, max 200', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, name: undefined }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, name: '   ' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, name: 'a'.repeat(200) }).success, true);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, name: 'a'.repeat(201) }).success, false);
});

test('8. subject is required, nonblank, max 200', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, subject: undefined }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, subject: '   ' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, subject: 'a'.repeat(200) }).success, true);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, subject: 'a'.repeat(201) }).success, false);
});

test('9. subject rejects CR/LF', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, subject: 'Line one\nLine two' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, subject: 'Line one\r\nLine two' }).success, false);
});

test('10. preview_text max 500, also rejects CR/LF, is optional', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, preview_text: 'a'.repeat(500) }).success, true);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, preview_text: 'a'.repeat(501) }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, preview_text: 'a\nb' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, preview_text: null }).success, true);
  assert.equal(marketingCampaignCreate.safeParse(validCreate).success, true);
});

test('11. content is required and nonblank, with no small arbitrary cap', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, content: undefined }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, content: '   ' }).success, false);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, content: 'a'.repeat(10000) }).success, true);
});

test('12. audience_type is controlled to the four known values', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, audience_type: 'existing_patient' }).success, true);
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, audience_type: 'not-a-real-audience' }).success, false);
});

// --- 13. NULL audience -----------------------------------------------------------

test('13. NULL/omitted audience_type is accepted (means all subscribed contacts)', () => {
  assert.equal(marketingCampaignCreate.safeParse({ ...validCreate, audience_type: null }).success, true);
  assert.equal(marketingCampaignCreate.safeParse(validCreate).success, true);
});

// --- 14/15. Server-controlled status/created_by -------------------------------

test('14. create never inserts a caller-supplied status — relies on the DB default', () => {
  assert.doesNotMatch(createFnSource, /status:\s*['"`]/);
  assert.doesNotMatch(createFnSource, /parsed\.data\.status/);
});

test('15. create sets created_by from the authenticated Admin', () => {
  assert.match(createFnSource, /created_by:\s*actor\?\.sub/);
});

// --- 16-18. PATCH field restrictions ---------------------------------------------

test('16. PATCH only allows the same five editable fields as create', () => {
  assert.deepEqual(
    Object.keys(marketingCampaignUpdate.shape).sort(),
    ['audience_type', 'content', 'name', 'preview_text', 'subject'].sort()
  );
});

test('17. PATCH rejects status', () => {
  assert.equal(marketingCampaignUpdate.safeParse({ status: 'archived' }).success, false);
});

test('18. PATCH rejects system fields (created_by/created_at/updated_at/archived_at)', () => {
  for (const field of ['created_by', 'created_at', 'updated_at', 'archived_at']) {
    assert.equal(marketingCampaignUpdate.safeParse({ [field]: '2020-01-01T00:00:00Z' }).success, false, field);
  }
});

// --- 19. Archived immutability ---------------------------------------------------

test('19. an archived campaign cannot be edited (409)', () => {
  assert.doesNotThrow(() => assertCampaignEditable('draft'));
  assert.throws(() => assertCampaignEditable('archived'), (err) => err.status === 409);
});

// --- 20-22. Archive behavior -------------------------------------------------------

test('20/21/22. archiving sets status=archived, archived_at, and updated_at together', () => {
  const payload = buildArchivePayload('2026-05-01T00:00:00.000Z');
  assert.deepEqual(payload, {
    status: 'archived',
    archived_at: '2026-05-01T00:00:00.000Z',
    updated_at: '2026-05-01T00:00:00.000Z',
  });
});

test('archive is idempotent — an already-archived campaign performs no write', () => {
  assert.match(controllerSource, /if \(before\.status === 'archived'\) \{\s*res\.json\(\{ success: true, data: before \}\);\s*return;/);
});

// --- 23-26. No unarchive/DELETE/send/schedule -------------------------------------

test('23. no unarchive/restore endpoint exists', () => {
  assert.doesNotMatch(routesSource, /unarchive/i);
  assert.doesNotMatch(routesSource, /\/marketing-campaigns.*restore/i);
});

test('24. no DELETE endpoint exists for marketing-campaigns', () => {
  assert.doesNotMatch(routesSource, /adminRouter\.delete\(\s*'\/marketing-campaigns/);
});

test('25. no send endpoint exists', () => {
  // The block's own comment legitimately documents the absence of a send
  // route in prose ("no send/schedule route") — what must never appear is
  // an actual route registration for one.
  assert.doesNotMatch(routeBlock, /'\/marketing-campaigns[^']*send/i);
  assert.doesNotMatch(routeBlock, /asyncHandler\(send/i);
});

test('26. no schedule endpoint exists', () => {
  assert.doesNotMatch(routeBlock, /'\/marketing-campaigns[^']*schedule/i);
  assert.doesNotMatch(routeBlock, /asyncHandler\(schedule/i);
});

// --- 27-32. Recipient eligibility ---------------------------------------------------

test('27. recipient preview always requires marketing_status = subscribed', () => {
  assert.equal(buildRecipientEligibilityFilters(null).marketing_status, 'subscribed');
  assert.equal(buildRecipientEligibilityFilters('existing_patient').marketing_status, 'subscribed');
  assert.equal(buildRecipientEligibilityFilters(undefined).marketing_status, 'subscribed');
});

test('28. NULL audience counts every subscribed contact (no audience_type filter applied)', () => {
  const filters = buildRecipientEligibilityFilters(null);
  assert.deepEqual(filters, { marketing_status: 'subscribed' });
  assert.equal('audience_type' in filters, false);
});

test('29. a selected audience counts only subscribed contacts in that audience', () => {
  const filters = buildRecipientEligibilityFilters('prospective_patient');
  assert.deepEqual(filters, { marketing_status: 'subscribed', audience_type: 'prospective_patient' });
});

test('30/31/32. pending, unsubscribed, and suppressed statuses can never appear as the eligibility filter', () => {
  for (const audience of [null, 'existing_patient', 'prospective_patient', 'subscriber', 'other']) {
    const filters = buildRecipientEligibilityFilters(audience);
    assert.equal(filters.marketing_status, 'subscribed');
    assert.notEqual(filters.marketing_status, 'pending');
    assert.notEqual(filters.marketing_status, 'unsubscribed');
    assert.notEqual(filters.marketing_status, 'suppressed');
  }
});

// --- 33-35. Count-only, no writes -------------------------------------------------

test('33/34. the recipient-preview response contains only a count and audience_type — no emails, names, or contact IDs', () => {
  assert.match(previewFnSource, /select\('id', \{ count: 'exact', head: true \}\)/);
  assert.match(previewFnSource, /eligible_count: count \?\? 0/);
  assert.match(previewFnSource, /audience_type: campaign\.audience_type \?\? null/);
  const responseBlock = previewFnSource.slice(previewFnSource.indexOf('res.json({'));
  assert.doesNotMatch(responseBlock, /email/i);
  assert.doesNotMatch(responseBlock, /\bids\b/i);
  assert.doesNotMatch(responseBlock, /\bname\b/i);
});

test('35. recipient preview performs no database writes', () => {
  assert.doesNotMatch(previewFnSource, /\.insert\(/);
  assert.doesNotMatch(previewFnSource, /\.update\(/);
  assert.doesNotMatch(previewFnSource, /\.delete\(/);
  assert.doesNotMatch(previewFnSource, /\.upsert\(/);
});

// --- 36-38. No contact-table writes anywhere in create/update/archive -----------

test('36. campaign create never writes to marketing_contacts', () => {
  assert.doesNotMatch(createFnSource, /marketing_contacts/);
});

test('37. campaign update never writes to marketing_contacts', () => {
  assert.doesNotMatch(updateFnSource, /marketing_contacts/);
});

test('38. campaign archive never writes to marketing_contacts', () => {
  assert.doesNotMatch(archiveFnSource, /marketing_contacts/);
});

// --- 39-41. Audit safety -------------------------------------------------------------

test('39. the create audit log excludes name/subject/content', () => {
  const auditStart = createFnSource.indexOf('writeAuditLog({');
  const auditEnd = createFnSource.indexOf('});', auditStart);
  const auditCall = createFnSource.slice(auditStart, auditEnd);
  assert.doesNotMatch(auditCall, /data\.name/);
  assert.doesNotMatch(auditCall, /data\.subject/);
  assert.doesNotMatch(auditCall, /data\.content/);
  assert.match(auditCall, /data\.status/);
});

test('40. the update audit log contains changed field NAMES only, never values', () => {
  assert.match(updateFnSource, /const changedFields = Object\.keys\(parsed\.data\)/);
  assert.match(updateFnSource, /changed_fields: changedFields/);
  assert.doesNotMatch(updateFnSource, /diffChanges/);
});

test('41. the archive audit log is safe (status only, no content/subject)', () => {
  const auditStart = archiveFnSource.indexOf('writeAuditLog({');
  const auditEnd = archiveFnSource.indexOf('});', auditStart);
  const auditCall = archiveFnSource.slice(auditStart, auditEnd);
  assert.doesNotMatch(auditCall, /data\.name/);
  assert.doesNotMatch(auditCall, /data\.subject/);
  assert.doesNotMatch(auditCall, /data\.content/);
});

// --- 42/44. No email-provider or patient-system calls ---------------------------

test('42. no email-provider integration exists anywhere in the campaign controller', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    assert.doesNotMatch(controllerSource, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
  }
});

test('44. no patient-system integration exists anywhere in the campaign controller', () => {
  for (const term of ['charm', 'medicalmine']) {
    assert.doesNotMatch(controllerSource, new RegExp(term, 'i'), `unexpected patient-system reference "${term}"`);
  }
});

// --- 43. No unsubscribe token generated during preview ---------------------------

test('43. no unsubscribe token is generated anywhere in the campaign controller', () => {
  assert.doesNotMatch(controllerSource, /createMarketingUnsubscribeToken/);
  assert.doesNotMatch(controllerSource, /marketingUnsubscribeToken/);
});

// --- 45. No schema migration -------------------------------------------------------

test('45. no new schema migration was introduced for P4-I4B', () => {
  // P4-I4A's own migration already contains a legitimate
  // "alter table marketing_campaigns enable row level security" — not a
  // schema change, and it predates this phase. What P4-I4B must NOT add is
  // a new column (an "add column" alteration) or a second table definition.
  assert.doesNotMatch(opsSqlSource, /alter table marketing_campaigns\s+add column/i);
  const campaignBlockCount = (opsSqlSource.match(/create table if not exists marketing_campaigns/g) || []).length;
  assert.equal(campaignBlockCount, 1, 'expected exactly the one P4-I4A table definition, no duplicate/second migration');
});

// --- 46/47. Existing protections remain intact -----------------------------------

test('46. existing P4-I3 status-transition protections remain intact', () => {
  assert.throws(() => assertMarketingStatusTransition('unsubscribed', 'subscribed'));
  assert.throws(() => assertMarketingStatusTransition('suppressed', 'subscribed'));
});

test('47. existing P4-I2E CSV import protections remain intact', () => {
  const rows = [{ classification: 'new', email_normalized: 'a@example.com' }];
  applyExistingClassification(rows, new Map([['a@example.com', 'unsubscribed']]));
  assert.equal(rows[0].classification, 'existing_unsubscribed');
});

// --- Supplementary: no DELETE handler exists in the controller itself -----------

test('the controller exports no delete/send/schedule handler', () => {
  assert.doesNotMatch(controllerSource, /export async function delete/i);
  assert.doesNotMatch(controllerSource, /export async function send/i);
  assert.doesNotMatch(controllerSource, /export async function schedule/i);
});
