/**
 * Regression tests for the Admin Marketing Contacts CSV import UI (P4-I2E):
 * admin/src/app/(app)/marketing-contacts/page.tsx's Import CSV action, added
 * on top of the P4-I2D directory page.
 *
 * Same convention as test-marketing-contacts-admin.mjs: no DOM/React
 * rendering harness exists in this repo, so these tests read the real page
 * source and assert on its exact, load-bearing text.
 *
 * No network calls, no Supabase, no Production data.
 *
 *   npx tsx --test scripts/test-marketing-contacts-import-admin.mjs
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

const uploadHandlerSource = fnSlice(
  pageSource,
  'async function onImportFileSelected',
  'async function onConfirmImport'
);
const confirmHandlerSource = pageSource.slice(
  pageSource.indexOf('async function onConfirmImport'),
  pageSource.indexOf('const allowedEditStatuses')
);

// 1. Import CSV action exists.
test('1. an Import CSV action exists and opens the import modal', () => {
  assert.match(pageSource, />\s*Import CSV\s*</);
  assert.match(pageSource, /onClick=\{openImport\}/);
});

// 2. Upload calls the preview endpoint.
test('2. selecting a file calls the preview endpoint, not confirm', () => {
  assert.match(uploadHandlerSource, /\/api\/admin\/marketing-contacts\/import\/preview/);
});

// 3. Preview does not call confirm automatically.
test('3. the upload/preview handler never calls confirm or the confirm endpoint', () => {
  assert.doesNotMatch(uploadHandlerSource, /onConfirmImport/);
  assert.doesNotMatch(uploadHandlerSource, /import\/confirm/);
});

// 4. Preview summary displayed.
test('4. the preview summary (all six buckets) is rendered', () => {
  for (const field of ['total_rows', 'valid_new', 'existing', 'protected', 'duplicate_in_file', 'invalid']) {
    assert.match(pageSource, new RegExp(`importPreview\\.summary\\.${field}`), `expected summary.${field} to be displayed`);
  }
});

// 5. Row classifications displayed.
test('5. per-row classification is rendered using the labeled classification map', () => {
  assert.match(pageSource, /IMPORT_CLASSIFICATION_LABELS\[r\.classification\]/);
  assert.match(pageSource, /importPreview\.rows\.slice\(/);
});

// 6. Explicit Confirm Import required.
test('6. importing requires an explicit Confirm Import action, separate from upload', () => {
  assert.match(pageSource, /Confirm import/);
  assert.match(pageSource, /onClick=\{onConfirmImport\}/);
});

// 7. Existing contacts described as unchanged.
test('7. copy explicitly states existing contacts are not changed by import', () => {
  assert.match(pageSource, /nothing already in the directory is changed/i);
  assert.match(IMPORT_CLASSIFICATION_LABELS_SOURCE(), /unchanged/i);
});

function IMPORT_CLASSIFICATION_LABELS_SOURCE() {
  return fnSlice(pageSource, 'const IMPORT_CLASSIFICATION_LABELS', 'const IMPORT_ROW_DISPLAY_CAP');
}

// 8. Protected statuses described clearly.
test('8. protected (unsubscribed/suppressed) rows are described as not reactivatable', () => {
  assert.match(pageSource, /Unsubscribed and suppressed contacts cannot be reactivated by import/i);
  assert.match(IMPORT_CLASSIFICATION_LABELS_SOURCE(), /cannot be reactivated/i);
});

// 9. Audience != consent warning shown.
test('9. the import modal states audience type does not indicate consent', () => {
  assert.match(pageSource, /Audience type does not indicate marketing consent\./);
});

// 10. Subscribed CSV consent rule shown.
test('10. the import modal states the CSV-import consent provenance rule for subscribed rows', () => {
  assert.match(pageSource, /consent_source = csv_import/);
});

// 11. Template uses fictional example.com data.
test('11. the downloadable template uses only fictional @example.com addresses', () => {
  assert.match(pageSource, /IMPORT_TEMPLATE_CSV/);
  const templateMatch = pageSource.match(/const IMPORT_TEMPLATE_CSV =([\s\S]*?);\n\n/);
  assert.ok(templateMatch, 'expected to find the IMPORT_TEMPLATE_CSV literal');
  const emails = templateMatch[1].match(/[\w.+-]+@[\w.-]+/g) || [];
  assert.ok(emails.length > 0, 'expected the template to contain example emails');
  for (const email of emails) {
    assert.match(email, /@example\.com$/, `expected only @example.com addresses, got "${email}"`);
  }
});

// 12. No clinical fields.
test('12. no clinical fields appear in the import UI', () => {
  for (const term of ['diagnosis', 'medication', 'symptom', 'treatment']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected clinical term "${term}"`);
  }
});

// 13. No patient import/sync action.
test('13. no patient-system import/sync action exists', () => {
  for (const term of ['charm', 'medicalmine', 'syncpatient', 'importpatient']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected patient-system reference "${term}"`);
  }
});

// 14. No campaign action.
test('14. no campaign action was introduced', () => {
  assert.doesNotMatch(pageSource, /campaign/i);
});

// 15. No email-provider integration.
test('15. no email-provider integration exists in the import UI', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    assert.doesNotMatch(pageSource, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
  }
});

// 16. No localStorage/sessionStorage persistence.
test('16. CSV content, preview rows, and the preview token are never persisted to browser storage', () => {
  assert.doesNotMatch(pageSource, /localStorage/);
  assert.doesNotMatch(pageSource, /sessionStorage/);
});

// 17. Successful confirm refreshes the directory.
test('17. a successful confirm reloads the directory list', () => {
  assert.match(confirmHandlerSource, /await load\(\)/);
});

// 18. Error state is user-readable.
test('18. preview and confirm errors are surfaced via the existing error-banner convention with clean messages', () => {
  assert.match(uploadHandlerSource, /setImportError\(res\.message \|\| 'Could not preview this file\.'\)/);
  assert.match(confirmHandlerSource, /setImportError\(res\.message \|\| 'Could not complete the import\.'\)/);
  assert.match(pageSource, /\{importError \? <div className="error-banner">\{importError\}<\/div> : null\}/);
});
