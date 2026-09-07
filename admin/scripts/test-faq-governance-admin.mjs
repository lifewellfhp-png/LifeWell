/**
 * Phase 11 (FAQ Admin Governance Hardening) regression tests for the Admin
 * FAQs page and the shared ResourceManager component.
 *
 * No network calls, no CMS, no Production data, no React rendering — this
 * mirrors this repo's established pattern (see test-benefits-item-editor.mjs
 * and test-stats-reset-safety.mjs) of reimplementing pure closures for
 * direct logic testing, plus source-level assertions for wiring that only
 * makes sense inside a mounted component (JSX, useMemo, confirm() flow).
 *
 *   npx tsx --test scripts/test-faq-governance-admin.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rmSource = readFileSync(join(__dirname, '../src/components/ResourceManager.tsx'), 'utf8');
const faqsPageSource = readFileSync(join(__dirname, '../src/app/(app)/faqs/page.tsx'), 'utf8');

// --- visibleRows filtering logic: mirrors ResourceManager's useMemo exactly ---

/** Mirrors the visibleRows useMemo in ResourceManager.tsx. */
function simulateVisibleRows(rows, filters, filterValues) {
  if (!filters || !filters.length) return rows;
  return rows.filter((row) =>
    filters.every((f) => {
      const selected = filterValues[f.key];
      if (!selected) return true;
      return String(row[f.key] ?? '') === selected;
    })
  );
}

const faqFixture = [
  { id: '1', question: 'What insurance plans do you accept?', category: 'Fees', published: true },
  { id: '2', question: 'Do you offer self-pay options?', category: 'Fees', published: true },
  { id: '3', question: 'How do I book an appointment?', category: 'Appointments', published: true },
  { id: '4', question: 'Where are you located?', category: 'General', published: true },
];
const categoryFilter = [
  {
    key: 'category',
    label: 'Category',
    allLabel: 'All categories',
    options: [
      { value: 'General', label: 'General' },
      { value: 'Fees', label: 'Fees' },
      { value: 'Appointments', label: 'Appointments' },
    ],
  },
];

test('visibleRows: no filter selected ("All") shows every row', () => {
  const result = simulateVisibleRows(faqFixture, categoryFilter, {});
  assert.equal(result.length, 4);
});

test('visibleRows: selecting Fees shows only Fees rows', () => {
  const result = simulateVisibleRows(faqFixture, categoryFilter, { category: 'Fees' });
  assert.deepEqual(result.map((r) => r.id), ['1', '2']);
});

test('visibleRows: selecting Appointments shows only the Appointments row', () => {
  const result = simulateVisibleRows(faqFixture, categoryFilter, { category: 'Appointments' });
  assert.deepEqual(result.map((r) => r.id), ['3']);
});

test('visibleRows: selecting General shows only the General row', () => {
  const result = simulateVisibleRows(faqFixture, categoryFilter, { category: 'General' });
  assert.deepEqual(result.map((r) => r.id), ['4']);
});

test('visibleRows: no filters configured at all returns rows unchanged (every other ResourceManager consumer)', () => {
  const result = simulateVisibleRows(faqFixture, undefined, {});
  assert.equal(result, faqFixture);
});

// --- confirm-on-field-change logic: mirrors ResourceManager's onSubmit gate exactly ---

/** Mirrors the confirmFieldChange gate inside ResourceManager's onSubmit. */
function shouldConfirm(isEdit, confirmFieldChange, editing, body) {
  if (!isEdit || !confirmFieldChange) return false;
  const from = String(editing?.[confirmFieldChange.key] ?? '');
  const to = String(body[confirmFieldChange.key] ?? '');
  return from !== to;
}

const categoryConfirm = { key: 'category', message: (from, to) => `Move from ${from} to ${to}?` };

test('confirmFieldChange: never triggers on create (isEdit=false), even if configured', () => {
  assert.equal(shouldConfirm(false, categoryConfirm, null, { category: 'Fees' }), false);
});

test('confirmFieldChange: does not trigger when editing but the configured field is unchanged', () => {
  assert.equal(shouldConfirm(true, categoryConfirm, { category: 'Fees' }, { category: 'Fees' }), false);
});

test('confirmFieldChange: triggers when editing and the configured field actually changed', () => {
  assert.equal(shouldConfirm(true, categoryConfirm, { category: 'Fees' }, { category: 'General' }), true);
});

test('confirmFieldChange: does not trigger for unrelated field changes (e.g. answer text edited, category untouched)', () => {
  assert.equal(
    shouldConfirm(true, categoryConfirm, { category: 'Fees', answer: 'old' }, { category: 'Fees', answer: 'new' }),
    false
  );
});

// --- source-level assertions: ResourceManager wiring is additive/opt-in ---

test('ResourceManager: filters/confirmFieldChange/hint are optional props (no other consumer is forced to configure them)', () => {
  assert.match(rmSource, /filters\?:\s*FilterConfig\[\];/);
  assert.match(rmSource, /confirmFieldChange\?:\s*ConfirmFieldChangeConfig;/);
  assert.match(rmSource, /hint\?:\s*\(value: unknown, form: Record<string, unknown>\) => string \| null;/);
});

test('ResourceManager: the confirm-on-field-change block runs before the PATCH/POST call, and only for edits', () => {
  const gateIdx = rmSource.indexOf('if (isEdit && confirmFieldChange)');
  const apiCallIdx = rmSource.indexOf('const res = isEdit');
  assert.ok(gateIdx > -1 && apiCallIdx > gateIdx, 'expected the confirm gate to run strictly before the save API call');
});

test('ResourceManager: the desktop table and mobile cards both render visibleRows, not the unfiltered rows', () => {
  assert.match(rmSource, /visibleRows\.map\(\(row\)/);
  assert.doesNotMatch(rmSource, /\{rows\.map\(\(row\)/);
});

test('ResourceManager: a zero-total-rows state and a filter-matched-nothing state show distinct messages', () => {
  assert.match(rmSource, /No items yet\. Add the first one\./);
  assert.match(rmSource, /No items match this filter\./);
});

test('ResourceManager: field hints render only when a hint function is provided and returns non-null text', () => {
  assert.match(rmSource, /field\.hint\(form\[field\.key\], form\)/);
  assert.match(rmSource, /hintText \? <p className="field-hint">\{hintText\}<\/p> : null/);
});

// --- source-level assertions: the FAQs page's own configuration ---

test('FAQs page: category dropdown includes Appointments (a real live category, previously missing from the picker)', () => {
  assert.match(faqsPageSource, /value:\s*'Appointments'/);
});

test('FAQs page: a Category filter is configured with all three real categories', () => {
  const filtersBlock = faqsPageSource.match(/filters=\{\[[\s\S]*?\]\}/);
  assert.ok(filtersBlock, 'expected a filters prop on the FAQs ResourceManager');
  assert.match(filtersBlock[0], /'General'/);
  assert.match(filtersBlock[0], /'Fees'/);
  assert.match(filtersBlock[0], /'Appointments'/);
});

test('FAQs page: confirmFieldChange is configured for the category field specifically', () => {
  const confirmBlock = faqsPageSource.match(/confirmFieldChange=\{\{[\s\S]*?\n\s*\}\}/);
  assert.ok(confirmBlock, 'expected a confirmFieldChange prop on the FAQs ResourceManager');
  assert.match(confirmBlock[0], /key:\s*'category'/);
});

test('FAQs page: the category column renders a visible badge, not raw text', () => {
  const columnsBlock = faqsPageSource.slice(faqsPageSource.indexOf('columns={['));
  assert.match(columnsBlock, /className=\{CATEGORY_BADGE_CLASS\[cat\][^}]*\}/);
});

test('FAQs page: category hints describe real current public destinations, not invented ones (Fees vs everything-else-goes-to-/faqs)', () => {
  assert.match(faqsPageSource, /Fees & Insurance[\s\S]{0,40}\/fees-insurance/);
  assert.match(faqsPageSource, /no separate Appointments page/);
});
