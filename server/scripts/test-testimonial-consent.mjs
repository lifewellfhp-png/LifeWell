import test from 'node:test';
import assert from 'node:assert/strict';
import {
  testimonialCreate,
  testimonialUpdate,
  isPubliclyVisibleTestimonial,
  assertEffectiveTestimonialConsent,
} from '../src/validation/adminSchemas.js';

test('create defaults are false/false', () => {
  const parsed = testimonialCreate.parse({
    quote: 'A valid quote',
    author_name: 'Patient One',
  });

  assert.equal(parsed.published, false);
  assert.equal(parsed.consent_confirmed, false);
});

test('consent=false + published=false is valid', () => {
  const parsed = testimonialCreate.parse({
    quote: 'A valid quote',
    author_name: 'Patient One',
    published: false,
    consent_confirmed: false,
  });

  assert.equal(parsed.published, false);
  assert.equal(parsed.consent_confirmed, false);
});

test('consent=true + published=false is valid', () => {
  const parsed = testimonialCreate.parse({
    quote: 'A valid quote',
    author_name: 'Patient One',
    published: false,
    consent_confirmed: true,
  });

  assert.equal(parsed.published, false);
  assert.equal(parsed.consent_confirmed, true);
});

test('consent=true + published=true is valid', () => {
  const parsed = testimonialCreate.parse({
    quote: 'A valid quote',
    author_name: 'Patient One',
    published: true,
    consent_confirmed: true,
  });

  assert.equal(parsed.published, true);
  assert.equal(parsed.consent_confirmed, true);
});

test('published=true + consent=false is rejected', () => {
  assert.throws(
    () => testimonialCreate.parse({
      quote: 'A valid quote',
      author_name: 'Patient One',
      published: true,
      consent_confirmed: false,
    }),
    /consent_confirmed=true/
  );
});

test('published=true + omitted consent is rejected', () => {
  assert.throws(
    () => testimonialCreate.parse({
      quote: 'A valid quote',
      author_name: 'Patient One',
      published: true,
    }),
    /consent_confirmed=true/
  );
});

test('effective-row update check rejects consent revocation while published', () => {
  const before = { published: true, consent_confirmed: true };
  const payload = { consent_confirmed: false };
  const effective = { ...before, ...payload };

  assert.throws(() => assertEffectiveTestimonialConsent(effective), /consent_confirmed=true/);
});

test('effective-row update allows consent revocation with unpublish', () => {
  const before = { published: true, consent_confirmed: true };
  const payload = { consent_confirmed: false, published: false };
  const effective = { ...before, ...payload };

  assert.doesNotThrow(() => assertEffectiveTestimonialConsent(effective));
});

test('effective-row update rejects publishing without consent', () => {
  const before = { published: false, consent_confirmed: false };
  const payload = { published: true };
  const effective = { ...before, ...payload };

  assert.throws(() => assertEffectiveTestimonialConsent(effective), /consent_confirmed=true/);
});

test('published=false + consent=true can publish later', () => {
  const before = { published: false, consent_confirmed: true };
  const payload = { published: true };
  const effective = { ...before, ...payload };

  assert.doesNotThrow(() => assertEffectiveTestimonialConsent(effective));
});

test('update schema does not silently manufacture consent', () => {
  const parsed = testimonialUpdate.parse({
    consent_confirmed: false,
    published: false,
  });

  assert.equal(parsed.consent_confirmed, false);
  assert.equal(parsed.published, false);
});

test('public exposure requires both published and consent', () => {
  assert.equal(isPubliclyVisibleTestimonial({ published: true, consent_confirmed: true }), true);
  assert.equal(isPubliclyVisibleTestimonial({ published: true, consent_confirmed: false }), false);
  assert.equal(isPubliclyVisibleTestimonial({ published: false, consent_confirmed: true }), false);
  assert.equal(isPubliclyVisibleTestimonial({ published: false, consent_confirmed: false }), false);
  assert.equal(isPubliclyVisibleTestimonial({ published: true }), false);
});
