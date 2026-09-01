import test from 'node:test';
import assert from 'node:assert/strict';
import { isCmsTestimonialPubliclyVisible, mapTestimonials } from '../src/lib/cms-resolve.ts';
import { testimonials as staticTestimonials } from '../src/data/marketing.ts';

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

test('rating behavior remains unchanged in this phase', () => {
  const mapped = mapTestimonials(
    { testimonials: [{ quote: 'x', author_name: 'A', published: true, consent_confirmed: true }] },
    true
  );

  assert.equal(mapped[0].rating, 5);
});

test('static Mary Mayers fallback still works when CMS is unavailable', () => {
  const mapped = mapTestimonials(null, false);
  assert.deepEqual(mapped, staticTestimonials);
});

test('no false fabricated fallback testimonial appears', () => {
  const mapped = mapTestimonials(null, false);
  const names = mapped.map((t) => t.author);
  assert.ok(names.includes('Mary Mayers'));
  assert.equal(names.includes('Elisa Smith'), false);
  assert.equal(names.includes('Sofia Taylor'), false);
  assert.equal(names.includes('Marco Davies'), false);
});
