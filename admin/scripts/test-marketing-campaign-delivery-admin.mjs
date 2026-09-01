/**
 * Regression tests for the Admin campaign Send workflow (P4-I5B), added on
 * top of the P4-I4B Campaigns page.
 *
 * Same convention as the other marketing-* admin test files: no DOM/React
 * rendering harness exists in this repo, so these tests read the real
 * source file and assert on its exact, load-bearing text.
 *
 * No network calls, no Supabase, no Paubox, no Production data.
 *
 *   npx tsx --test scripts/test-marketing-campaign-delivery-admin.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pageSource = readFileSync(join(root, 'src', 'app', '(app)', 'marketing-campaigns', 'page.tsx'), 'utf8');

function fnSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const openSendSource = fnSlice(pageSource, 'function openSend', 'function closeSend');
const onConfirmSendSource = fnSlice(pageSource, 'async function onConfirmSend', '{!sendResult ?');
const sendDialogSource = pageSource.slice(pageSource.indexOf('{sending ? ('));

// 1/2. Send action exists only for draft campaigns.
test('1/2. Send is offered only for draft campaigns (desktop and mobile) — never for archived', () => {
  const sendGuardCount = (
    pageSource.match(/row\.status === 'draft' \? \(\s*<button type="button" className="btn btn-primary" onClick=\{\(\) => openSend\(row\)\}/g) || []
  ).length;
  assert.equal(sendGuardCount, 2, 'expected the draft-only guard on both desktop and mobile Send buttons');
  assert.doesNotMatch(pageSource, /row\.status !== 'archived'[\s\S]{0,80}Send/);
});

// 3. Send opens a review dialog.
test('3. clicking Send opens a dedicated review dialog', () => {
  assert.match(openSendSource, /setSending\(campaign\)/);
  assert.match(pageSource, /\{sending \? \(/);
});

// 4-8. Review dialog content.
test('4. campaign name is shown in the review dialog', () => {
  assert.match(sendDialogSource, /\{sending\.name\}/);
});

test('5. subject is shown in the review dialog', () => {
  assert.match(sendDialogSource, /\{sending\.subject\}/);
});

test('6. audience is shown in the review dialog', () => {
  assert.match(sendDialogSource, /audienceLabel\(sending\.audience_type\)/);
});

test('7. the current eligible contact count is shown', () => {
  assert.match(sendDialogSource, /Current eligible contacts/);
  assert.match(sendDialogSource, /sendEligible/);
});

test('8. a plain-text content preview is shown', () => {
  assert.match(sendDialogSource, /\{sending\.content\}/);
  assert.match(sendDialogSource, /whiteSpace: 'pre-wrap'/);
});

// 9. Protection copy.
test('9. copy states unsubscribed/suppressed contacts will not receive the campaign', () => {
  assert.match(sendDialogSource, /Unsubscribed and suppressed contacts will not receive this campaign\./);
});

test('copy states eligibility is re-checked at send time', () => {
  assert.match(sendDialogSource, /Eligibility is checked again for each contact at the moment of sending\./);
});

// 10/11. Checkbox behavior.
test('10. the confirmation checkbox starts unchecked', () => {
  assert.match(openSendSource, /setSendChecked\(false\)/);
  assert.doesNotMatch(sendDialogSource, /checked=\{true\}/);
});

test('11. Send stays disabled until the checkbox is checked', () => {
  assert.match(sendDialogSource, /disabled=\{!sendChecked \|\| sendSubmitting \|\| sendEligibleLoading\}/);
});

// 12/13. Endpoint + GET safety.
test('12. confirming calls the dedicated POST send endpoint', () => {
  assert.match(onConfirmSendSource, /\/api\/admin\/marketing-campaigns\/\$\{sending\.id\}\/send/);
  assert.match(onConfirmSendSource, /method:\s*'POST'/);
});

test('13. no GET request can ever trigger a send — the eligible-count fetch is a separate read-only GET to recipient-preview', () => {
  assert.doesNotMatch(onConfirmSendSource, /method:\s*'GET'/);
  assert.match(openSendSource, /recipient-preview/);
  assert.doesNotMatch(openSendSource, /\/send/);
});

// 14/15. No Schedule, no Test Send.
test('14. no Schedule action exists', () => {
  assert.doesNotMatch(sendDialogSource, />\s*Schedule\s*</);
});

test('15. no Test Send action exists', () => {
  assert.doesNotMatch(pageSource, /Test Send/i);
});

// 16. No automatic sending.
test('16. sending is only ever triggered by the explicit Send button, never automatically', () => {
  assert.doesNotMatch(pageSource, /useEffect\([^)]*onConfirmSend/s);
  assert.match(sendDialogSource, /onClick=\{onConfirmSend\}/);
  const onConfirmSendCallCount = (pageSource.match(/onConfirmSend/g) || []).length;
  // 1 definition + 1 call site (the button's onClick).
  assert.equal(onConfirmSendCallCount, 2);
});

// 17. Result shows aggregate counts.
test('17. the result view shows the full aggregate breakdown', () => {
  for (const field of ['requested', 'snapshotted', 'sent', 'failed', 'skipped']) {
    assert.match(sendDialogSource, new RegExp(`sendResult\\.${field}`));
  }
});

// 18. Accurate wording.
test('18. wording says "accepted"/"sent", never "delivered"', () => {
  assert.doesNotMatch(sendDialogSource, /delivered/i);
  assert.match(sendDialogSource, /Accepted by email provider/);
});

// 19. Provider/billing caveat.
test('19. a reasonable provider/billing caveat is shown', () => {
  assert.match(sendDialogSource, /Paubox account limits and billing may apply\./);
});

// 20/21. No recipient emails or tokens displayed.
test('20. no recipient email addresses are displayed in the send dialog', () => {
  assert.doesNotMatch(sendDialogSource, /\.email\b/);
});

test('21. no unsubscribe token or URL is displayed', () => {
  assert.doesNotMatch(sendDialogSource, /token/i);
  assert.doesNotMatch(sendDialogSource, /unsubscribe_url/i);
});

// 22. Errors shown safely.
test('22. send errors are surfaced via the existing error-banner convention with a clean message', () => {
  assert.match(onConfirmSendSource, /setSendError\(res\.message \|\| 'Could not send this campaign\.'\)/);
  assert.match(sendDialogSource, /\{sendError \? <div className="error-banner">\{sendError\}<\/div> : null\}/);
});
