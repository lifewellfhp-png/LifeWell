/**
 * Regression tests for Phase 3: the Orlando local-search landing page
 * (/orlando-psychiatric-care).
 *
 * Covers: NAP consistency with site.ts (single source of truth), no
 * invented facts (no parking/accessibility/arrival claims, no primary-care
 * in-person claim), correct internal linking, booking CTA tracked exactly
 * like every other real booking control, JSON-LD wiring, and sitemap/
 * navigation inclusion.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-orlando-page.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { site } from '../src/data/site.ts';
import { contactPage } from '../src/data/contact.ts';
import {
  orlandoOffice,
  orlandoCareOptions,
  orlandoProviderSection,
} from '../src/data/orlando.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pageSource = readFileSync(join(root, 'src/app/orlando-psychiatric-care/page.tsx'), 'utf8');
const contentSource = readFileSync(join(root, 'src/components/sections/OrlandoPageContent.tsx'), 'utf8');

/* -------------------------------------------------------- 1-4. NAP --- */

test('1. the Orlando page address matches site.ts exactly (single NAP source of truth)', () => {
  assert.equal(orlandoOffice.street, `${site.address.street}, ${site.address.suite}`);
  assert.equal(orlandoOffice.cityLine, `${site.address.city}, ${site.address.state} ${site.address.zip}`);
});

test('2. the Orlando page phone number matches site.ts exactly', () => {
  assert.equal(orlandoOffice.phoneDisplay, site.contact.phone);
  assert.equal(orlandoOffice.phoneHref, site.contact.phoneHref);
});

test('3. the Orlando page reuses the existing, already-live map embed rather than a second copy', () => {
  assert.equal(orlandoOffice.mapSrc, contactPage.mapSrc);
});

test('4. hours are read from site.ts, not duplicated/invented', () => {
  assert.deepEqual(orlandoOffice.hours, site.hours);
});

/* ---------------------------------------------- 5-7. no invented facts --- */

test('5. no parking, accessibility, or arrival-instruction claim is made (none verified in the repo)', () => {
  const flat = contentSource.toLowerCase();
  for (const term of ['parking', 'wheelchair', 'accessible entrance', 'arrival', 'check-in']) {
    assert.ok(!flat.includes(term), `unexpected unverified claim: "${term}"`);
  }
});

test('6. primary care is NOT claimed as available in-person at Orlando (only evaluations/medication management are verified)', () => {
  assert.deepEqual(
    orlandoCareOptions.services.map((s) => s.href).sort(),
    ['/services/medication-management', '/services/psychiatric-evaluations']
  );
  assert.doesNotMatch(contentSource, /primary care.{0,40}in.person/i);
});

test('7. no unsupported promise (same-day, guaranteed, response time) appears anywhere on the page', () => {
  const flat = contentSource.toLowerCase();
  for (const term of ['same-day', 'same day', 'guarantee', 'guaranteed', 'instantly', 'immediately']) {
    assert.ok(!flat.includes(term), `unexpected unsupported promise: "${term}"`);
  }
});

/* --------------------------------------------------- 8-11. structure --- */

test('8. the page uses generateMetadata + cmsMetadata + a self-referencing canonical path, matching established convention', () => {
  assert.match(pageSource, /export async function generateMetadata/);
  assert.match(pageSource, /cmsMetadata\(cms, \{/);
  assert.match(pageSource, /path: '\/orlando-psychiatric-care'/);
});

test('9. the page emits JSON-LD via the shared pageGraph() builder with a breadcrumb trail, not a bespoke/duplicate LocalBusiness node', () => {
  assert.match(pageSource, /pageGraph\('\/orlando-psychiatric-care'/);
  assert.match(pageSource, /name: 'Home', href: '\/'/);
  assert.match(pageSource, /name: 'Orlando, FL', href: '\/orlando-psychiatric-care'/);
  assert.doesNotMatch(pageSource, /'@type':\s*\[?'?(LocalBusiness|MedicalBusiness|MedicalClinic)/);
});

test('10. the Book an Appointment CTA is tracked exactly like every other real booking control (P7-1 convention)', () => {
  const matches = contentSource.match(/trackAs="booking_click"/g) || [];
  assert.equal(matches.length, 2, 'expected exactly 2 tracked Book buttons (hero + closing CTA)');
});

test('11. the phone and directions links are NOT mislabeled as booking_click (Phase 7 will instrument them separately, not this phase)', () => {
  const phoneBlock = contentSource.slice(contentSource.indexOf('Call {orlandoOffice'), contentSource.indexOf('Call {orlandoOffice') + 150);
  assert.doesNotMatch(phoneBlock, /trackAs/);
  const directionsBlock = contentSource.slice(contentSource.indexOf('Get Directions') - 200, contentSource.indexOf('Get Directions'));
  assert.doesNotMatch(directionsBlock, /trackAs="booking_click"/);
});

/* ---------------------------------------------- 12-14. internal linking --- */

test('12. the page links to the real service pages, the Florida telehealth page, the provider bio, new patients, fees, and FAQs', () => {
  // Most hrefs are wired through data/orlando.ts, not literal strings in the
  // JSX — check the actual resolved values, not the component source text.
  const dataHrefs = [
    ...orlandoCareOptions.services.map((s) => s.href),
    orlandoCareOptions.telehealthHref,
    orlandoProviderSection.href,
  ];
  for (const href of [
    '/services/psychiatric-evaluations',
    '/services/medication-management',
    '/telehealth/florida',
    '/bio',
  ]) {
    assert.ok(dataHrefs.includes(href), `expected data/orlando.ts to resolve a link to ${href}`);
  }
  const orlandoNewPatientsSource = readFileSync(join(root, 'src/data/orlando.ts'), 'utf8');
  assert.match(orlandoNewPatientsSource, /newPatientsHref: '\/new-patients'/);
  assert.match(orlandoNewPatientsSource, /feesHref: '\/fees-insurance'/);
  // FAQs is the one literal href directly in the JSX.
  assert.match(contentSource, /href="\/faqs"/);
});

test('13. the page is included in the sitemap', () => {
  const sitemapSource = readFileSync(join(root, 'src/app/sitemap.ts'), 'utf8');
  assert.match(sitemapSource, /\/orlando-psychiatric-care/);
});

test('14. the page is discoverable from footer navigation and from /new-patients (reciprocal internal link)', () => {
  const navSource = readFileSync(join(root, 'src/data/navigation.ts'), 'utf8');
  assert.match(navSource, /href: '\/orlando-psychiatric-care'/);
  const newPatientsSource = readFileSync(join(root, 'src/data/new-patients.ts'), 'utf8');
  assert.match(newPatientsSource, /href: '\/orlando-psychiatric-care'/);
});

/* --------------------------------------------------- 15. provider photo --- */

test('15. the provider photo used is the real, already-approved bio photo — not a stock/invented image', () => {
  assert.equal(orlandoProviderSection.image.src, '/images/team/Lourdie-Chachoute.jpeg');
});

test('16. the H1/title is patient-oriented, not a keyword string', () => {
  assert.doesNotMatch(pageSource, /Orlando.{0,3}FL.{0,3}Psychiatrist.{0,3}Near Me/i);
  assert.match(pageSource, /Psychiatric Care in Orlando, FL/);
});
