import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { isCmsTestimonialPubliclyVisible, mapTestimonials } from '../src/lib/cms-resolve.ts';
import { testimonials as staticTestimonials } from '../src/data/marketing.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

test('live CMS testimonial with consent=false is excluded', () => {
  const row = { quote: 'x', author_name: 'A', published: true, consent_confirmed: false };
  assert.equal(isCmsTestimonialPubliclyVisible(row), false);
});

test('live CMS testimonial with missing consent is excluded', () => {
  const row = { quote: 'x', author_name: 'A', published: true };
  assert.equal(isCmsTestimonialPubliclyVisible(row), false);
});

test('live CMS testimonial with explicit consent=true is retained', () => {
  const row = { quote: 'x', author_name: 'A', published: true, consent_confirmed: true };
  assert.equal(isCmsTestimonialPubliclyVisible(row), true);
});

test('CMS mapping retains only public-consented rows', () => {
  const rows = [
    { quote: 'live okay', author_name: 'A', published: true, consent_confirmed: true },
    { quote: 'live bad', author_name: 'B', published: true, consent_confirmed: false },
    { quote: 'missing consent', author_name: 'C', published: true },
    { quote: 'not published', author_name: 'D', published: false, consent_confirmed: true },
  ];

  const mapped = mapTestimonials({ testimonials: rows }, true);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].quote, 'live okay');
});

// P4-G7B: replaces the P4-G6 temporary scope-protection assertion
// ("rating behavior remains unchanged in this phase", which expected
// missing -> 5). That was scope protection for P4-G6's consent work, not
// the desired final behavior — absence of a rating must never be inferred
// as 5 stars.

function row(rating) {
  return { quote: 'x', author_name: 'A', published: true, consent_confirmed: true, rating };
}

test('explicit rating 5 is preserved', () => {
  const mapped = mapTestimonials({ testimonials: [row(5)] }, true);
  assert.equal(mapped[0].rating, 5);
});

test('explicit rating 4 is preserved', () => {
  const mapped = mapTestimonials({ testimonials: [row(4)] }, true);
  assert.equal(mapped[0].rating, 4);
});

test('explicit rating 1 is preserved', () => {
  const mapped = mapTestimonials({ testimonials: [row(1)] }, true);
  assert.equal(mapped[0].rating, 1);
});

test('null rating remains null — is never inferred as 5', () => {
  const mapped = mapTestimonials({ testimonials: [row(null)] }, true);
  assert.equal(mapped[0].rating, null);
});

test('missing rating field remains null — is never inferred as 5', () => {
  const { rating: _omit, ...withoutRating } = row(undefined);
  const mapped = mapTestimonials({ testimonials: [withoutRating] }, true);
  assert.equal(mapped[0].rating, null);
});

test('static Mary Mayers fallback still works when CMS is unavailable', () => {
  const mapped = mapTestimonials(null, false);
  assert.deepEqual(mapped, staticTestimonials);
});

test('static fallback rating is null, not an inferred/hardcoded 5', () => {
  const mapped = mapTestimonials(null, false);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0].rating, null);
});

test('legitimate quote/author on the static fallback are unchanged', () => {
  const mapped = mapTestimonials(null, false);
  assert.equal(mapped[0].author, 'Mary Mayers');
  assert.match(mapped[0].quote, /Extremely present and responsive team of providers/);
});

test('no false fabricated fallback testimonial appears', () => {
  const mapped = mapTestimonials(null, false);
  const names = mapped.map((t) => t.author);
  assert.ok(names.includes('Mary Mayers'));
  assert.equal(names.includes('Elisa Smith'), false);
  assert.equal(names.includes('Sofia Taylor'), false);
  assert.equal(names.includes('Marco Davies'), false);
});

test("TestimonialCard's null-safe rendering guard is still intact (source check — component is not wired into any live page)", () => {
  const source = readFileSync(join(root, 'src/components/sections/Testimonials.tsx'), 'utf8');
  assert.match(source, /testimonial\.rating !== null && <Rating value=\{testimonial\.rating\} \/>/);
});

test('homepage testimonials component still renders no rating/star UI (unchanged by this phase)', () => {
  const source = readFileSync(join(root, 'src/components/sections/Testimonials.tsx'), 'utf8');
  const homepageFn = source.slice(
    source.indexOf('export function Testimonials('),
    source.indexOf('export function TestimonialCard(')
  );
  assert.doesNotMatch(homepageFn, /<Rating|StarIcon|rating/);
});

test('testimonials-page content still renders no rating/star UI (unchanged by this phase)', () => {
  const source = readFileSync(join(root, 'src/components/sections/TestimonialsPageContent.tsx'), 'utf8');
  assert.doesNotMatch(source, /<Rating|StarIcon|\brating\b/);
});

test('no Review/AggregateRating structured data was introduced for testimonials', () => {
  const schemaSource = readFileSync(join(root, 'src/lib/schema.ts'), 'utf8');
  assert.doesNotMatch(schemaSource, /testimonial/i);
  assert.doesNotMatch(schemaSource, /AggregateRating|ratingValue|reviewCount|bestRating|worstRating/);
});
