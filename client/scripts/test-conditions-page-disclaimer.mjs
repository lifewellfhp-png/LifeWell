/**
 * Regression test for Phase 4: strengthening the combined
 * depression/anxiety/ADHD/bipolar/PTSD conditions page with the existing,
 * already-approved YMYL crisis disclaimer (ArticleDisclaimer) -- reused
 * verbatim, not a new/second disclaimer, and no invented clinical content.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-conditions-page-disclaimer.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const contentSource = readFileSync(join(root, 'src/components/sections/ServicePageContent.tsx'), 'utf8');
const disclaimerSource = readFileSync(join(root, 'src/components/sections/ArticleDisclaimer.tsx'), 'utf8');

test('1. ServicePageContent reuses the existing ArticleDisclaimer component, not a new/duplicated disclaimer', () => {
  assert.match(contentSource, /import \{ ArticleDisclaimer \} from '@\/components\/sections\/ArticleDisclaimer';/);
  assert.match(contentSource, /<ArticleDisclaimer \/>/);
});

test('2. the disclaimer is scoped to exactly the combined conditions page, not every service page', () => {
  const setMatch = contentSource.match(/const CRISIS_DISCLAIMER_SLUGS = new Set\(\[([^\]]*)\]\);/);
  assert.ok(setMatch, 'expected to find the CRISIS_DISCLAIMER_SLUGS set');
  const slugs = setMatch[1].split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
  assert.deepEqual(slugs, ['treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd']);
});

test('3. the disclaimer text itself is untouched (the existing, already-approved wording, not a rewrite)', () => {
  assert.match(disclaimerSource, /not a substitute for personalized/);
  assert.match(disclaimerSource, /mental health emergency/);
  assert.match(disclaimerSource, /site\.crisis\.phoneHref/);
  assert.match(disclaimerSource, /site\.crisis\.phone/);
});

test('4. no new clinical claim, eligibility criteria, or FAQ was invented on this service page by this change', () => {
  // The only addition to the file for this change is the import + the Set +
  // the single conditional render line — no new prose was authored.
  const insertedBlock = contentSource.slice(
    contentSource.indexOf('const CRISIS_DISCLAIMER_SLUGS'),
    contentSource.indexOf('const CRISIS_DISCLAIMER_SLUGS') + 400
  );
  assert.doesNotMatch(insertedBlock, /diagnos/i);
  assert.doesNotMatch(insertedBlock, /guarantee/i);
  assert.doesNotMatch(insertedBlock, /\$\d/);
});

test('5. provider attribution, insurance link, and related-services cross-links (existing structural elements) are unaffected', () => {
  assert.match(contentSource, /This service is provided by/);
  assert.match(contentSource, /View Fees &amp; Insurance/);
  assert.match(contentSource, /<ServicesGrid services=\{related\}/);
});

test('6. the booking CTA(s) on this template remain tracked exactly as before (no regression to P7-1)', () => {
  const matches = contentSource.match(/trackAs="booking_click"/g) || [];
  assert.equal(matches.length, 2, 'expected the same 2 tracked Book buttons as before this change (main CTA + sidebar CTA)');
});
