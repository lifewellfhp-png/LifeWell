/**
 * Regression tests for the Admin Resubscribe UI (P4-I3), added on top of
 * the P4-I2D directory page and P4-I2E import UI.
 *
 * Same convention as the other marketing-contacts admin test files: no
 * DOM/React rendering harness exists in this repo, so these tests read the
 * real page source and assert on its exact, load-bearing text.
 *
 * No network calls, no Supabase, no Production data.
 *
 *   npx tsx --test scripts/test-marketing-unsubscribe-admin.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pageSource = readFileSync(join(root, 'src', 'app', '(app)', 'marketing-contacts', 'page.tsx'), 'utf8');

function fnSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const openResubscribeSource = fnSlice(pageSource, 'function openResubscribe', 'function closeResubscribe');
const onConfirmResubscribeSource = fnSlice(pageSource, 'async function onConfirmResubscribe', 'function openImport');
const dialogSource = fnSlice(pageSource, '{resubscribing ? (', '{importOpen ? (');

// 1. Unsubscribed contact shows a separate Resubscribe action.
test('1. an unsubscribed contact shows a separate Resubscribe action (desktop and mobile)', () => {
  const count = (pageSource.match(/row\.marketing_status === 'unsubscribed'/g) || []).length;
  assert.equal(count, 2, 'expected the unsubscribed guard on both the desktop table and mobile-card actions');
  assert.match(pageSource, /onClick=\{\(\) => openResubscribe\(row\)\}/);
});

// 2. Suppressed contact does NOT show Resubscribe.
test('2. a suppressed contact never sees Resubscribe (the guard is exactly === "unsubscribed", not a broader condition)', () => {
  assert.doesNotMatch(pageSource, /row\.marketing_status !== 'subscribed'/);
  assert.doesNotMatch(pageSource, /row\.marketing_status === 'suppressed'[\s\S]{0,60}Resubscribe/);
});

// 3/4. Generic Edit still restricts subscribed for unsubscribed/suppressed.
test('3. generic Edit does not offer Subscribed for an unsubscribed contact', () => {
  const match = pageSource.match(/unsubscribed:\s*\[([^\]]*)\]/);
  assert.ok(match);
  const options = match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.ok(!options.includes('subscribed'));
});

test('4. generic Edit does not offer Subscribed for a suppressed contact', () => {
  const match = pageSource.match(/suppressed:\s*\[([^\]]*)\]/);
  assert.ok(match);
  const options = match[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  assert.deepEqual(options, ['suppressed']);
});

// 5. Resubscribe opens a confirmation dialog.
test('5. clicking Resubscribe opens a dedicated confirmation dialog', () => {
  assert.match(openResubscribeSource, /setResubscribing\(contact\)/);
  assert.match(pageSource, /\{resubscribing \? \(/);
});

// 6. Checkbox starts unchecked.
test('6. the confirmation checkbox always starts unchecked, never pre-checked', () => {
  assert.match(openResubscribeSource, /setResubscribeChecked\(false\)/);
  assert.doesNotMatch(dialogSource, /checked=\{true\}/);
});

// 7. Confirm button disabled until checked.
test('7. the confirm button stays disabled until the checkbox is checked', () => {
  assert.match(dialogSource, /disabled=\{!resubscribeChecked \|\| resubscribeSaving\}/);
});

// 8/9. Dedicated endpoint, never generic PATCH.
test('8. confirming calls the dedicated resubscribe endpoint', () => {
  assert.match(
    onConfirmResubscribeSource,
    /\/api\/admin\/marketing-contacts\/\$\{resubscribing\.id\}\/resubscribe/
  );
  assert.match(onConfirmResubscribeSource, /method:\s*'POST'/);
});

test("9. resubscription never uses generic PATCH", () => {
  assert.doesNotMatch(onConfirmResubscribeSource, /method:\s*'PATCH'/);
});

// 10/11. Explanatory copy.
test('10. copy explains previous unsubscribe history is preserved', () => {
  assert.match(dialogSource, /previous unsubscribe is preserved/i);
});

test('11. copy explains this is a new explicit consent event', () => {
  assert.match(dialogSource, /new marketing consent event/i);
});

// 12. No arbitrary consent source picker.
test('12. there is no consent-source picker on the resubscribe dialog — the server always records manual', () => {
  assert.doesNotMatch(dialogSource, /<select/);
  assert.match(onConfirmResubscribeSource, /body:\s*JSON\.stringify\(\{\s*confirm:\s*true\s*\}\)/);
});

// 13. No unsuppress action.
test('13. no unsuppress/activate action exists anywhere on this page', () => {
  assert.doesNotMatch(pageSource, /unsuppress/i);
  assert.doesNotMatch(pageSource, />\s*Activate\s*</);
});

// 14. No email send action.
test('14. no email-send action is attached to resubscribe or unsubscribe', () => {
  assert.doesNotMatch(dialogSource, />\s*Send\s*</);
  for (const term of ['paubox', 'mailchimp', 'convertkit']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'));
  }
});
