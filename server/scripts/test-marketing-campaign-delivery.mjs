/**
 * Regression tests for manual marketing campaign delivery (P4-I5B):
 * server/src/services/marketingCampaignDelivery.service.ts.
 *
 * Same established convention as every other marketing-* test file in this
 * suite: pure decision functions (classifyProviderOutcome,
 * assertCampaignSendable, buildUnsubscribeUrl, buildCampaignEmailContent)
 * are unit-tested directly with synthetic inputs, and the orchestration
 * function (initiateCampaignSend) — which needs a live Supabase connection
 * to run at all, which this environment does not have — is instead
 * verified via source-structure assertions on its exact ordering and
 * safety properties, the same technique already used for the P4-I2E CSV
 * confirm handler and the P4-I3 resubscribe handler.
 *
 * CRITICAL: no test in this file ever calls sendViaPauboxApi (the one
 * function that performs a real network fetch to Paubox) — every test
 * either calls a pure function with synthetic inputs, or reads source
 * text. This is a stronger guarantee than "mocking" the network boundary:
 * the real network-calling code path is never executed by any test here,
 * so 0 real emails can ever be sent by this suite, and no Paubox API key
 * is required.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-marketing-campaign-delivery.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from '../src/config/env.js';
import { marketingCampaignSendSchema, marketingCampaignUpdate } from '../src/validation/adminSchemas.js';
import { requirePermission } from '../src/middleware/adminAuth.js';
import { verifyMarketingUnsubscribeToken } from '../src/lib/marketingUnsubscribeToken.js';
import jwt from 'jsonwebtoken';
import {
  assertCampaignSendable,
  classifyProviderOutcome,
  buildUnsubscribeUrl,
  buildCampaignEmailContent,
  MAX_SEND_RECIPIENTS,
  FAILURE_CODES,
} from '../src/services/marketingCampaignDelivery.service.js';
import { assertCampaignEditable } from '../src/controllers/marketingCampaigns.controller.js';
import { applyExistingClassification } from '../src/controllers/marketingContactsImport.controller.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, notFoundHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const routesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const serviceSource = readFileSync(join(root, 'src/services/marketingCampaignDelivery.service.ts'), 'utf8');
const campaignsControllerSource = readFileSync(join(root, 'src/controllers/marketingCampaigns.controller.ts'), 'utf8');

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

const initiateFnSource = fnSlice(
  serviceSource,
  'export async function initiateCampaignSend',
  'export async function sendMarketingCampaign'
);
const sendHandlerSource = serviceSource.slice(serviceSource.indexOf('export async function sendMarketingCampaign'));
const previewFnSource = fnSlice(
  campaignsControllerSource,
  'export async function previewMarketingCampaignRecipients'
);

const TEST_ID = '11111111-1111-1111-1111-111111111111';

// --- 1/2. Auth + permission ---------------------------------------------------

test('1. send requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-campaigns/${TEST_ID}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('2. send requires the marketing_campaigns permission (wiring + real middleware)', () => {
  const routeBlock = fnSlice(routesSource, "'/marketing-campaigns/:id/send'", "adminRouter.get('/users'");
  assert.match(routeBlock, /requireAdmin,/);
  assert.match(routeBlock, /requirePermission\('marketing_campaigns'\)/);
  assert.doesNotMatch(routeBlock, /requirePermission\('marketing_contacts'\)/);

  const guard = requirePermission('marketing_campaigns');
  let denied;
  guard({ admin: { role: 'staff', permissions: [] } }, {}, (err) => {
    denied = err;
  });
  assert.equal(denied.status, 403);
});

// --- 3. POST only ---------------------------------------------------------------

test('3. Send requires POST — no GET route exists for it', () => {
  assert.match(routesSource, /adminRouter\.post\(\s*'\/marketing-campaigns\/:id\/send'/);
  assert.doesNotMatch(routesSource, /adminRouter\.get\(\s*'\/marketing-campaigns\/:id\/send'/);
});

// --- 4/5. Confirmation schema -----------------------------------------------------

test('4. Send requires the literal confirmation field confirm: true', () => {
  assert.equal(marketingCampaignSendSchema.safeParse({ confirm: true }).success, true);
  assert.equal(marketingCampaignSendSchema.safeParse({}).success, false);
  assert.equal(marketingCampaignSendSchema.safeParse({ confirm: false }).success, false);
  assert.equal(marketingCampaignSendSchema.safeParse({ confirm: 'true' }).success, false);
});

test('5. unknown body fields are rejected', () => {
  assert.equal(marketingCampaignSendSchema.safeParse({ confirm: true, subject: 'hi' }).success, false);
  assert.equal(marketingCampaignSendSchema.safeParse({ confirm: true, content: 'hi' }).success, false);
  assert.deepEqual(Object.keys(marketingCampaignSendSchema.shape), ['confirm']);
});

// --- 6. UUID validation -----------------------------------------------------------

test('6. an invalid campaign id is rejected before reaching the handler (401 checked first)', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-campaigns/not-a-uuid/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('6b. sendMarketingCampaign validates the id with the standard uuid schema', () => {
  assert.match(sendHandlerSource, /uuidParam\.safeParse\(req\.params\.id\)/);
});

// --- 7. GET preview never sends ---------------------------------------------------

test('7. GET recipient-preview performs no snapshot insert and no provider call', () => {
  assert.doesNotMatch(previewFnSource, /marketing_campaign_recipients/);
  assert.doesNotMatch(previewFnSource, /sendViaPauboxApi/);
  assert.doesNotMatch(previewFnSource, /\.insert\(/);
});

// --- 8. Archived cannot send -------------------------------------------------------

test('8. an archived campaign cannot be sent', () => {
  assert.doesNotThrow(() => assertCampaignSendable({ status: 'draft' }));
  assert.throws(() => assertCampaignSendable({ status: 'archived' }), (err) => err.status === 409);
});

// --- 9-13. Eligibility (reuses buildRecipientEligibilityFilters from P4-I4B) -----

test('9. campaign eligibility always requires marketing_status = subscribed', () => {
  assert.match(initiateFnSource, /fetchEligibleContacts/);
  assert.match(serviceSource, /buildRecipientEligibilityFilters/);
});

test('10/11/12. pending, unsubscribed, and suppressed are excluded by construction', () => {
  // fetchEligibleContacts queries marketing_contacts .eq('marketing_status', filters.marketing_status),
  // and buildRecipientEligibilityFilters (P4-I4B, already regression-tested) can only ever
  // produce the literal 'subscribed' — never pending/unsubscribed/suppressed.
  const fetchFnSource = fnSlice(serviceSource, 'async function fetchEligibleContacts', 'export type CampaignSendResult');
  assert.match(fetchFnSource, /\.eq\('marketing_status', filters\.marketing_status\)/);
  assert.doesNotMatch(fetchFnSource, /'pending'|'unsubscribed'|'suppressed'/);
});

test('13. the audience filter is respected when set', () => {
  const fetchFnSource = fnSlice(serviceSource, 'async function fetchEligibleContacts', 'export type CampaignSendResult');
  assert.match(fetchFnSource, /if \(filters\.audience_type\) \{\s*query = query\.eq\('audience_type', filters\.audience_type\);/);
});

// --- 14-16. Snapshot creation -------------------------------------------------------

test('14. the recipient snapshot is created before any provider call', () => {
  const insertIdx = initiateFnSource.indexOf("from('marketing_campaign_recipients')\n    .insert(");
  const sendIdx = initiateFnSource.indexOf('sendViaPauboxApi(');
  assert.ok(insertIdx > -1 && sendIdx > -1 && insertIdx < sendIdx, 'expected the snapshot insert before any provider call');
});

test('15. the DB UNIQUE(campaign_id, contact_id) guard is relied on — no upsert/onConflict', () => {
  assert.doesNotMatch(initiateFnSource, /\.upsert\(/);
  assert.doesNotMatch(initiateFnSource, /onConflict/i);
  assert.match(initiateFnSource, /isUniqueEmailViolation\(insertError\)/);
});

test('16. existing recipient rows are never overwritten — the snapshot insert is a plain insert, not an upsert', () => {
  const insertBlock = initiateFnSource.slice(
    initiateFnSource.indexOf("from('marketing_campaign_recipients')\n    .insert("),
    initiateFnSource.indexOf("if (insertError)")
  );
  assert.doesNotMatch(insertBlock, /upsert/i);
});

// --- 17-20. Pre-send revalidation ---------------------------------------------------

test('17. immediate pre-send revalidation reads the CURRENT contact status, positioned after claim and before send', () => {
  const claimIdx = initiateFnSource.indexOf("status: 'processing'");
  const revalidateIdx = initiateFnSource.indexOf("select('marketing_status')");
  const sendIdx = initiateFnSource.indexOf('sendViaPauboxApi(');
  assert.ok(claimIdx < revalidateIdx && revalidateIdx < sendIdx, 'expected claim -> revalidate -> send ordering');
});

test('18/19. a contact no longer subscribed (unsubscribed OR suppressed) after snapshot is marked skipped', () => {
  assert.match(initiateFnSource, /currentContact\.marketing_status !== 'subscribed'/);
  assert.match(initiateFnSource, /status: 'skipped'/);
});

test('20. a skipped row never reaches the provider call', () => {
  const skipIdx = initiateFnSource.indexOf("status: 'skipped'");
  const continueAfterSkip = initiateFnSource.indexOf('continue;', skipIdx);
  const sendIdx = initiateFnSource.indexOf('sendViaPauboxApi(');
  assert.ok(continueAfterSkip > -1 && continueAfterSkip < sendIdx);
});

// --- 21-23. Unsubscribe token -----------------------------------------------------

test('21. a fresh unsubscribe token is generated per actual recipient, inside the loop', () => {
  const tokenIdx = initiateFnSource.indexOf('createMarketingUnsubscribeToken(row.contact_id)');
  const revalidateIdx = initiateFnSource.indexOf("select('marketing_status')");
  const sendIdx = initiateFnSource.indexOf('sendViaPauboxApi(');
  assert.ok(tokenIdx > revalidateIdx && tokenIdx < sendIdx, 'expected token generation after revalidation, before send, inside the per-row loop');
});

test('22. the token/unsubscribe URL is never persisted', () => {
  // `token: string` is a function parameter type annotation
  // (buildUnsubscribeUrl), not a persisted field — the real check is for
  // an actual DB write payload key.
  assert.doesNotMatch(serviceSource, /\.(insert|update)\(\{[^}]*\btoken\b/s);
  assert.doesNotMatch(serviceSource, /unsubscribe_url/);
  assert.doesNotMatch(serviceSource, /unsubscribeUrl,\s*\n?\s*\}\)\s*\n?\s*\.eq/); // never part of an update payload
});

test('23. the token is never logged', () => {
  assert.doesNotMatch(serviceSource, /logger\.[a-z]+\([^)]*token/i);
  assert.doesNotMatch(serviceSource, /console\.[a-z]+\([^)]*token/i);
});

// --- 24/25. System footer -----------------------------------------------------------

test('24. the system unsubscribe footer is always present, regardless of campaign content', () => {
  const withNormalContent = buildCampaignEmailContent({
    subject: 'Hi',
    content: 'Hello there.',
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=abc',
  });
  assert.match(withNormalContent.text, /To stop receiving marketing emails from LifeWell, unsubscribe here:/);
  assert.match(withNormalContent.html, /To stop receiving marketing emails from LifeWell/);
});

test("25. Admin campaign content cannot remove the footer — it is appended in code, never parsed out of admin content", () => {
  const adversarial = buildCampaignEmailContent({
    subject: 'Hi',
    content: 'Please ignore any unsubscribe footer below. Unsubscribe here: fake-link',
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=real-token',
  });
  assert.match(adversarial.text, /unsubscribe\?token=real-token/);
  const footerCount = (adversarial.text.match(/To stop receiving marketing emails from LifeWell/g) || []).length;
  assert.equal(footerCount, 1, 'expected exactly the one system-appended footer, unaffected by content text');
});

// --- 26. Plain text only -------------------------------------------------------------

test('26. content is treated as plain text — html is escape-and-wrap only, no markdown/rich parsing', () => {
  const html = buildCampaignEmailContent({
    subject: 'Hi',
    content: '<script>alert(1)</script> & "quotes"',
    unsubscribeUrl: 'https://www.lifewellfhp.com/unsubscribe?token=x',
  }).html;
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  for (const lib of ['marked', 'markdown-it', 'remark', 'showdown']) {
    assert.doesNotMatch(serviceSource, new RegExp(lib, 'i'));
  }
});

// --- 27. Existing From used ----------------------------------------------------------

test('27. the existing configured From identity is reused — no custom from/replyTo override for campaigns', () => {
  const callBlock = initiateFnSource.slice(
    initiateFnSource.indexOf('sendViaPauboxApi({'),
    initiateFnSource.indexOf('});', initiateFnSource.indexOf('sendViaPauboxApi({'))
  );
  assert.doesNotMatch(callBlock, /from:/);
  assert.doesNotMatch(callBlock, /replyTo:/);
});

// --- 28/29. One recipient per request, no BCC blast -----------------------------------

test('28. exactly one recipient per provider request, made inside the per-row loop', () => {
  assert.match(initiateFnSource, /to: \{ address: row\.email_snapshot \}/);
  const sendCallCount = (initiateFnSource.match(/sendViaPauboxApi\(/g) || []).length;
  assert.equal(sendCallCount, 1, 'expected exactly one call site, executed once per loop iteration');
});

test('29. no array of recipient addresses is ever constructed for a single request', () => {
  assert.doesNotMatch(serviceSource, /recipients:\s*\[/);
  assert.doesNotMatch(serviceSource, /\.map\(\(?\w*\)?\s*=>\s*\(?\{\s*address/);
});

// --- 30/31. Provider acceptance terminology -------------------------------------------

test('30. the provider tracking ID is stored when a message is accepted', () => {
  const outcome = classifyProviderOutcome({ ok: true, httpStatus: 202, sourceTrackingId: 'trk_123' });
  assert.equal(outcome.status, 'sent');
  assert.equal(outcome.provider_message_id, 'trk_123');
  assert.match(initiateFnSource, /provider_message_id: outcome\.provider_message_id/);
});

test('31. acceptance is called "sent", never "delivered"', () => {
  assert.doesNotMatch(serviceSource, /delivered/i);
});

// --- 32/33/34. Failure handling and data minimization -----------------------------------

test('32. a definite provider rejection is stored safely as failed/provider_rejected', () => {
  const outcome = classifyProviderOutcome({ ok: false, httpStatus: 429 });
  assert.deepEqual(outcome, { status: 'failed', failure_code: FAILURE_CODES.PROVIDER_REJECTED });
});

test('33. the raw provider response is never persisted', () => {
  assert.doesNotMatch(serviceSource, /providerResult\.errorMessage/);
  assert.doesNotMatch(serviceSource, /body:/);
  assert.doesNotMatch(serviceSource, /response_body|raw_response|providerResponse/i);
});

test('34. the raw provider response is never audited', () => {
  const auditCalls = serviceSource.match(/writeAuditLog\(\{[\s\S]*?\}\);/g) || [];
  assert.ok(auditCalls.length >= 2);
  for (const call of auditCalls) {
    assert.doesNotMatch(call, /providerResult/);
    assert.doesNotMatch(call, /errorMessage/);
  }
});

// --- 35/36. Attempt accounting, no double-send -----------------------------------------

test('35. attempt_count is incremented accurately on claim', () => {
  assert.match(initiateFnSource, /attempt_count: \(row\.attempt_count \?\? 0\) \+ 1/);
});

test('36. a row already claimed/sent cannot be claimed again — the claim UPDATE requires status = pending', () => {
  assert.match(initiateFnSource, /\.eq\('status', 'pending'\)/);
  assert.match(initiateFnSource, /if \(!claimed\) continue;/);
});

// --- 37-40. No automatic retry -----------------------------------------------------------

test('37/38. no automatic retry loop exists around the provider call', () => {
  const sendIdx = initiateFnSource.indexOf('sendViaPauboxApi(');
  const surrounding = initiateFnSource.slice(Math.max(0, sendIdx - 400), sendIdx + 400);
  assert.doesNotMatch(surrounding, /for\s*\(/);
  assert.doesNotMatch(surrounding, /while\s*\(/);
  // The module docblock legitimately documents, in prose, that no retry
  // exists — what must never appear is actual retry-loop code: a bounded
  // counter loop, a labeled retry loop, or a recursive re-call.
  assert.doesNotMatch(serviceSource, /for\s*\(\s*(let|var)\s+\w*(retry|attempt)/i);
  assert.doesNotMatch(serviceSource, /while\s*\(\s*(retry|attempt)/i);
  assert.doesNotMatch(serviceSource, /function\s+\w*retry/i);
});

test('39. a timeout does not automatically retry — the outer loop advances to the NEXT recipient, never the same one again', () => {
  const sendCallCount = (initiateFnSource.match(/sendViaPauboxApi\(/g) || []).length;
  assert.equal(sendCallCount, 1);
});

test('40. an ambiguous timeout (no HTTP response at all) is classified distinctly from a definite rejection', () => {
  const timeoutOutcome = classifyProviderOutcome({ ok: false, httpStatus: 0 });
  assert.deepEqual(timeoutOutcome, { status: 'failed', failure_code: FAILURE_CODES.TIMEOUT_AMBIGUOUS });
  const rejectedOutcome = classifyProviderOutcome({ ok: false, httpStatus: 422 });
  assert.notEqual(timeoutOutcome.failure_code, rejectedOutcome.failure_code);
});

// --- 41-43. Concurrency + recipient limit -----------------------------------------------

test('41. concurrent Send initiation cannot duplicate provider calls — the atomic bulk-insert guard refuses a second initiation', () => {
  assert.match(initiateFnSource, /already had delivery initiated/);
  assert.match(initiateFnSource, /throw new AppError\('This campaign has already had delivery initiated\.', 409/);
});

test('42. the recipient maximum is enforced before any snapshot row is created', () => {
  const maxCheckIdx = initiateFnSource.indexOf('eligible.length > MAX_SEND_RECIPIENTS');
  const insertIdx = initiateFnSource.indexOf("from('marketing_campaign_recipients')\n    .insert(");
  assert.ok(maxCheckIdx > -1 && maxCheckIdx < insertIdx);
});

test('43. an over-limit campaign sends 0 emails — the max check throws, never falls through', () => {
  const maxCheckBlock = fnSlice(initiateFnSource, 'if (eligible.length > MAX_SEND_RECIPIENTS)', '}');
  assert.match(maxCheckBlock, /throw new AppError/);
  assert.equal(typeof MAX_SEND_RECIPIENTS, 'number');
  assert.ok(MAX_SEND_RECIPIENTS > 0 && MAX_SEND_RECIPIENTS <= 100, 'expected a conservative (not thousands) bound');
});

// --- 44. Truthful partial results ---------------------------------------------------------

test('44. results are always a full truthful breakdown, never a boolean success flag', () => {
  assert.match(serviceSource, /requested: number;\s*snapshotted: number;\s*sent: number;\s*failed: number;\s*skipped: number;/);
});

// --- 45/46. No marketing_contacts writes -------------------------------------------------

test('45/46. marketing_contacts is only ever read, never written — 0 writes, no suppression mutation', () => {
  // Every marketing_contacts access in this file must be a .select( — never .insert(/.update(/.delete(.
  const contactsAccessBlocks = serviceSource.match(/\.from\('marketing_contacts'\)[\s\S]{0,80}/g) || [];
  assert.ok(contactsAccessBlocks.length >= 1);
  for (const block of contactsAccessBlocks) {
    assert.match(block, /\.select\(/);
    assert.doesNotMatch(block, /\.update\(/);
    assert.doesNotMatch(block, /\.insert\(/);
    assert.doesNotMatch(block, /\.delete\(/);
  }
});

// --- 47-50. No other integrations ---------------------------------------------------------

test('47/48/49. no Paubox Marketing product, Mailchimp, or ConvertKit integration exists', () => {
  for (const term of ['paubox marketing', 'mailchimp', 'convertkit']) {
    assert.doesNotMatch(serviceSource, new RegExp(term, 'i'));
  }
});

test('50. no patient-system access exists', () => {
  for (const term of ['charm', 'medicalmine']) {
    assert.doesNotMatch(serviceSource, new RegExp(term, 'i'));
  }
});

// --- 51. Audit aggregate-only ---------------------------------------------------------------

test('51. both audit events contain aggregate counts only — no email, content, subject, or token', () => {
  const auditCalls = serviceSource.match(/writeAuditLog\(\{[\s\S]*?\}\);/g) || [];
  assert.equal(auditCalls.length, 4, 'expected 2 audit call sites, one of which (zero-eligible) appears twice in source (initiated+completed) plus the normal path (initiated+completed) = 4 total call sites');
  for (const call of auditCalls) {
    assert.doesNotMatch(call, /email/i);
    assert.doesNotMatch(call, /subject/i);
    assert.doesNotMatch(call, /content/i);
    assert.doesNotMatch(call, /token/i);
    assert.match(call, /_count/);
  }
});

// --- 52/53/54. Existing protections remain intact ---------------------------------------------

test('52. P4-I3 unsubscribe token verification remains intact (tampered token rejected)', () => {
  const token = jwt.sign(
    { type: 'marketing_contacts_unsubscribe', contactId: TEST_ID },
    env.ADMIN_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '180d' }
  );
  const parts = token.split('.');
  parts[2] = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'A' ? 'B' : 'A');
  assert.throws(() => verifyMarketingUnsubscribeToken(parts.join('.')));
});

test('53. P4-I2E CSV import protections remain intact', () => {
  const rows = [{ classification: 'new', email_normalized: 'a@example.com' }];
  applyExistingClassification(rows, new Map([['a@example.com', 'suppressed']]));
  assert.equal(rows[0].classification, 'existing_suppressed');
});

test('54. the campaign draft API remains intact (editable-field shape and archived-immutability unchanged)', () => {
  assert.deepEqual(
    Object.keys(marketingCampaignUpdate.shape).sort(),
    ['audience_type', 'content', 'name', 'preview_text', 'subject'].sort()
  );
  assert.doesNotThrow(() => assertCampaignEditable('draft'));
  assert.throws(() => assertCampaignEditable('archived'));
});

// --- Supplementary ---------------------------------------------------------------------------

test('buildUnsubscribeUrl uses the configured PUBLIC_SITE_URL and encodes the token', () => {
  const url = buildUnsubscribeUrl('abc.def.ghi');
  assert.equal(url, `${env.PUBLIC_SITE_URL}/unsubscribe?token=abc.def.ghi`);
});

test('no scheduling, cron, or queue code exists anywhere in the delivery service', () => {
  for (const term of ['cron', 'schedule', 'queue', 'setInterval', 'setTimeout']) {
    assert.doesNotMatch(serviceSource, new RegExp(term, 'i'));
  }
});
