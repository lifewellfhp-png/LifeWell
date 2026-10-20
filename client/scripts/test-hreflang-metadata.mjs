/**
 * Regression tests for AI-search-visibility Part 3's hreflang helper:
 * pageMetadata()'s new alternateLocale option must emit correct,
 * reciprocal en/es/x-default <link> alternates, and must emit nothing
 * at all for a page with no counterpart yet in the other language.
 *
 *   npx tsx --test scripts/test-hreflang-metadata.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pageMetadata } from '../src/lib/seo.ts';

test('1. an English page with a Spanish counterpart gets en + x-default (itself) and es', () => {
  const meta = pageMetadata({
    title: 'Fees & Insurance',
    description: 'Test description long enough to pass length checks in other tests.',
    path: '/fees-insurance',
    alternateLocale: { es: '/es/fees-insurance' },
  });
  assert.equal(meta.alternates.languages.en, 'https://www.lifewellfhp.com/fees-insurance');
  assert.equal(meta.alternates.languages['x-default'], 'https://www.lifewellfhp.com/fees-insurance');
  assert.equal(meta.alternates.languages.es, 'https://www.lifewellfhp.com/es/fees-insurance');
});

test('2. a Spanish page gets en + x-default (the English counterpart) and es (itself)', () => {
  const meta = pageMetadata({
    title: 'Tarifas y Seguro',
    description: 'Descripción de prueba suficientemente larga para pasar otras verificaciones.',
    path: '/es/fees-insurance',
    alternateLocale: { en: '/fees-insurance' },
  });
  assert.equal(meta.alternates.languages.en, 'https://www.lifewellfhp.com/fees-insurance');
  assert.equal(meta.alternates.languages['x-default'], 'https://www.lifewellfhp.com/fees-insurance');
  assert.equal(meta.alternates.languages.es, 'https://www.lifewellfhp.com/es/fees-insurance');
});

test('3. a page with no counterpart in the other language gets no languages field at all', () => {
  const meta = pageMetadata({
    title: 'Privacy Policy',
    description: 'Test description long enough to pass length checks in other tests.',
    path: '/privacy-policy',
  });
  assert.equal(meta.alternates.languages, undefined);
});

test('4. ogLocale defaults to site.locale (en_US) and can be overridden for Spanish pages', () => {
  const en = pageMetadata({ title: 'T', description: 'D'.repeat(30), path: '/foo' });
  assert.equal(en.openGraph.locale, 'en_US');
  const es = pageMetadata({ title: 'T', description: 'D'.repeat(30), path: '/es/foo', ogLocale: 'es_US' });
  assert.equal(es.openGraph.locale, 'es_US');
});
