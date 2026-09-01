/**
 * Regression tests for the Admin Marketing Campaigns draft builder
 * (P4-I4B): admin/src/app/(app)/marketing-campaigns/page.tsx and the
 * nav.ts/icons.ts wiring that exposes it.
 *
 * Same convention as the other marketing-* admin test files: no DOM/React
 * rendering harness exists in this repo, so these tests read the real
 * source files and assert on their exact, load-bearing text.
 *
 * No network calls, no Supabase, no Production data.
 *
 *   npx tsx --test scripts/test-marketing-campaigns-admin.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const navSource = readFileSync(join(root, 'src', 'lib', 'nav.ts'), 'utf8');
const pageSource = readFileSync(join(root, 'src', 'app', '(app)', 'marketing-campaigns', 'page.tsx'), 'utf8');

function fnSlice(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const onCreateSource = fnSlice(pageSource, 'async function onCreate', 'function openEdit');
const onEditSource = fnSlice(pageSource, 'async function onEdit', 'async function onArchive');
const previewDialogSource = pageSource.slice(pageSource.indexOf('{previewing ? ('));

// 1. Campaigns appears under the existing Marketing group.
test('1. Campaigns is added to the existing Marketing nav group, not a new group', () => {
  const groupMatch = navSource.match(/\{\s*label:\s*'Marketing',\s*hrefs:\s*\[([^\]]*)\]\s*\}/);
  assert.ok(groupMatch, 'expected to find the Marketing nav group');
  assert.match(groupMatch[1], /'\/marketing-contacts'/);
  assert.match(groupMatch[1], /'\/marketing-campaigns'/);
  const marketingGroupCount = (navSource.match(/label:\s*'Marketing'/g) || []).length;
  assert.equal(marketingGroupCount, 1, 'expected exactly one Marketing group, not a second one');
});

// 2. Dedicated marketing_campaigns permission (nav-wired).
test('2. the Campaigns nav item is gated by its own marketing_campaigns module', () => {
  const line = navSource.split('\n').find((l) => l.includes("href: '/marketing-campaigns'"));
  assert.ok(line);
  assert.match(line, /module:\s*'marketing_campaigns'/);
  assert.doesNotMatch(line, /module:\s*'marketing_contacts'/);
  assert.doesNotMatch(line, /superAdminOnly/);
});

// 3. Campaign directory exists.
test('3. the Campaigns directory page exists', () => {
  assert.match(pageSource, /export default function MarketingCampaignsPage/);
  assert.match(pageSource, /\/api\/admin\/marketing-campaigns/);
});

// 4/5. Create draft exists with the correct fields.
test('4. an "Add campaign draft" create action exists', () => {
  assert.match(pageSource, />\s*Add campaign draft\s*</);
  assert.match(pageSource, /onClick=\{openCreate\}/);
});

test('5. the create/edit forms expose Name, Subject, Preview Text, Audience, and Content', () => {
  for (const id of ['mc-name', 'mc-subject', 'mc-preview', 'mc-audience', 'mc-content']) {
    assert.match(pageSource, new RegExp(`id="${id}"`), `expected a field with id="${id}"`);
  }
});

// 6/7. Consent helper copy.
test('6. audience-does-not-establish-consent helper copy exists', () => {
  const count = (pageSource.match(/Audience classification does not establish marketing consent\./g) || []).length;
  assert.ok(count >= 2, 'expected the disclaimer on both create and edit forms');
});

test('7. only-subscribed-are-eligible copy exists', () => {
  // The source line-wraps this sentence across two JSX text lines, so
  // whitespace (including the newline + indentation) must be tolerant.
  assert.match(pageSource, /Only contacts currently marked\s+Subscribed are counted as eligible\./);
});

// 8/9. Eligible count display, zero allowed.
test('8. the current eligible contact count is displayed', () => {
  assert.match(pageSource, /Current eligible contacts/);
  assert.match(pageSource, /previewEligible/);
});

test('9. saving a draft is never gated by the eligible count (zero eligible is allowed)', () => {
  assert.doesNotMatch(onCreateSource, /previewEligible/);
  assert.doesNotMatch(onEditSource, /previewEligible/);
});

// 10-12. Plain text only.
test('10. content uses a plain textarea, not a rich-text component', () => {
  assert.match(pageSource, /id="mc-content"[\s\S]{0,20}\/>|<textarea[\s\S]{0,120}id="mc-content"/);
  assert.match(pageSource, /<textarea/);
});

test('11. dangerouslySetInnerHTML is never used', () => {
  assert.doesNotMatch(pageSource, /dangerouslySetInnerHTML/);
});

test('12. no rich-text editor library is used', () => {
  for (const lib of ['quill', 'tiptap', 'draft-js', 'slate', 'ckeditor', 'tinymce']) {
    assert.doesNotMatch(pageSource, new RegExp(lib, 'i'));
  }
});

// 13. Content preview exists.
test('13. a plain-text content preview is rendered (escaped JSX interpolation, not raw HTML)', () => {
  assert.match(pageSource, /\{previewing\.content\}/);
  assert.match(pageSource, /whiteSpace: 'pre-wrap'/);
});

// 14/15. Archived viewable, not editable.
test('14. archived campaigns remain viewable (View has no status gate)', () => {
  assert.match(pageSource, /onClick=\{\(\) => setViewing\(row\)\}/);
});

test('15. archived campaigns are not editable — Edit is only offered for draft campaigns', () => {
  const editGuardCount = (pageSource.match(/row\.status === 'draft' \? \(\s*<button type="button" className="btn btn-ghost" onClick=\{\(\) => openEdit\(row\)\}/g) || []).length;
  assert.ok(editGuardCount >= 1, 'expected Edit to be conditionally rendered only for draft campaigns');
});

// 16. Archive action exists.
test('16. an Archive action exists and calls the dedicated archive endpoint', () => {
  assert.match(pageSource, />\s*Archive\s*</);
  assert.match(pageSource, /\/api\/admin\/marketing-campaigns\/\$\{campaign\.id\}\/archive/);
  assert.match(pageSource, /method:\s*'POST'/);
});

// 17/18. No delete, no unarchive.
test('17. there is no delete/trash action', () => {
  assert.doesNotMatch(pageSource, /'DELETE'/);
  assert.doesNotMatch(pageSource, />\s*Delete\s*</);
  assert.doesNotMatch(pageSource, /Trash/i);
});

test('18. there is no unarchive/restore action', () => {
  assert.doesNotMatch(pageSource, /unarchive/i);
  assert.doesNotMatch(pageSource, />\s*Restore\s*</);
});

// 19-22. No send/schedule anywhere.
test('19/20/21. no Send, Send Now, or Test Send action exists', () => {
  assert.doesNotMatch(pageSource, />\s*Send( Now)?\s*</);
  assert.doesNotMatch(pageSource, /Test Send/i);
});

test('22. no Schedule action exists', () => {
  assert.doesNotMatch(pageSource, />\s*Schedule\s*</);
});

// 23/24. No provider integration or delivery metrics.
test('23. no email-provider integration exists on this page', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
  }
});

test('24. no delivery metrics are displayed', () => {
  for (const term of ['sent_count', 'delivered_count', 'opened_count', 'clicked_count', 'failed_count']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'));
  }
});

// 25/26. No recipient list/email exposure.
test('25. the recipient preview never exposes a list of contacts', () => {
  assert.doesNotMatch(previewDialogSource, /\.map\(/);
  assert.match(previewDialogSource, /previewEligible/);
});

test('26. no email addresses are shown by the recipient preview', () => {
  assert.doesNotMatch(previewDialogSource, /\.email\b/);
});

// 27. No personalization/merge fields.
test('27. no personalization/merge-field syntax is supported', () => {
  // `{{` alone is not a safe signal — JSX inline style objects
  // (style={{ ... }}) legitimately use double braces throughout this file.
  // The real signal is an actual merge-field-shaped token.
  assert.doesNotMatch(pageSource, /\{\{\s*(first_name|patient_name|diagnosis|provider|appointment)\s*\}\}/i);
  for (const term of ['merge field', 'merge_field', 'personalization', 'personalisation']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'));
  }
});

// 28/29. Unsubscribe note is non-functional, no real token.
test('28. the unsubscribe note is static, non-functional text', () => {
  assert.match(pageSource, /An unsubscribe option will be included when this campaign is delivered\./);
});

test('29. no real unsubscribe token is generated on this page', () => {
  assert.doesNotMatch(pageSource, /createMarketingUnsubscribeToken/);
  assert.doesNotMatch(pageSource, /unsubscribe_token/);
});

// 30. API errors rendered safely.
test('30. API errors are surfaced via the existing error-banner convention with clean messages', () => {
  assert.match(onCreateSource, /setCreateError\(res\.message \|\| 'Could not create this campaign draft\.'\)/);
  assert.match(onEditSource, /setEditError\(res\.message \|\| 'Could not update this campaign draft\.'\)/);
  assert.match(pageSource, /\{error \? <div className="error-banner">\{error\}<\/div> : null\}/);
});
