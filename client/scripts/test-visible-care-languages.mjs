/**
 * Regression tests for AI-search-visibility Part 2 item 8: the real
 * languages of care must be visible as plain text (not only inside an
 * image) on the homepage (via TrustStrip) and /bio, sourced from the
 * same CARE_LANGUAGES constant so they can never drift from each other
 * or from the structured-data fields (test-care-languages-schema.mjs).
 * The contact page's own languages line was removed on request — see
 * test 4 below.
 *
 *   npx tsx --test scripts/test-visible-care-languages.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatCareLanguages } from '../src/data/site.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

test('1. formatCareLanguages() reads naturally and never includes Spanish', () => {
  const text = formatCareLanguages();
  assert.equal(text, 'English, French, and Haitian Creole');
  assert.doesNotMatch(text, /spanish/i);
});

test('2. TrustStrip (homepage) renders formatCareLanguages() as visible text', () => {
  const source = readFileSync(join(root, 'src/components/sections/TrustStrip.tsx'), 'utf8');
  assert.match(source, /formatCareLanguages/);
  assert.match(source, /Visits are conducted in \{formatCareLanguages\(\)\}/);
});

test('3. BioPageContent renders formatCareLanguages() as visible text', () => {
  const source = readFileSync(join(root, 'src/components/sections/BioPageContent.tsx'), 'utf8');
  assert.match(source, /Languages: \{formatCareLanguages\(\)\}/);
});

test('4. ContactPageContent no longer renders a languages line (removed on request)', () => {
  const source = readFileSync(join(root, 'src/components/sections/ContactPageContent.tsx'), 'utf8');
  assert.doesNotMatch(source, /formatCareLanguages/);
  assert.doesNotMatch(source, /Visits are conducted in/);
});
