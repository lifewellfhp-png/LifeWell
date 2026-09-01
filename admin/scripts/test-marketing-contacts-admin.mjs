/**
 * Regression tests for the Admin Marketing Contacts directory UI (P4-I2D):
 * admin/src/lib/nav.ts, admin/src/lib/icons.ts,
 * admin/src/app/(app)/marketing-contacts/page.tsx, and the existing
 * admin/src/app/(app)/users/page.tsx permission-management screen.
 *
 * There is no DOM/React rendering harness in this repo (no jsdom, no
 * @testing-library/react — confirmed absent from admin/package.json), and
 * every existing admin/scripts/test-*.mjs file already avoids the `@/`
 * tsconfig path alias in favor of relative imports of narrow, pure modules
 * (see test-route-status.mjs, test-stats-reset-safety.mjs). The new page is
 * a full client component wired into api.ts/PageLoader.tsx, not a narrow
 * pure module, so — consistent with that established convention — these
 * tests read the real source files and assert on their exact, load-bearing
 * text rather than importing/rendering the component.
 *
 * No network calls, no Supabase, no Production data.
 *
 *   npx tsx --test scripts/test-marketing-contacts-admin.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const navSource = readFileSync(join(root, 'src', 'lib', 'nav.ts'), 'utf8');
const iconsSource = readFileSync(join(root, 'src', 'lib', 'icons.ts'), 'utf8');
const pageSource = readFileSync(join(root, 'src', 'app', '(app)', 'marketing-contacts', 'page.tsx'), 'utf8');
const usersSource = readFileSync(join(root, 'src', 'app', '(app)', 'users', 'page.tsx'), 'utf8');

function count(source, needle) {
  return source.split(needle).length - 1;
}

// 1. Marketing Contacts navigation exists.
test('1. nav.ts registers a Marketing Contacts destination', () => {
  assert.match(navSource, /href:\s*'\/marketing-contacts'/);
  assert.match(navSource, /label:\s*'Marketing Contacts'/);
  assert.match(navSource, /NAV_GROUPS[\s\S]*hrefs:\s*\['\/marketing-contacts'\]/);
  assert.match(iconsSource, /\bContact\b/);
});

// 2. Permission gating uses marketing_contacts.
test('2. the nav entry is gated by the marketing_contacts module and is not super-admin-only', () => {
  const line = navSource.split('\n').find((l) => l.includes("href: '/marketing-contacts'"));
  assert.ok(line, 'expected to find the marketing-contacts NAV_ITEMS line');
  assert.match(line, /module:\s*'marketing_contacts'/);
  assert.doesNotMatch(line, /superAdminOnly/);
});

// 3. Permission management exposes Marketing Contacts.
test('3. the Staff permission screen renders its checkbox list from STAFF_ACCESS (auto-derived from nav.ts)', () => {
  assert.match(usersSource, /import\s*\{\s*STAFF_ACCESS,\s*STAFF_MODULES\s*\}\s*from\s*'@\/lib\/nav'/);
  assert.match(usersSource, /STAFF_ACCESS\.map\(/);
  // STAFF_ACCESS is filtered from NAV_ITEMS minus superAdminOnly items — since
  // the marketing-contacts item is not superAdminOnly (test 2), it is
  // included automatically without any direct edit to users/page.tsx.
  assert.doesNotMatch(navSource, /marketing_contacts[\s\S]{0,80}superAdminOnly/);
});

// 4. Campaigns permission/nav NOT introduced.
test('4. no campaigns permission or nav entry was added', () => {
  assert.doesNotMatch(navSource, /campaign/i);
  assert.doesNotMatch(iconsSource, /campaign/i);
  assert.doesNotMatch(usersSource, /campaign/i);
});

// 5. List uses Server pagination.
test('5. the directory list calls the paginated Server endpoint, not a bulk fetch', () => {
  assert.match(pageSource, /api<ListData>\(`\/api\/admin\/marketing-contacts\?\$\{params\.toString\(\)\}`\)/);
  assert.match(pageSource, /params\.set\('page', String\(page\)\)/);
  assert.match(pageSource, /params\.set\('pageSize', String\(pageSize\)\)/);
});

// 6. pageSize never exceeds 100.
test('6. page size is limited to the fixed 25/50/100 options, matching the Server cap', () => {
  assert.match(pageSource, /const PAGE_SIZE_OPTIONS = \[25, 50, 100\] as const;/);
  assert.match(pageSource, /const DEFAULT_PAGE_SIZE = 25;/);
  assert.doesNotMatch(pageSource, /pageSize[^\n]*[2-9]\d{2,}/);
});

// 7. Search uses the API query parameter, not local filtering.
test('7. search is sent to the API and the loaded page is never filtered client-side', () => {
  assert.match(pageSource, /params\.set\('search', debouncedSearch\)/);
  assert.doesNotMatch(pageSource, /items\.filter/);
});

// 8. Filters use the API query.
test('8. status/audience/source filters are sent to the API as query parameters', () => {
  assert.match(pageSource, /params\.set\('marketing_status', statusFilter\)/);
  assert.match(pageSource, /params\.set\('audience_type', audienceFilter\)/);
  assert.match(pageSource, /params\.set\('source', sourceFilter\)/);
});

// 9. Search/filter changes reset pagination to page 1.
test('9. changing search, a filter, or the page size resets to page 1', () => {
  assert.ok(
    count(pageSource, 'setPage(1)') >= 5,
    'expected setPage(1) to appear for search-debounce, each filter, and the page-size control'
  );
});

// 10. Create defaults to Pending.
test('10. a new contact defaults to marketing_status "pending"', () => {
  assert.match(pageSource, /marketing_status:\s*'pending' as MarketingStatus,/);
});

// 11. Manual UI creation always sends source=manual.
test('11. contacts created through this screen are always recorded with source "manual"', () => {
  assert.match(pageSource, /source:\s*'manual',/);
  // Source is not offered as a selectable create field.
  assert.doesNotMatch(pageSource, /id="mc-source"/);
});

// 12. Subscribed creation requires (and safely supplies) a consent source.
test('12. selecting Subscribed on create automatically and only ever records consent_source "manual"', () => {
  assert.match(
    pageSource,
    /if \(createForm\.marketing_status === 'subscribed'\) \{\s*payload\.consent_source = 'manual';\s*\}/
  );
  // The create screen never offers CSV Import / Website Signup as a
  // truthful-sounding but false provenance claim for a hand-entered
  // contact — see the design-decision comment above onCreate().
  assert.doesNotMatch(pageSource, /id="mc-consent"/);
});

// 13. Audience does not imply subscribed.
test('13. audience type is explicitly labeled as not indicating consent, and never sets marketing_status', () => {
  assert.ok(
    count(pageSource, 'Audience type does not indicate marketing consent.') >= 2,
    'expected the disclaimer on both the create and edit forms'
  );
  assert.doesNotMatch(pageSource, /audience_type[^\n]*===[^\n]*existing_patient[\s\S]{0,120}marketing_status\s*=/);
});

// 14. email_normalized is never editable.
test('14. email_normalized is never referenced (Postgres-computed, never application-writable)', () => {
  assert.doesNotMatch(pageSource, /email_normalized/);
});

// 15. No clinical fields.
test('15. no clinical fields (diagnosis/medication/symptom/treatment/notes) are present', () => {
  for (const term of ['diagnosis', 'medication', 'symptom', 'treatment', 'notes']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected clinical term "${term}"`);
  }
});

// 16. No phone/SMS marketing field.
test('16. no phone or SMS marketing field exists', () => {
  assert.doesNotMatch(pageSource, /phone/i);
  assert.doesNotMatch(pageSource, /\bsms\b/i);
});

// 17. No Delete action.
test('17. there is no delete/trash action anywhere in the directory UI', () => {
  assert.doesNotMatch(pageSource, /'DELETE'/);
  assert.doesNotMatch(pageSource, />\s*Delete\s*</);
  assert.doesNotMatch(pageSource, /Trash/i);
});

// 18-22. Sticky status matrix matches the Server's assertMarketingStatusTransition reject-set exactly.
function extractOptions(status) {
  const match = pageSource.match(new RegExp(`${status}:\\s*\\[([^\\]]*)\\]`));
  assert.ok(match, `expected to find a STATUS_OPTIONS_BY_CURRENT entry for "${status}"`);
  return match[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
}

test('18. an unsubscribed contact cannot be offered Subscribed', () => {
  assert.ok(!extractOptions('unsubscribed').includes('subscribed'));
});

test('19. an unsubscribed contact cannot be offered Pending', () => {
  assert.ok(!extractOptions('unsubscribed').includes('pending'));
});

test('20. a suppressed contact cannot be offered Subscribed', () => {
  assert.ok(!extractOptions('suppressed').includes('subscribed'));
});

test('21. a suppressed contact cannot be offered Pending', () => {
  assert.ok(!extractOptions('suppressed').includes('pending'));
});

test('22. a suppressed contact cannot be offered Unsubscribed', () => {
  assert.ok(!extractOptions('suppressed').includes('unsubscribed'));
  assert.deepEqual(extractOptions('suppressed'), ['suppressed']);
});

// 23. Suppression reason uses only the Server-controlled values.
test('23. suppression reason is a controlled select, never free text', () => {
  assert.match(
    pageSource,
    /const SUPPRESSION_REASONS = \['hard_bounce', 'spam_complaint', 'administrative', 'other'\] as const;/
  );
  assert.match(pageSource, /SUPPRESSION_REASONS\.map\(/);
  assert.doesNotMatch(pageSource, /id="mc-edit-suppression"[\s\S]{0,40}<textarea/);
});

// 24. Duplicate email (409) is handled cleanly, surfacing the Server's own message.
test('24. a 409 duplicate-email response is shown via the existing error-banner convention', () => {
  assert.match(pageSource, /setCreateError\(res\.message \|\| 'Could not add marketing contact\.'\)/);
  assert.doesNotMatch(pageSource, /JSON\.stringify\(res\)/);
});

// 25. No email-provider integration.
test('25. no email-sending/provider integration exists on this screen', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
  }
});

// 26. No patient-system integration.
test('26. no clinical/patient-system integration exists on this screen', () => {
  // "clinical" itself legitimately appears in this page's own disclaimer
  // copy ("never a patient record — clinical details never belong here"),
  // so the check targets actual integration surfaces, not that word.
  for (const term of ['charm', 'medicalmine', 'importPatient', 'syncPatient', '/api/clinical']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected patient-system reference "${term}"`);
  }
  assert.doesNotMatch(pageSource, /fetch\([^)]*clinical/i);
});

// 27. No contact data persisted to browser storage.
test('27. contact directory data is never written to localStorage/sessionStorage', () => {
  assert.doesNotMatch(pageSource, /localStorage/);
  assert.doesNotMatch(pageSource, /sessionStorage/);
});

// 28. No campaign UI.
test('28. no campaign-building or campaign-sending UI exists on this screen', () => {
  assert.doesNotMatch(pageSource, /campaign/i);
});
