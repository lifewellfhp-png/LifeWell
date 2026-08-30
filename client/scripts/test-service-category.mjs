/**
 * Pure unit tests for mapServiceSummaries()'s category resolution
 * (client/src/lib/cms-resolve.ts) — the G5 safety fix: an unrecognized
 * service slug with no explicit, valid CMS category must never resolve to
 * 'psychiatric' (which would make it MA/AZ-eligible via
 * TelehealthStatePageContent's `category === 'psychiatric'` filter).
 *
 * No network calls, no CMS, no production data.
 *
 *   npx tsx --test scripts/test-service-category.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapServiceSummaries } from '../src/lib/cms-resolve.ts';

function summaryFor(rows, slug) {
  const mapped = mapServiceSummaries({ services: rows }, true);
  return mapped.find((s) => s.slug === slug);
}

test('known psychiatric service + missing CMS category -> still psychiatric via static catalog', () => {
  const s = summaryFor([{ slug: 'psychiatric-evaluations', title: 'Psychiatric Evaluations' }], 'psychiatric-evaluations');
  assert.equal(s.category, 'psychiatric');
});

test('known primary-care service + missing CMS category -> still primary-care via static catalog', () => {
  const s = summaryFor([{ slug: 'weight-management-telehealth', title: 'Weight Management' }], 'weight-management-telehealth');
  assert.equal(s.category, 'primary-care');
});

test('unknown slug + explicit psychiatric -> psychiatric', () => {
  const s = summaryFor([{ slug: 'brand-new-service', title: 'Brand New Service', category: 'psychiatric' }], 'brand-new-service');
  assert.equal(s.category, 'psychiatric');
});

test('unknown slug + explicit primary-care -> primary-care', () => {
  const s = summaryFor([{ slug: 'brand-new-service', title: 'Brand New Service', category: 'primary-care' }], 'brand-new-service');
  assert.equal(s.category, 'primary-care');
});

test('unknown slug + missing category -> NOT psychiatric (safe default)', () => {
  const s = summaryFor([{ slug: 'brand-new-service', title: 'Brand New Service' }], 'brand-new-service');
  assert.notEqual(s.category, 'psychiatric');
  assert.equal(s.category, 'primary-care');
});

test('unknown slug + null category -> NOT psychiatric', () => {
  const s = summaryFor([{ slug: 'brand-new-service', title: 'Brand New Service', category: null }], 'brand-new-service');
  assert.notEqual(s.category, 'psychiatric');
});

test('unknown slug + invalid category string -> NOT psychiatric, safe fallback', () => {
  const s = summaryFor([{ slug: 'brand-new-service', title: 'Brand New Service', category: 'wellness' }], 'brand-new-service');
  assert.notEqual(s.category, 'psychiatric');
  assert.equal(s.category, 'primary-care');
});

test('all 11 current known services still resolve to their correct category with no CMS category set', () => {
  const rows = [
    ['psychiatric-evaluations', 'psychiatric'],
    ['medication-management', 'psychiatric'],
    ['treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd', 'psychiatric'],
    ['psychiatric-follow-up-visits-telehealth', 'psychiatric'],
    ['annual-physical-exam-telehealth', 'primary-care'],
    ['chronic-disease-management-telehealth', 'primary-care'],
    ['preventive-care-telehealth', 'primary-care'],
    ['telehealth-sick-visits-primary-care', 'primary-care'],
    ['weight-management-telehealth', 'primary-care'],
    ['wellness-and-lifestyle-counseling-telehealth', 'primary-care'],
    ['lab-testing-coordination-telehealth', 'primary-care'],
  ];
  const cmsRows = rows.map(([slug]) => ({ slug, title: slug }));
  const mapped = mapServiceSummaries({ services: cmsRows }, true);
  assert.equal(mapped.length, 11);
  for (const [slug, expectedCategory] of rows) {
    const s = mapped.find((m) => m.slug === slug);
    assert.ok(s, `expected ${slug} to be present`);
    assert.equal(s.category, expectedCategory, `${slug} should resolve to ${expectedCategory}`);
  }
});

test('explicit valid CMS category overrides even a known static slug', () => {
  // If an admin explicitly recategorizes a known service, that choice wins.
  const s = summaryFor(
    [{ slug: 'weight-management-telehealth', title: 'Weight Management', category: 'psychiatric' }],
    'weight-management-telehealth'
  );
  assert.equal(s.category, 'psychiatric');
});
