/**
 * Phase 12 (Admin Content Governance Audit) regression tests for the Admin
 * side: ResourceManager's diff-based PATCH, and the Telehealth States page's
 * insurance_mode confirmation/hint.
 *
 * No network calls, no CMS, no Production data, no React rendering — mirrors
 * this repo's established pattern (see test-faq-governance-admin.mjs) of
 * reimplementing pure closures for direct logic testing, plus source-level
 * assertions for wiring that only makes sense inside a mounted component.
 *
 *   npx tsx --test scripts/test-phase12-governance-admin.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rmSource = readFileSync(join(__dirname, '../src/components/ResourceManager.tsx'), 'utf8');
const statesPageSource = readFileSync(join(__dirname, '../src/app/(app)/telehealth-states/page.tsx'), 'utf8');

// --- diffAgainst/valuesEqual: mirrors ResourceManager's PATCH-diffing exactly ---

function valuesEqual(a, b) {
  if (a === b) return true;
  if (a != null && b != null && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

function diffAgainst(body, original) {
  if (!original) return body;
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => !valuesEqual(value, original[key])));
}

test('diffAgainst: an unchanged field is omitted from the PATCH body', () => {
  const body = { title: 'Same title', published: true };
  const original = { title: 'Same title', published: true };
  assert.deepEqual(diffAgainst(body, original), {});
});

test('diffAgainst: only the actually-changed field is included', () => {
  const body = { title: 'New title', published: true, sort_order: 3 };
  const original = { title: 'Old title', published: true, sort_order: 3 };
  assert.deepEqual(diffAgainst(body, original), { title: 'New title' });
});

test('diffAgainst: the core governance scenario — editing an unrelated field never resends (and cannot clobber) a concurrently-changed published flag', () => {
  // Admin A opened the edit modal when published was true. Meanwhile
  // Admin B unpublished the row elsewhere. Admin A only changes the
  // title and saves — the stale `published: true` from when the modal
  // opened must never be sent, or it would silently re-publish the row.
  const formSeenWhenModalOpened = { title: 'Old title', published: true };
  const bodyOnSave = { title: 'New title', published: true }; // form still holds the stale published value
  const diffed = diffAgainst(bodyOnSave, formSeenWhenModalOpened);
  assert.deepEqual(diffed, { title: 'New title' });
  assert.equal(Object.hasOwn(diffed, 'published'), false);
});

test('diffAgainst: object/array (JSON) field values compare by content, not reference', () => {
  const body = { faqs: [{ question: 'Q', answer: 'A' }] };
  const original = { faqs: [{ question: 'Q', answer: 'A' }] }; // different array reference, same content
  assert.deepEqual(diffAgainst(body, original), {});
});

test('diffAgainst: a genuinely changed JSON field is included', () => {
  const body = { faqs: [{ question: 'Q2', answer: 'A' }] };
  const original = { faqs: [{ question: 'Q', answer: 'A' }] };
  assert.deepEqual(diffAgainst(body, original), { faqs: [{ question: 'Q2', answer: 'A' }] });
});

test('diffAgainst: with no original row (create path), the full body passes through unchanged', () => {
  const body = { title: 'New', published: false };
  assert.equal(diffAgainst(body, null), body);
});

test('diffAgainst: a field the row never had (undefined -> value) is included', () => {
  const body = { self_pay_fee: 300 };
  const original = {};
  assert.deepEqual(diffAgainst(body, original), { self_pay_fee: 300 });
});

// --- source-level assertions: ResourceManager only diffs PATCH, never POST ---

test('ResourceManager: diffAgainst is applied only for the edit/PATCH path, not create/POST', () => {
  const gateIdx = rmSource.indexOf('const payloadForRequest = isEdit ? diffAgainst(body, editing) : body;');
  assert.ok(gateIdx > -1, 'expected the isEdit-only diff gate');
});

test('ResourceManager: the PATCH call uses the diffed payload, not the full body', () => {
  assert.match(rmSource, /method: 'PATCH', body: JSON\.stringify\(payloadForRequest\)/);
});

test('ResourceManager: the POST call still sends every configured field', () => {
  assert.match(rmSource, /method: 'POST', body: JSON\.stringify\(payloadForRequest\)/);
  // payloadForRequest === body on the create path (verified by the ternary above),
  // so create behavior is unchanged from before this fix.
});

test('ResourceManager: the diff runs after the confirmFieldChange gate, so confirmation still compares against the pre-diff body', () => {
  const confirmIdx = rmSource.indexOf('if (isEdit && confirmFieldChange)');
  const diffIdx = rmSource.indexOf('const payloadForRequest = isEdit ? diffAgainst(body, editing) : body;');
  assert.ok(confirmIdx > -1 && diffIdx > confirmIdx, 'expected confirmFieldChange to run before the diff');
});

// --- source-level assertions: Telehealth States insurance_mode governance ---

test('Telehealth States page: confirmFieldChange is configured for insurance_mode', () => {
  const confirmBlock = statesPageSource.match(/confirmFieldChange=\{\{[\s\S]*?\n\s*\}\}/);
  assert.ok(confirmBlock, 'expected a confirmFieldChange prop on the Telehealth States ResourceManager');
  assert.match(confirmBlock[0], /key:\s*'insurance_mode'/);
});

test('Telehealth States page: the insurance_mode hint warns against selecting "existing" for MA/AZ', () => {
  assert.match(statesPageSource, /Do not select this for Massachusetts or Arizona/);
});

test('Telehealth States page: the insurance_mode field has a hint function wired', () => {
  const fieldBlock = statesPageSource.match(/key:\s*'insurance_mode',\s*\n\s*label:[\s\S]*?\n\s*\},/);
  assert.ok(fieldBlock, 'expected the insurance_mode field config (in the fields array, not the confirmFieldChange prop)');
  assert.match(fieldBlock[0], /hint:\s*\(value\)/);
});

test('Telehealth States page: primary/secondary CTA href fields document the new safe-format requirement', () => {
  const matches = statesPageSource.match(/Use an internal path starting with \//g) || [];
  assert.equal(matches.length, 2, 'expected the hint on both primary_cta_href and secondary_cta_href');
});
