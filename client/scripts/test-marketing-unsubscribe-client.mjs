/**
 * Regression tests for the public marketing-unsubscribe landing page
 * (P4-I3): client/src/app/unsubscribe/page.tsx and
 * client/src/components/sections/UnsubscribeLanding.tsx.
 *
 * Same convention as the admin/server marketing-contacts test files: no
 * DOM/React rendering harness exists in this repo, so these tests read the
 * real source files and assert on their exact, load-bearing text. Plain
 * node:test (no tsx needed — nothing here is imported/executed as a
 * module, only read as text).
 *
 * No network calls, no Supabase, no Production data.
 *
 *   node --test scripts/test-marketing-unsubscribe-client.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pagePath = join(root, 'src', 'app', 'unsubscribe', 'page.tsx');
const componentPath = join(root, 'src', 'components', 'sections', 'UnsubscribeLanding.tsx');
const apiPath = join(root, 'src', 'lib', 'api.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const componentSource = readFileSync(componentPath, 'utf8');
const apiSource = readFileSync(apiPath, 'utf8');

function fnSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const onUnsubscribeSource = fnSlice(componentSource, 'async function onUnsubscribe', 'return (');
// The rendered JSX only — excludes the module docblock, which legitimately
// discusses email/audience/suppression in prose while documenting why none
// of them are ever displayed.
const renderedJsx = componentSource.slice(componentSource.indexOf('return ('));

// 1. /unsubscribe route exists.
test('1. the /unsubscribe route exists', () => {
  assert.ok(existsSync(pagePath));
  assert.match(pageSource, /export default function UnsubscribePage/);
  assert.match(pageSource, /<UnsubscribeLanding \/>/);
});

// 2. GET/render alone performs no mutation.
test('2. rendering the page never fires the unsubscribe request on its own — only an explicit click does', () => {
  // No effect hook auto-calls the submit function; onUnsubscribe is only
  // ever wired to a button's onClick.
  assert.doesNotMatch(componentSource, /useEffect\(/);
  assert.match(componentSource, /onClick=\{onUnsubscribe\}/);
});

// 3. Token is not displayed.
test('3. the token value is never rendered into the page', () => {
  assert.doesNotMatch(componentSource, /\{token\}/);
});

// 4. Email is not displayed. ("email" itself legitimately appears in this
// page's own copy, e.g. "Unsubscribe from marketing emails" — the check is
// for an actual email address being fetched/interpolated, not the word.
test('4. no email address is fetched, stored, or displayed in the rendered page', () => {
  assert.doesNotMatch(componentSource, /\.email\b/);
  assert.doesNotMatch(componentSource, /searchParams\.get\('email'\)/);
  assert.doesNotMatch(renderedJsx, /\{.*[Ee]mail.*\}/);
});

// 5. Patient/audience status not displayed.
test('5. no patient/audience classification is displayed in the rendered page', () => {
  assert.doesNotMatch(pageSource, /audience/i);
  assert.doesNotMatch(pageSource, /patient/i);
  assert.doesNotMatch(renderedJsx, /audience/i);
  assert.doesNotMatch(renderedJsx, /patient/i);
  assert.doesNotMatch(renderedJsx, /suppress/i);
});

// 6. Mutation uses POST.
test('6. the unsubscribe request is sent as a POST, triggered only by the explicit click handler', () => {
  assert.match(apiSource, /export const submitUnsubscribe = \(token: string\) => post\('\/api\/marketing\/unsubscribe', \{ token \}\);/);
  assert.match(apiSource, /method: 'POST'/);
  assert.match(onUnsubscribeSource, /await submitUnsubscribe\(token\)/);
});

// 7. Success state is neutral/professional.
test("7. the success state shows neutral, professional copy — not raw server internals", () => {
  assert.match(componentSource, /stage === 'success'/);
  assert.match(componentSource, /You.{0,10}re unsubscribed/);
});

// 8. Invalid-token state is neutral.
test('8. the invalid/problem state shows a generic, non-alarming message with no internal detail', () => {
  assert.match(componentSource, /stage === 'problem'/);
  assert.match(componentSource, /This link is invalid or has expired\./);
  assert.doesNotMatch(componentSource, /supabase/i);
  assert.doesNotMatch(componentSource, /postgres/i);
});

// 9. No marketing email sent.
test('9. no email-provider integration exists on this page', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    for (const src of [pageSource, componentSource]) {
      assert.doesNotMatch(src, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
    }
  }
});

// 10. No Admin authentication required.
test('10. no Admin authentication is required to view or use this page', () => {
  for (const src of [pageSource, componentSource]) {
    assert.doesNotMatch(src, /useAuth/);
    assert.doesNotMatch(src, /Authorization/);
    assert.doesNotMatch(src, /lw_admin_token/);
  }
});
