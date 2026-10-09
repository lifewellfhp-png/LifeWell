/**
 * Regression test: conversionIngestSchema accepts 'phone_click' as a valid
 * conversion_type, added for Google Ads phone-click conversion tracking.
 * Still rejects an arbitrary/unknown type.
 *
 *   npx tsx --test scripts/test-google-ads-phone-click-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { conversionIngestSchema } from '../src/validation/adminSchemas.ts';

test('1. conversionIngestSchema accepts phone_click', () => {
  const result = conversionIngestSchema.safeParse({ conversion_type: 'phone_click', path: '/' });
  assert.equal(result.success, true);
});

test('2. conversionIngestSchema still accepts the pre-existing conversion types', () => {
  for (const type of ['contact', 'newsletter', 'booking_click']) {
    assert.equal(conversionIngestSchema.safeParse({ conversion_type: type }).success, true);
  }
});

test('3. conversionIngestSchema still rejects an unknown conversion_type', () => {
  const result = conversionIngestSchema.safeParse({ conversion_type: 'ad_click' });
  assert.equal(result.success, false);
});
