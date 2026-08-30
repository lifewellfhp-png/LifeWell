/**
 * Regression tests for P4-F1 (Public HIPAA & Portal Claim Correction).
 *
 * Proves, on the actual public-facing content sources (not internal docs,
 * not non-rendered scrape data): no unsupported "HIPAA-compliant" claim
 * remains, the Contact form's sensitive-health-info warning is intact, the
 * nonexistent "secure patient portal" reference is gone and nothing invents
 * a portal link/URL in its place, booking configuration is untouched, and
 * the FL/MA/AZ telehealth geography claim is untouched.
 *
 *   npx tsx --test scripts/test-hipaa-portal-claim-correction.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { benefits, faqs } from '../src/data/marketing.ts';
import { generatedServices } from '../src/data/generated/services.ts';
import { generatedLegalPages } from '../src/data/generated/legal.ts';
import { site } from '../src/data/site.ts';
import { telehealthSection } from '../src/data/new-patients.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const contactFormSource = readFileSync(join(root, 'src/components/forms/ContactForm.tsx'), 'utf8');

function flattenServiceText(service) {
  const parts = [service.lead, ...service.intro];
  for (const section of service.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if (block.type === 'text') parts.push(block.text);
      if (block.type === 'list') parts.push(...block.items);
    }
  }
  if (service.cta) parts.push(service.cta.heading, ...service.cta.body);
  return parts.join(' ');
}

function flattenLegalText(page) {
  const parts = [page.heading, page.intro];
  for (const section of page.sections) {
    parts.push(section.heading);
    for (const block of section.blocks) {
      if (block.type === 'text') parts.push(block.text);
      if (block.type === 'list') parts.push(...block.items);
    }
  }
  return parts.join(' ');
}

test('A. no public marketing surface (benefits, FAQs, generated services, generated legal pages) claims HIPAA compliance', () => {
  const hipaaPattern = /HIPAA[- ]compliant|HIPAA[- ]secure|HIPAA compliant platform/i;

  for (const b of benefits) {
    assert.doesNotMatch(b.description, hipaaPattern, `benefit "${b.title}" must not claim HIPAA compliance`);
  }
  for (const f of faqs) {
    assert.doesNotMatch(f.answer, hipaaPattern, `FAQ "${f.question}" must not claim HIPAA compliance`);
  }
  for (const s of generatedServices) {
    assert.doesNotMatch(
      flattenServiceText(s),
      hipaaPattern,
      `generated service "${s.slug}" must not claim HIPAA compliance`
    );
  }
  for (const p of generatedLegalPages) {
    assert.doesNotMatch(
      flattenLegalText(p),
      hipaaPattern,
      `legal page "${p.slug}" must not claim HIPAA compliance`
    );
  }
  assert.doesNotMatch(contactFormSource, hipaaPattern, 'ContactForm.tsx must not claim HIPAA compliance');
});

test('B. the Contact form still warns against submitting sensitive health information', () => {
  assert.match(contactFormSource, /do not include/i);
  assert.match(contactFormSource, /sensitive medical or personal health information/i);
});

test('C. the Contact form no longer references a nonexistent "secure patient portal"', () => {
  assert.doesNotMatch(contactFormSource, /patient portal/i);
});

test('D. the Contact form directs to the office phone number rather than inventing a portal link', () => {
  assert.match(contactFormSource, /site\.contact\.phoneHref/);
  assert.match(contactFormSource, /please call our office/i);
  assert.doesNotMatch(contactFormSource, /portal/i);
});

test('E. booking configuration (CharmHealth external calendar) is unchanged by this phase', () => {
  assert.equal(typeof site.booking.url, 'string');
  assert.match(site.booking.url, /^https:\/\/ehr\.charmtracker\.com\//);
  assert.equal(site.booking.page, '/book-telehealth-mental-health-appointment#charm-calendar');
});

test('F. the FL/MA/AZ telehealth geography claim is unchanged by this phase', () => {
  assert.deepEqual(
    telehealthSection.states.map((s) => s.name).sort(),
    ['Arizona', 'Florida', 'Massachusetts']
  );
});

test('G. the non-rendered WordPress scrape source (faqs/home pages, not read by the generator) is deliberately left untouched', () => {
  const pages = JSON.parse(readFileSync(join(root, '../_source/pages.json'), 'utf8'));
  const faqsPage = pages.find((p) => p.slug === 'faqs');
  const homePage = pages.find((p) => p.slug === 'home');
  // These two pages are never read by generate-content.mjs (only the 4
  // legal slugs are), so their frozen scrape text legitimately still
  // contains the original wording — it is not rendered anywhere.
  assert.match(faqsPage.content.rendered, /HIPAA/);
  assert.match(homePage.content.rendered, /HIPAA/);
});

test('H. the corrected legal-source and services-source paragraphs are actually reflected in the generated output', () => {
  const termsPage = generatedLegalPages.find((p) => p.slug === 'terms-conditions');
  const privacyPage = generatedLegalPages.find((p) => p.slug === 'privacy-policy');
  assert.doesNotMatch(flattenLegalText(termsPage), /HIPAA/i);
  assert.doesNotMatch(flattenLegalText(privacyPage), /HIPAA/i);
  assert.doesNotMatch(
    flattenLegalText(privacyPage),
    /Confidentiality and HIPAA Compliance/i,
    'privacy policy heading must be renamed away from an unqualified compliance claim'
  );

  for (const slug of [
    'psychiatric-evaluations',
    'medication-management',
    'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd',
  ]) {
    const svc = generatedServices.find((s) => s.slug === slug);
    assert.doesNotMatch(flattenServiceText(svc), /HIPAA/i, `service "${slug}" must not claim HIPAA compliance`);
  }
});
