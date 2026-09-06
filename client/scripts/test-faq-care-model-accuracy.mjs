/**
 * Regression test: the sitewide /faqs page must not imply every scheduled
 * appointment is a telehealth session.
 *
 * Context: the "How do I schedule an appointment?" FAQ answer previously
 * said "...instructions for your telehealth session" unconditionally, even
 * though Florida residents may also choose an in-person visit at the
 * Orlando office (confirmed in data/telehealth-states.ts and
 * data/service-catalog.ts, which already use the phrase "through secure
 * telehealth, or in person at our Orlando office" consistently). This is a
 * live-CMS-overridden FAQ (Production's own faqs table already serves the
 * inaccurate text as of this fix) — this test only covers the static
 * fallback source of truth; the required CMS correction is a separate,
 * owner-performed Admin action documented in the accompanying report.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-faq-care-model-accuracy.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { faqs } from '../src/data/marketing.ts';
import { telehealthStates } from '../src/data/telehealth-states.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

test('1. the scheduling FAQ no longer unconditionally implies every appointment is a telehealth session', () => {
  const entry = faqs.find((f) => /how do i schedule an appointment/i.test(f.question));
  assert.ok(entry, 'expected the scheduling FAQ to exist');
  assert.doesNotMatch(entry.answer, /instructions for your telehealth session/i);
});

test('2. the scheduling FAQ accurately mentions the in-person Orlando option for Florida residents', () => {
  const entry = faqs.find((f) => /how do i schedule an appointment/i.test(f.question));
  assert.match(entry.answer, /in-person visit at our Orlando office/i);
  assert.match(entry.answer, /telehealth/i);
});

test('3. no invented facts (hours, guarantees, eligibility) were introduced by this wording change', () => {
  const entry = faqs.find((f) => /how do i schedule an appointment/i.test(f.question));
  assert.doesNotMatch(entry.answer, /\$\d/);
  assert.doesNotMatch(entry.answer, /guarantee/i);
  assert.doesNotMatch(entry.answer, /same[- ]day/i);
});

test('4. Massachusetts and Arizona FAQ answers remain correctly telehealth-only (not touched by this fix, still accurate)', () => {
  const ma = telehealthStates.find((s) => s.slug === 'massachusetts');
  const az = telehealthStates.find((s) => s.slug === 'arizona');
  const maFaq = ma.faqs.find((f) => /office in massachusetts/i.test(f.question));
  const azFaq = az.faqs.find((f) => /office in arizona/i.test(f.question));
  assert.match(maFaq.answer, /entirely by telehealth/i);
  assert.match(azFaq.answer, /entirely by telehealth/i);
});

test('5. the stale "instructions for your telehealth session" phrase does not appear anywhere else in client/src', () => {
  const srcRoot = join(root, 'src');
  const stack = [srcRoot];
  const hits = [];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSyncSafe(dir)) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const text = readFileSync(full, 'utf8');
        if (/instructions for your telehealth session/i.test(text)) hits.push(full);
      }
    }
  }
  assert.deepEqual(hits, []);
});

function readdirSyncSafe(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}
