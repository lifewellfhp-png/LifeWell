/**
 * Pure, local regression guard for the "Restore missing defaults" import
 * (server/src/controllers/importLive.controller.ts).
 *
 * Proves the stale, WordPress-sourced FAQ/Benefits copy identified during
 * the CMS/Admin content-governance investigation can never be reintroduced
 * by that import again:
 *   - "How much does a telehealth therapy session cost?" / "...individual
 *     therapy, couples therapy..." (Fees category, first-person voice)
 *   - "I provide a safe and supportive environment..." / "My care is
 *     guided by my clinical experience..." (homepage Benefits grid)
 *
 * FAQS/FAQ_CATEGORIES are imported directly from the controller — this
 * checks the actual live seed data, not a hand-copied duplicate that could
 * silently drift out of sync. `homeSections` stays a local variable inside
 * runLiveImport() (not exported, to avoid an unnecessary structural change),
 * so its "benefits" removal is verified by reading the source file instead.
 *
 *   npx tsx --test scripts/test-import-live-content-safety.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FAQS, FAQ_CATEGORIES } from '../src/controllers/importLive.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const controllerSource = readFileSync(
  join(__dirname, '../src/controllers/importLive.controller.ts'),
  'utf8'
);

test('FAQS and FAQ_CATEGORIES stay index-aligned', () => {
  assert.equal(FAQS.length, FAQ_CATEGORIES.length);
});

test('the Fees FAQ category has zero write authority', () => {
  assert.ok(
    !FAQ_CATEGORIES.includes('Fees'),
    'a "Fees" category entry reappeared in FAQ_CATEGORIES — client/src/data/pricing.ts already provides a corrected feesFaqs fallback for this page'
  );
});

test('no active FAQ default mentions therapy as an offered service', () => {
  for (const [question, answer] of FAQS) {
    assert.doesNotMatch(question, /therapy/i, `question mentions therapy: "${question}"`);
    assert.doesNotMatch(answer, /therapy/i, `answer mentions therapy: "${answer}"`);
  }
});

test('the exact obsolete therapy FAQ text is absent from the compiled seed', () => {
  const flat = JSON.stringify(FAQS);
  assert.ok(!flat.includes('How much does a telehealth therapy session cost?'));
  assert.ok(!flat.includes('individual therapy, couples therapy'));
  assert.ok(!flat.includes('What is telehealth mental health care?'));
});

test('import-live no longer seeds a homepage "benefits" section', () => {
  assert.ok(
    !controllerSource.includes("section_key: 'benefits'"),
    'a "benefits" entry reappeared in homeSections — Benefits must have zero write authority from import-live'
  );
});

test('the exact obsolete first-person Benefits copy is absent from the source', () => {
  assert.ok(!controllerSource.includes('I provide a safe and supportive environment'));
  assert.ok(!controllerSource.includes('My care is guided by my clinical experience'));
  assert.ok(!controllerSource.includes('Why Patients Choose My Telehealth Clinic'));
});
