/**
 * Phase 12 (Admin Content Governance Audit) regression tests.
 *
 * Follows this codebase's established convention: pure exported functions
 * and Zod schemas are tested directly; anything that only makes sense
 * wired to a live Supabase call (assertAtMostOnePrimaryLocation's DB
 * round-trip, assertValidRelatedServiceSlug's DB round-trip) is verified
 * via source-level assertions against the real shipped files instead of a
 * reimplementation or a live DB.
 *
 * No live Supabase connection, no Production credentials, no Production
 * data read or written.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-phase12-governance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  PROTECTED_PRICING_STATES,
  validatePsychiatricStatePricingShape,
  sectionCreate,
  sectionUpdate,
  bookingCreate,
  telehealthStateCreate,
  BLOG_CATEGORIES,
  blogCreate,
  blogUpdate,
} from '../src/validation/adminSchemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const adminRoutesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const crudFactorySource = readFileSync(join(root, 'src/routes/crudFactory.ts'), 'utf8');

// ---------------------------------------------------------------------------
// Priority 1 — Pricing governance: site_sections psychiatricStatePricing
// ---------------------------------------------------------------------------

function pricingContent(entries) {
  return { psychiatricStatePricing: entries };
}

test('pricing shape: the current approved FL/MA/AZ figures pass', () => {
  const error = validatePsychiatricStatePricingShape(
    pricingContent([
      { state: 'Florida', initialFee: 300, followUpFee: 150 },
      { state: 'Massachusetts', initialFee: 300, followUpFee: 175 },
      { state: 'Arizona', initialFee: 325, followUpFee: 175 },
    ])
  );
  assert.equal(error, null);
});

test('pricing shape: content with no psychiatricStatePricing key at all is untouched (other sections unaffected)', () => {
  assert.equal(validatePsychiatricStatePricingShape({ heading: 'Welcome', body: 'text' }), null);
});

test('pricing shape: null/undefined content is untouched', () => {
  assert.equal(validatePsychiatricStatePricingShape(null), null);
  assert.equal(validatePsychiatricStatePricingShape(undefined), null);
});

test('pricing shape: a negative fee is rejected', () => {
  const error = validatePsychiatricStatePricingShape(pricingContent([{ state: 'Florida', initialFee: -300, followUpFee: 150 }]));
  assert.match(error, /positive dollar amount/);
});

test('pricing shape: a zero fee is rejected', () => {
  const error = validatePsychiatricStatePricingShape(pricingContent([{ state: 'Florida', initialFee: 0, followUpFee: 150 }]));
  assert.match(error, /positive dollar amount/);
});

test('pricing shape: an absurdly large fee (fat-finger extra digit) is rejected', () => {
  const error = validatePsychiatricStatePricingShape(pricingContent([{ state: 'Florida', initialFee: 3000, followUpFee: 150 }]));
  assert.match(error, /no greater than/);
});

test('pricing shape: a non-numeric fee is rejected', () => {
  const error = validatePsychiatricStatePricingShape(pricingContent([{ state: 'Florida', initialFee: '300', followUpFee: 150 }]));
  assert.match(error, /positive dollar amount/);
});

test('pricing shape: a misspelled/unknown state name is rejected', () => {
  const error = validatePsychiatricStatePricingShape(pricingContent([{ state: 'Floridaa', initialFee: 300, followUpFee: 150 }]));
  assert.match(error, /must be one of/);
});

test('pricing shape: PROTECTED_PRICING_STATES is exactly the 3 approved states', () => {
  assert.deepEqual([...PROTECTED_PRICING_STATES], ['Florida', 'Massachusetts', 'Arizona']);
});

test('pricing shape: entries that are not objects are rejected', () => {
  const error = validatePsychiatricStatePricingShape(pricingContent(['Florida']));
  assert.match(error, /must be an object/);
});

test('pricing shape: psychiatricStatePricing that is not an array is rejected', () => {
  const error = validatePsychiatricStatePricingShape({ psychiatricStatePricing: 'not-an-array' });
  assert.match(error, /must be a list/);
});

test('sectionCreate: a fees/self_pay row with valid approved pricing passes', () => {
  const result = sectionCreate.safeParse({
    page_key: 'fees',
    section_key: 'self_pay',
    content: pricingContent([
      { state: 'Florida', initialFee: 300, followUpFee: 150 },
      { state: 'Massachusetts', initialFee: 300, followUpFee: 175 },
      { state: 'Arizona', initialFee: 325, followUpFee: 175 },
    ]),
  });
  assert.equal(result.success, true);
});

test('sectionCreate: a fees/self_pay row with a garbage price is rejected', () => {
  const result = sectionCreate.safeParse({
    page_key: 'fees',
    section_key: 'self_pay',
    content: pricingContent([{ state: 'Florida', initialFee: -1, followUpFee: 150 }]),
  });
  assert.equal(result.success, false);
});

test('sectionUpdate: an unrelated homepage section content edit is unaffected by the pricing guard', () => {
  const result = sectionUpdate.safeParse({
    page_key: 'home',
    section_key: 'how_it_works',
    content: { steps: [{ title: 'Step 1', description: 'Book online.' }] },
  });
  assert.equal(result.success, true);
});

test('sectionUpdate: a partial update that omits content entirely is unaffected by the pricing guard', () => {
  const result = sectionUpdate.safeParse({ published: false });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// Priority 7 — CTA / link governance: booking_url hostname validation
// ---------------------------------------------------------------------------

test('bookingCreate: the real CharmHealth calendar URL passes', () => {
  const result = bookingCreate.safeParse({
    label: 'Book appointment',
    booking_url: 'https://ehr.charmtracker.com/publicCal.sas?method=getCal&digest=abc123',
    provider: 'charmhealth',
    active: true,
  });
  assert.equal(result.success, true);
});

test('bookingCreate: a clientsecure.me URL passes', () => {
  const result = bookingCreate.safeParse({ booking_url: 'https://booking.clientsecure.me/some-provider' });
  assert.equal(result.success, true);
});

test('bookingCreate: a URL that merely contains "charmtracker.com" as a substring (not its real host) is rejected', () => {
  // The exact bypass class this closes: the client-side fallback gate used
  // to do a raw substring test, which this string would have passed.
  const result = bookingCreate.safeParse({ booking_url: 'https://evil.example.com/charmtracker.com' });
  assert.equal(result.success, false);
});

test('bookingCreate: a javascript: URL is rejected', () => {
  const result = bookingCreate.safeParse({ booking_url: 'javascript:alert(1)' });
  assert.equal(result.success, false);
});

test('bookingCreate: an http:// (non-https) URL to the real host is rejected', () => {
  const result = bookingCreate.safeParse({ booking_url: 'http://ehr.charmtracker.com/publicCal.sas' });
  assert.equal(result.success, false);
});

test('bookingCreate: an unrelated but well-formed https URL is rejected', () => {
  const result = bookingCreate.safeParse({ booking_url: 'https://example.com/booking' });
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Priority 7 — CTA / link governance: telehealth-state CTA href scheme
// ---------------------------------------------------------------------------

function stateFixture(overrides) {
  return {
    state_name: 'Massachusetts',
    state_code: 'MA',
    slug: 'massachusetts',
    insurance_mode: 'self_pay_only',
    ...overrides,
  };
}

test('telehealthStateCreate: an internal path href passes', () => {
  const result = telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: '/fees-insurance' }));
  assert.equal(result.success, true);
});

test('telehealthStateCreate: an absolute https href passes', () => {
  const result = telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: 'https://example.com/info' }));
  assert.equal(result.success, true);
});

test('telehealthStateCreate: a blank/null href passes (optional field)', () => {
  assert.equal(telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: null })).success, true);
  assert.equal(telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: '' })).success, true);
});

test('telehealthStateCreate: a javascript: href is rejected', () => {
  const result = telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: 'javascript:alert(1)' }));
  assert.equal(result.success, false);
});

test('telehealthStateCreate: a protocol-relative "//" href is rejected, not treated as an internal path', () => {
  const result = telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: '//evil.example.com' }));
  assert.equal(result.success, false);
});

test('telehealthStateCreate: primary_cta_href gets the identical protection as secondary_cta_href', () => {
  const result = telehealthStateCreate.safeParse(stateFixture({ primary_cta_href: 'javascript:alert(1)' }));
  assert.equal(result.success, false);
});

test('telehealthStateCreate: an http:// (non-https) absolute href is rejected', () => {
  const result = telehealthStateCreate.safeParse(stateFixture({ secondary_cta_href: 'http://example.com' }));
  assert.equal(result.success, false);
});

// ---------------------------------------------------------------------------
// Priority 4 — Controlled values: blog category enum sync
// ---------------------------------------------------------------------------

test('BLOG_CATEGORIES matches the Admin blog editor\'s own 8-value dropdown', () => {
  assert.deepEqual(
    [...BLOG_CATEGORIES],
    [
      'Anxiety',
      'Depression',
      'ADHD',
      'Psychiatric Care & Evaluations',
      'Medication & Treatment',
      'Sleep & Wellness',
      'Trauma & Stress',
      'Whole-Person Wellness',
    ]
  );
});

function blogFixture(overrides) {
  return { slug: 'test-post', title: 'Test Post', ...overrides };
}

test('blogCreate: a known category passes', () => {
  const result = blogCreate.safeParse(blogFixture({ category: 'Anxiety' }));
  assert.equal(result.success, true);
});

test('blogCreate: a category not in the Admin dropdown (typo) is rejected', () => {
  const result = blogCreate.safeParse(blogFixture({ category: 'Anxeity' }));
  assert.equal(result.success, false);
});

test('blogCreate: a blank-string category (the dropdown\'s placeholder option) is treated as "no category", not rejected', () => {
  const result = blogCreate.safeParse(blogFixture({ category: '' }));
  assert.equal(result.success, true);
  assert.equal(result.data.category, null);
});

test('blogUpdate: a category-only PATCH with a valid value passes without requiring other fields', () => {
  const result = blogUpdate.safeParse({ category: 'Depression' });
  assert.equal(result.success, true);
});

// ---------------------------------------------------------------------------
// Source-level wiring assertions: locations is_primary uniqueness
// ---------------------------------------------------------------------------

const locationsRouteMatch = adminRoutesSource.match(/adminRouter\.use\(\s*'\/locations'[\s\S]*?\n\)\s*;/);

test('locations route: validateCreate/validateUpdate call assertAtMostOnePrimaryLocation', () => {
  assert.ok(locationsRouteMatch, 'expected to locate the /locations createCrudRouter registration');
  assert.match(locationsRouteMatch[0], /assertAtMostOnePrimaryLocation\(data\.is_primary\)/);
  assert.match(locationsRouteMatch[0], /assertAtMostOnePrimaryLocation\(data\.is_primary,\s*id\)/);
});

test('assertAtMostOnePrimaryLocation: excludes the row being edited from collision matches', () => {
  assert.match(adminRoutesSource, /row\.id !== excludeId && row\.is_primary === true/);
});

test('assertAtMostOnePrimaryLocation: only queries/blocks when the payload actually sets is_primary=true (an unrelated edit is never blocked)', () => {
  assert.match(adminRoutesSource, /if \(isPrimary !== true\) return;/);
});

test('the primary-location conflict error is owner-friendly with no raw DB/SQL details exposed', () => {
  const match = adminRoutesSource.match(/Another location is already set as primary[^'"`]*/);
  assert.ok(match);
  assert.doesNotMatch(match[0], /supabase/i);
  assert.doesNotMatch(match[0], /\bsql\b/i);
});

// ---------------------------------------------------------------------------
// Source-level wiring assertions: blog related_service_slug live validation
// ---------------------------------------------------------------------------

const blogRouteMatch = adminRoutesSource.match(/adminRouter\.use\(\s*'\/blog'[\s\S]*?\n\)\s*;/);

test('blog route: validateCreate/validateUpdate call assertValidRelatedServiceSlug', () => {
  assert.ok(blogRouteMatch, 'expected to locate the /blog createCrudRouter registration');
  assert.match(blogRouteMatch[0], /assertValidRelatedServiceSlug\(data\.related_service_slug\)/);
});

test('assertValidRelatedServiceSlug: a blank/missing slug is always allowed (skips the DB check)', () => {
  assert.match(adminRoutesSource, /if \(typeof slug !== 'string' \|\| !slug\.trim\(\)\) return;/);
});

test('assertValidRelatedServiceSlug: checks the live services table by slug, not a hardcoded list', () => {
  assert.match(adminRoutesSource, /getSupabase\(\)\.from\('services'\)\.select\('id'\)\.eq\('slug', slug\)/);
});

// ---------------------------------------------------------------------------
// Source-level wiring assertions: friendly duplicate-key (23505) mapping
// ---------------------------------------------------------------------------

test('crudFactory: isUniqueViolation checks Postgres error code 23505', () => {
  assert.match(crudFactorySource, /error\.code === '23505'/);
});

test('crudFactory: both POST and PATCH map a unique violation to a friendly, detail-free message', () => {
  const matches = [...crudFactorySource.matchAll(/if \(isUniqueViolation\(error\)\) \{\s*throw new AppError\((['"`])([^'"`]*)\1/g)];
  assert.equal(matches.length, 2, 'expected exactly one mapping in POST and one in PATCH');
  for (const match of matches) {
    assert.doesNotMatch(match[2], /constraint/i);
    assert.doesNotMatch(match[2], /\bsql\b/i);
  }
});

test('crudFactory: the unique-violation check runs before the generic badRequest(error.message) fallback, so raw Postgres text never reaches the response', () => {
  const postIdx = crudFactorySource.indexOf('router.post(');
  const patchIdx = crudFactorySource.indexOf('router.patch(');
  for (const [label, start, end] of [
    ['POST', postIdx, patchIdx],
    ['PATCH', patchIdx, crudFactorySource.length],
  ]) {
    const block = crudFactorySource.slice(start, end);
    const uniqueIdx = block.indexOf('isUniqueViolation(error)');
    const fallbackIdx = block.indexOf('if (error) throw badRequest(error.message);');
    assert.ok(uniqueIdx > -1 && fallbackIdx > uniqueIdx, `expected isUniqueViolation check before the generic fallback in ${label}`);
  }
});
