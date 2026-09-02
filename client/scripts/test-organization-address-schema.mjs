/**
 * Regression test for a Phase 6 accessibility/semantic-quality finding:
 * organizationNode()'s PostalAddress omitted the suite number, since it read
 * site.address.street ('3680 Avalon Park E Blvd') without also joining
 * site.address.suite ('Suite 310') into streetAddress. This node ships in
 * the root layout's JSON-LD on every page, so the omission was site-wide.
 *
 * No network calls, no CMS, no production data.
 *
 *   npx tsx --test scripts/test-organization-address-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { organizationNode } from '../src/lib/schema.ts';
import { site } from '../src/data/site.ts';

test('A. organizationNode().address.streetAddress includes the suite number', () => {
  const node = organizationNode();
  assert.match(node.address.streetAddress, /Suite 310/);
});

test('B. streetAddress matches the canonical approved street+suite exactly', () => {
  const node = organizationNode();
  assert.equal(node.address.streetAddress, `${site.address.street}, ${site.address.suite}`);
  assert.equal(node.address.streetAddress, '3680 Avalon Park E Blvd, Suite 310');
});

test('C. the rest of the PostalAddress fields are unchanged (locality/region/zip/country)', () => {
  const node = organizationNode();
  assert.equal(node.address['@type'], 'PostalAddress');
  assert.equal(node.address.addressLocality, 'Orlando');
  assert.equal(node.address.addressRegion, 'FL');
  assert.equal(node.address.postalCode, '32828');
  assert.equal(node.address.addressCountry, 'US');
});
