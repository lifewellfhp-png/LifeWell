/**
 * Regression tests for the SEO route-integrity advisory (P3-E3B1):
 * admin/src/lib/routeStatus.ts's classifyRoute() must correctly flag
 * seo_meta paths that cmsMetadata() (client/src/lib/cms-seo.ts) will never
 * actually consume, without breaking legitimate static/dynamic/redirect
 * paths.
 *
 *   npx tsx --test scripts/test-route-status.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyRoute } from '../src/lib/routeStatus.ts';

test('A. a known exact static route is recognized as active', () => {
  assert.equal(classifyRoute('/bio').kind, 'active');
});

test('B. the real booking route is recognized as active', () => {
  assert.equal(classifyRoute('/book-telehealth-mental-health-appointment').kind, 'active');
});

test('C. the real contact route is recognized as active', () => {
  assert.equal(classifyRoute('/contact-telehealth-mental-health-provider').kind, 'active');
});

test('D. /appointments is classified as unmatched (no route, no redirect, no dynamic match)', () => {
  const status = classifyRoute('/appointments');
  assert.equal(status.kind, 'unmatched');
});

test('E. /contact is classified as a redirect, pointing at the real contact route', () => {
  const status = classifyRoute('/contact');
  assert.equal(status.kind, 'redirect');
  assert.equal(status.destination, '/contact-telehealth-mental-health-provider');
});

test('F. bare /telehealth is NOT falsely treated as equivalent to /telehealth/[state]', () => {
  const status = classifyRoute('/telehealth');
  assert.notEqual(status.kind, 'dynamic');
  assert.equal(status.kind, 'unmatched');
});

test('F2. /telehealth/florida (a real state page) IS recognized as the dynamic family', () => {
  assert.equal(classifyRoute('/telehealth/florida').kind, 'dynamic');
});

test('G. an arbitrary nonexistent path is flagged unmatched', () => {
  assert.equal(classifyRoute('/totally-made-up-path-xyz').kind, 'unmatched');
});

test('H. trailing slash normalization: /bio/ resolves the same as /bio', () => {
  assert.equal(classifyRoute('/bio/').kind, 'active');
  assert.equal(classifyRoute('/').kind, 'active');
});

test('I. a query string is not stripped, so it does not falsely match a real route', () => {
  const status = classifyRoute('/bio?utm_source=test');
  assert.equal(status.kind, 'unmatched');
});

test('J. every currently-working CMS path remains active', () => {
  for (const path of ['/', '/faqs', '/fees-insurance', '/our-services', '/bio']) {
    assert.equal(classifyRoute(path).kind, 'active', `expected ${path} to remain active`);
  }
});

test('the other 3 currently-broken CMS rows are all flagged (not silently active)', () => {
  assert.equal(classifyRoute('/new-patients').kind, 'unmatched');
  assert.equal(classifyRoute('/in-person').kind, 'unmatched');
});

test('dynamic route families are recognized without verifying the specific slug', () => {
  assert.equal(classifyRoute('/services/psychiatric-evaluations').kind, 'dynamic');
  assert.equal(classifyRoute('/blog/managing-anxiety-in-everyday-life').kind, 'dynamic');
});

test('known redirects resolve to their real destination', () => {
  assert.equal(classifyRoute('/book').destination, '/book-telehealth-mental-health-appointment');
  assert.equal(classifyRoute('/about').destination, '/bio');
});

test('empty/undefined path does not throw and resolves to root', () => {
  assert.equal(classifyRoute('').kind, 'active');
  assert.equal(classifyRoute(undefined).kind, 'active');
  assert.equal(classifyRoute(null).kind, 'active');
});
