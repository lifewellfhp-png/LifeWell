/**
 * Regression tests for the new /new-patients page (P3-E3B5).
 *
 * These check the safety boundaries the task explicitly required (no
 * unsupported intake-form/records/prescription/guarantee claims, no MA/AZ
 * primary-care or physical-office implication, correct CTA routing) and the
 * wiring into sitemap/search — not a full-page render/snapshot, which would
 * be brittle against copy tweaks.
 *
 *   npx tsx --test scripts/test-new-patients-page.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  beforeYourVisit,
  whatToExpect,
  telehealthSection,
  inPersonSection,
} from '../src/data/new-patients.ts';
import { site } from '../src/data/site.ts';
import { searchIndex } from '../src/data/search-index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pageSource = readFileSync(join(root, 'src/app/new-patients/page.tsx'), 'utf8');
const contentSource = readFileSync(join(root, 'src/components/sections/NewPatientsPageContent.tsx'), 'utf8');
const sitemapSource = readFileSync(join(root, 'src/app/sitemap.ts'), 'utf8');
const allCopy = [
  ...beforeYourVisit.items,
  ...whatToExpect.body,
  telehealthSection.body,
  inPersonSection.body,
].join(' ');

test('A. the /new-patients route file exists', () => {
  assert.doesNotThrow(() => readFileSync(join(root, 'src/app/new-patients/page.tsx'), 'utf8'));
});

test('B. metadata resolves against the /new-patients CMS path', () => {
  assert.match(pageSource, /path:\s*'\/new-patients'/);
});

test('C. no unsupported intake-form / records / prescription / guarantee claims', () => {
  const forbidden = [
    /intake form/i,
    /records must be transferred/i,
    /guarantee/i,
    /same-day prescription/i,
    /controlled substance/i,
    /every (new )?patient (receives|is prescribed)/i,
    /every condition is treated/i,
    /HIPAA[- ]compliant/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(allCopy, pattern, `unexpected unsupported claim matching ${pattern}`);
    assert.doesNotMatch(contentSource, pattern, `unexpected unsupported claim matching ${pattern} in component source`);
  }
});

test('D. telehealth wording stays psychiatric-only and never mentions primary care', () => {
  assert.doesNotMatch(telehealthSection.body, /primary care/i);
  assert.deepEqual(
    telehealthSection.states.map((s) => s.name).sort(),
    ['Arizona', 'Florida', 'Massachusetts']
  );
});

test('E. Orlando is the only physical location mentioned', () => {
  assert.match(inPersonSection.address.cityLine, /Orlando/);
  assert.doesNotMatch(inPersonSection.body, /Massachusetts|Arizona/);
  assert.equal(inPersonSection.address.street, '3680 Avalon Park E Blvd, Suite 310');
  assert.equal(inPersonSection.address.cityLine, 'Orlando, FL 32828');
});

test('E2. the old address never appears anywhere in the new page', () => {
  assert.doesNotMatch(allCopy, /3564/);
  assert.doesNotMatch(contentSource, /3564/);
});

test('F. booking CTA points to the existing booking route', () => {
  assert.equal(site.booking.page, '/book-telehealth-mental-health-appointment#charm-calendar');
  assert.match(contentSource, /site\.booking\.page/);
});

test('G. contact CTA points to the existing contact route', () => {
  assert.match(contentSource, /\/contact-telehealth-mental-health-provider/);
});

test('H. Fees & Insurance link is correct', () => {
  assert.match(contentSource, /href="\/fees-insurance"/);
});

test('I. FAQ link is correct', () => {
  assert.match(contentSource, /href="\/faqs"/);
});

test('J. sitemap includes /new-patients', () => {
  assert.match(sitemapSource, /abs\('\/new-patients'\)/);
});

test('K. internal search index includes /new-patients', () => {
  const entry = searchIndex.find((e) => e.href === '/new-patients');
  assert.ok(entry, 'expected a New Patients search entry');
  assert.equal(entry.section, 'Pages');
});
