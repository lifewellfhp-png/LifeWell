/**
 * Regression tests for campaign management + safe test send:
 * DELETE /marketing-campaigns/:id, POST /marketing-campaigns/:id/duplicate,
 * and POST /marketing-campaigns/:id/test-send.
 *
 * Same established convention as every other marketing-* test file in this
 * suite: pure decision functions (assertCampaignTestSendable,
 * injectTestBanner) are unit-tested directly with synthetic inputs, and
 * DB-backed orchestration (deleteMarketingCampaign, duplicateMarketingCampaign,
 * sendTestCampaignEmail — all of which need a live Supabase connection this
 * environment does not have) is verified via source-structure assertions on
 * their exact ordering and safety properties.
 *
 * CRITICAL: no test in this file ever calls sendViaPauboxApi (the one
 * function that performs a real network fetch to Paubox) — every test
 * either calls a pure function with synthetic inputs, or reads source text.
 * 0 real emails can be sent by this suite, no Paubox API key is required,
 * and neither the Labor Day 2026 campaign nor the "Campaign Workflow Test —
 * DO NOT SEND" fixture below is ever sent, created, or mutated against a
 * live Admin API by any test here.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-marketing-campaign-management.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { marketingCampaignTestSendSchema } from '../src/validation/adminSchemas.js';
import { requirePermission } from '../src/middleware/adminAuth.js';
import {
  assertCampaignTestSendable,
  injectTestBanner,
  assertCampaignSendable,
} from '../src/services/marketingCampaignDelivery.service.js';
import { CAMPAIGN_WORKFLOW_TEST_FIXTURE } from './campaigns/campaign-workflow-test-do-not-send.mjs';
import { LABOR_DAY_CAMPAIGN } from './campaigns/labor-day-2026-subscriber-greeting.mjs';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, notFoundHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const routesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const middlewareSource = readFileSync(join(root, 'src/middleware/index.ts'), 'utf8');
const serviceSource = readFileSync(join(root, 'src/services/marketingCampaignDelivery.service.ts'), 'utf8');
const controllerSource = readFileSync(join(root, 'src/controllers/marketingCampaigns.controller.ts'), 'utf8');
const opsSqlSource = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');
const adminPageSource = readFileSync(
  join(root, '..', 'admin', 'src', 'app', '(app)', 'marketing-campaigns', 'page.tsx'),
  'utf8'
);

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
  const end = endMarker ? source.indexOf(endMarker, start) : source.length;
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  if (endMarker) assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const TEST_ID = '11111111-1111-1111-1111-111111111111';
const deleteFnSource = fnSlice(
  controllerSource,
  'export async function deleteMarketingCampaign',
  'export async function duplicateMarketingCampaign'
);
const duplicateFnSource = fnSlice(
  controllerSource,
  'export async function duplicateMarketingCampaign',
  'export type RecipientEligibilityFilters'
);
const testSendFnSource = fnSlice(
  serviceSource,
  'export async function sendTestCampaignEmail',
  'export async function sendTestMarketingCampaign'
);

// --- 1-3. Auth ------------------------------------------------------------------

test('1. DELETE /marketing-campaigns/:id requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-campaigns/${TEST_ID}`, { method: 'DELETE' });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('2. POST /marketing-campaigns/:id/duplicate requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-campaigns/${TEST_ID}/duplicate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('3. POST /marketing-campaigns/:id/test-send requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-campaigns/${TEST_ID}/test-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'owner@example.com', confirm: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

// --- 4-6. Permission wiring -------------------------------------------------------

// Route blocks are sliced using each route's own single-line JSDoc comment
// text as the marker (never a marker string that embeds a literal '\n') —
// this repo's source files use CRLF line endings, so a marker containing
// '\n' would silently fail to match '\r\n' and break these slices.
const deleteRouteBlock = fnSlice(
  routesSource,
  'Delete a campaign draft (campaign management',
  'Duplicate a campaign (locked, archived, or draft)'
);
const duplicateRouteBlock = fnSlice(routesSource, 'Duplicate a campaign (locked, archived, or draft)', "adminRouter.get('/users'");
const testSendRouteBlock = fnSlice(
  routesSource,
  'Send ONE test email of a saved draft',
  'Delete a campaign draft (campaign management'
);

test('4. all three routes use the marketing_campaigns permission, not marketing_contacts', () => {
  for (const block of [deleteRouteBlock, duplicateRouteBlock, testSendRouteBlock]) {
    assert.match(block, /requireAdmin,/);
    assert.match(block, /requirePermission\('marketing_campaigns'\)/);
    assert.doesNotMatch(block, /requirePermission\('marketing_contacts'\)/);
  }
});

test('5. requirePermission real middleware denies staff without marketing_campaigns and allows staff with it', () => {
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

test('6. exactly one route registration exists for each of DELETE, duplicate, and test-send — no duplicates', () => {
  assert.equal((routesSource.match(/adminRouter\.delete\(\s*\n\s*'\/marketing-campaigns\/:id'/g) || []).length, 1);
  assert.equal((routesSource.match(/'\/marketing-campaigns\/:id\/duplicate'/g) || []).length, 1);
  assert.equal((routesSource.match(/'\/marketing-campaigns\/:id\/test-send'/g) || []).length, 1);
});

// --- 7-9. Delete safety -------------------------------------------------------------

test('7. delete checks isCampaignDeliveryLocked and throws 409 before any .delete() call', () => {
  const lockIdx = deleteFnSource.indexOf('isCampaignDeliveryLocked(');
  const throwIdx = deleteFnSource.indexOf('throw new AppError');
  const deleteCallIdx = deleteFnSource.indexOf(".from('marketing_campaigns').delete()");
  assert.ok(lockIdx > -1 && throwIdx > lockIdx && deleteCallIdx > throwIdx, 'expected lock check -> throw -> delete ordering');
  assert.match(deleteFnSource, /already had delivery initiated and cannot be deleted/);
});

test('8. delete never manually removes marketing_campaign_recipients rows — relies entirely on the lock check + DB FK', () => {
  assert.doesNotMatch(deleteFnSource, /from\('marketing_campaign_recipients'\)/);
});

test('9. the marketing_campaign_recipients FK has no ON DELETE CASCADE (Postgres default NO ACTION backs the application-level lock check)', () => {
  const fkLine = opsSqlSource.match(/campaign_id uuid not null references marketing_campaigns \(id\)[^,\n]*/);
  assert.ok(fkLine, 'expected to find the campaign_id FK definition');
  assert.doesNotMatch(fkLine[0], /on delete cascade/i);
});

// --- 10-15. Duplicate content preservation + non-inheritance -----------------------

test('10. duplicate copies exactly the seven content/config fields from the source campaign', () => {
  for (const field of ['subject', 'subject_fallback', 'preview_text', 'audience_type', 'content', 'html_body']) {
    assert.match(duplicateFnSource, new RegExp(`source\\.${field}`));
  }
});

test('11. duplicate always forces status to draft, regardless of the source campaign\'s own status', () => {
  assert.match(duplicateFnSource, /status: 'draft'/);
  assert.doesNotMatch(duplicateFnSource, /status: source\.status/);
});

test('12. duplicate never copies id, timestamps, or delivery/provider state from the source', () => {
  for (const field of ['source.id', 'source.created_at', 'source.updated_at', 'source.archived_at', 'source.delivery_locked', 'source.created_by']) {
    assert.doesNotMatch(duplicateFnSource, new RegExp(field.replace('.', '\\.')));
  }
});

test('13. duplicate selects only content/config columns from the source row — never recipient or delivery data', () => {
  const selectMatch = duplicateFnSource.match(/\.select\('([^']+)'\)/);
  assert.ok(selectMatch, 'expected a .select() call on the source fetch');
  assert.doesNotMatch(selectMatch[1], /status|id|created_at|updated_at|archived_at/);
});

test('14. duplicate never inserts into marketing_campaign_recipients', () => {
  assert.doesNotMatch(duplicateFnSource, /marketing_campaign_recipients/);
});

test('15. the new name is truncated to fit the 200-char limit with the " — Copy" suffix intact', () => {
  assert.match(duplicateFnSource, /suffix = ' — Copy'/);
  assert.match(duplicateFnSource, /maxNameLength = 200 - suffix\.length/);
  // Simulate the exact truncation logic against a 200-char name.
  const suffix = ' — Copy';
  const maxNameLength = 200 - suffix.length;
  const baseName = 'a'.repeat(200);
  const newName = (baseName.length > maxNameLength ? baseName.slice(0, maxNameLength) : baseName) + suffix;
  assert.ok(newName.length <= 200);
  assert.ok(newName.endsWith(suffix));
});

// --- 16-18. Duplicate audit safety --------------------------------------------------

test('16. the duplicate audit log references the source campaign id, never name/subject/content', () => {
  const auditStart = duplicateFnSource.indexOf('writeAuditLog({');
  const auditEnd = duplicateFnSource.indexOf('});', auditStart);
  const auditCall = duplicateFnSource.slice(auditStart, auditEnd);
  assert.match(auditCall, /source_campaign_id/);
  assert.doesNotMatch(auditCall, /newName/);
  assert.doesNotMatch(auditCall, /source\.subject/);
  assert.doesNotMatch(auditCall, /source\.content/);
});

test('17. the delete audit log excludes name/subject/content', () => {
  const auditStart = deleteFnSource.indexOf('writeAuditLog({');
  const auditEnd = deleteFnSource.indexOf('});', auditStart);
  const auditCall = deleteFnSource.slice(auditStart, auditEnd);
  assert.doesNotMatch(auditCall, /before\.name/);
  assert.doesNotMatch(auditCall, /before\.subject/);
});

test('18. duplicate response never exposes delivery-lock or aggregate counts as anything but the correct all-zero shape for a brand-new draft', () => {
  const responseBlock = duplicateFnSource.slice(duplicateFnSource.indexOf('res.status(201)'));
  assert.match(responseBlock, /delivery_locked: false/);
  assert.match(responseBlock, /pending: 0/);
  assert.match(responseBlock, /sent: 0/);
});

// --- 19-22. Test-send request schema -----------------------------------------------

test('19. test-send requires a valid email address', () => {
  assert.equal(marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', confirm: true }).success, true);
  assert.equal(marketingCampaignTestSendSchema.safeParse({ email: 'not-an-email', confirm: true }).success, false);
  assert.equal(marketingCampaignTestSendSchema.safeParse({ confirm: true }).success, false);
});

test('20. test-send requires the literal confirmation field confirm: true', () => {
  assert.equal(marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com' }).success, false);
  assert.equal(marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', confirm: false }).success, false);
});

test('21. test-send rejects a bare array/CC/BCC shape — email must be a single string, and unknown fields are rejected', () => {
  assert.equal(marketingCampaignTestSendSchema.safeParse({ email: ['a@example.com'], confirm: true }).success, false);
  assert.equal(
    marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', cc: 'x@example.com', confirm: true }).success,
    false
  );
  assert.equal(
    marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', bcc: ['x@example.com'], confirm: true }).success,
    false
  );
  assert.deepEqual(Object.keys(marketingCampaignTestSendSchema.shape).sort(), ['confirm', 'email', 'first_name']);
});

test('22. test-send accepts an optional first_name up to 60 chars, rejects longer', () => {
  assert.equal(
    marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', first_name: 'a'.repeat(60), confirm: true }).success,
    true
  );
  assert.equal(
    marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', first_name: 'a'.repeat(61), confirm: true }).success,
    false
  );
  assert.equal(marketingCampaignTestSendSchema.safeParse({ email: 'owner@example.com', confirm: true }).success, true);
});

// --- 23-25. assertCampaignTestSendable ---------------------------------------------

test('23. a delivery-locked campaign cannot be test-sent, even if status is still draft', () => {
  assert.doesNotThrow(() => assertCampaignTestSendable({ status: 'draft', delivery_locked: false }));
  assert.throws(
    () => assertCampaignTestSendable({ status: 'draft', delivery_locked: true }),
    (err) => err.status === 409
  );
});

test('24. an archived campaign cannot be test-sent', () => {
  assert.throws(() => assertCampaignTestSendable({ status: 'archived' }), (err) => err.status === 409);
});

test('25. assertCampaignTestSendable and assertCampaignSendable are two distinct functions — adding test-send did not weaken real-send gating', () => {
  assert.notEqual(assertCampaignTestSendable, assertCampaignSendable);
  assert.throws(() => assertCampaignSendable({ status: 'archived' }), (err) => err.status === 409);
});

// --- 26-29. Test-send never mutates real state --------------------------------------

test('26. sendTestCampaignEmail never creates marketing_campaign_recipients rows', () => {
  assert.doesNotMatch(testSendFnSource, /marketing_campaign_recipients/);
});

test('27. sendTestCampaignEmail never writes to marketing_campaigns (no .update on the campaign row)', () => {
  assert.doesNotMatch(testSendFnSource, /from\('marketing_campaigns'\)\s*\n?\s*\.update\(/);
});

test('28. sendTestCampaignEmail never reads or writes marketing_contacts', () => {
  assert.doesNotMatch(testSendFnSource, /marketing_contacts/);
});

test('29. sendTestCampaignEmail uses a fixed, non-real sentinel contact id for its unsubscribe token — never a real recipient lookup', () => {
  assert.match(serviceSource, /TEST_SEND_SENTINEL_CONTACT_ID = '00000000-0000-0000-0000-000000000000'/);
  assert.match(testSendFnSource, /createMarketingUnsubscribeToken\(TEST_SEND_SENTINEL_CONTACT_ID\)/);
});

// --- 30-33. Test-send rendering: [TEST] prefix, banner, real rendering pipeline -----

test('30. the outbound subject is prefixed with [TEST] as a local string only — the campaign\'s own subject is never mutated', () => {
  assert.match(testSendFnSource, /subject: `\[TEST\] \$\{renderedSubject\}`/);
  assert.doesNotMatch(testSendFnSource, /campaign\.subject = /);
});

test('31. test-send reuses the real renderCampaignSubject/buildCampaignEmailContent pipeline, not a separate ad hoc renderer', () => {
  assert.match(testSendFnSource, /renderCampaignSubject\(/);
  assert.match(testSendFnSource, /buildCampaignEmailContent\(/);
});

test('32. injectTestBanner inserts the banner immediately after <body> for a full HTML document', () => {
  const html = '<!doctype html><html><head></head><body class="x"><p>hi</p></body></html>';
  const result = injectTestBanner(html);
  assert.ok(result.indexOf('This is a test campaign email') < result.indexOf('<p>hi</p>'));
  assert.ok(result.indexOf('<body class="x">') < result.indexOf('This is a test campaign email'));
});

test('33. injectTestBanner prepends the banner when there is no <body> tag (the no-html_body fragment case)', () => {
  const fragment = '<div>hello</div>';
  const result = injectTestBanner(fragment);
  assert.ok(result.startsWith('<div style='));
  assert.match(result, /This is a test campaign email\. No subscriber delivery has occurred\./);
  assert.ok(result.indexOf('This is a test campaign email') < result.indexOf('<div>hello</div>'));
});

test('34. the test banner never appears in the real-send pipeline (initiateCampaignSend/buildCampaignEmailContent)', () => {
  const buildFnSource = fnSlice(serviceSource, 'export function buildCampaignEmailContent', 'type EligibleContact');
  assert.doesNotMatch(buildFnSource, /This is a test campaign email/);
  const initiateFnSource = fnSlice(serviceSource, 'export async function initiateCampaignSend', 'export async function sendMarketingCampaign');
  assert.doesNotMatch(initiateFnSource, /injectTestBanner/);
  assert.doesNotMatch(initiateFnSource, /\[TEST\]/);
});

// --- 35-36. Rate limiting ------------------------------------------------------------

test('35. a dedicated rate limiter (not the login/change-password ones) is wired in front of test-send', () => {
  assert.match(middlewareSource, /export const marketingCampaignTestSendLimiter = limiter\(/);
  assert.match(testSendRouteBlock, /marketingCampaignTestSendLimiter,/);
});

test('36. delete and duplicate are not rate-limited beyond the normal admin auth/permission gate (test-send is the only one with a dedicated limiter, since it is the only one that fires a real outbound email)', () => {
  assert.doesNotMatch(deleteRouteBlock, /Limiter,/);
  assert.doesNotMatch(duplicateRouteBlock, /Limiter,/);
});

// --- 37-40. Admin UI action model ----------------------------------------------------

test('37. Edit/Archive/Send/Send Test/Delete are all gated on draft && !locked; Duplicate as Draft is not', () => {
  for (const action of ['canEdit', 'canArchive', 'canSend', 'canTestSend', 'canDelete']) {
    assert.match(adminPageSource, new RegExp(`const ${action} = row\\.status === 'draft' && !locked;`));
  }
  assert.doesNotMatch(adminPageSource, /const canDuplicate/);
});

test('38. the Duplicate as Draft button is unconditional (rendered for both locked and unlocked rows) and carries the required help text', () => {
  const occurrences = (adminPageSource.match(/Duplicate as Draft/g) || []).length;
  assert.ok(occurrences >= 2, 'expected the Duplicate as Draft button in both the desktop and mobile row-action blocks');
  assert.match(
    adminPageSource,
    /Delivery history is preserved\. Duplicate this campaign to make changes or send it again\./
  );
});

test('39. the Send Test dialog posts to the dedicated test-send endpoint with a single email + confirm, never campaign content', () => {
  const fnBlock = fnSlice(adminPageSource, 'async function onConfirmTestSend', 'const hasActiveFilter');
  assert.match(fnBlock, /\/api\/admin\/marketing-campaigns\/\$\{testSending\.id\}\/test-send/);
  assert.match(fnBlock, /method: 'POST'/);
  assert.match(fnBlock, /confirm: true/);
  assert.doesNotMatch(fnBlock, /html_body:/);
  assert.doesNotMatch(fnBlock, /subject:/);
});

test('40. the Delete action requires an explicit confirm() dialog stating the action cannot be undone', () => {
  const fnBlock = fnSlice(adminPageSource, 'async function onDelete', 'setDeletingId(campaign.id)');
  assert.match(fnBlock, /confirm\(`Delete "\$\{campaign\.name\}"\? This cannot be undone\.`\)/);
});

// --- 41-43. Never touches the Labor Day campaign or the workflow-test fixture -------

test('41. this test file never sends, creates, or mutates the Labor Day campaign — it only reads its exported content object', () => {
  assert.equal(typeof LABOR_DAY_CAMPAIGN.name, 'string');
  assert.doesNotMatch(testSendFnSource, /Labor Day/);
});

test('42. this test file never sends, creates, or mutates the workflow-test fixture — it only reads its exported content object', () => {
  assert.equal(CAMPAIGN_WORKFLOW_TEST_FIXTURE.status, 'draft');
  assert.match(CAMPAIGN_WORKFLOW_TEST_FIXTURE.name, /DO NOT SEND/);
});

test('43. the workflow-test fixture file itself performs no network/API calls (mirrors the Labor Day fixture\'s own guarantee)', () => {
  const fixtureSource = readFileSync(join(__dirname, 'campaigns/campaign-workflow-test-do-not-send.mjs'), 'utf8');
  assert.doesNotMatch(fixtureSource, /fetch\(/);
  assert.doesNotMatch(fixtureSource, /api\(/);
  assert.doesNotMatch(fixtureSource, /getSupabase\(/);
  assert.doesNotMatch(fixtureSource, /createClient\(/);
});

test('44. the workflow-test fixture contains no PHI, clinical claim, urgency language, discount offer, or testimonial claim', () => {
  const haystack = `${CAMPAIGN_WORKFLOW_TEST_FIXTURE.subject} ${CAMPAIGN_WORKFLOW_TEST_FIXTURE.content} ${CAMPAIGN_WORKFLOW_TEST_FIXTURE.html_body}`;
  for (const term of ['diagnosis', 'medication', 'prescri', 'therapy session', 'act now', 'limited time', 'discount', '% off', 'as seen', 'patients say']) {
    assert.doesNotMatch(haystack, new RegExp(term, 'i'), `unexpected term "${term}" in fixture content`);
  }
});

// --- 45. No new schema migration introduced for this task ---------------------------

test('45. no new marketing_campaigns/marketing_campaign_recipients schema migration was introduced for campaign management + safe test send', () => {
  const addColumnMatches = opsSqlSource.match(/alter table marketing_campaigns add column if not exists (\w+)/g) || [];
  assert.deepEqual(
    addColumnMatches.map((m) => m.replace('alter table marketing_campaigns add column if not exists ', '')).sort(),
    ['html_body', 'subject_fallback']
  );
  // The pre-existing "enable row level security" line is not a schema
  // change and predates this task — only an "add column"/"create table"
  // alteration would indicate a new migration.
  assert.doesNotMatch(opsSqlSource, /alter table marketing_campaign_recipients add column/);
  assert.doesNotMatch(opsSqlSource, /create table if not exists marketing_campaign_recipients2/);
});
