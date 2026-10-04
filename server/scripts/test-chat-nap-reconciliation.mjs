/**
 * Cross-repo reconciliation: the Server's hardcoded NAP/pricing mirror in
 * chatFacts.ts must stay byte-identical to the Client's real source
 * (client/src/data/site.ts, client/src/data/pricing.ts) and the Admin's own
 * mirror (admin/src/lib/protected-pricing.ts). Same technique already used
 * by admin/scripts/test-phase13-admin-pricing-authority.mjs — readFileSync
 * the other app's source and regex-assert against it, since there is no
 * shared code between Client/Admin/Server to import instead.
 *
 * No network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-chat-nap-reconciliation.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  CHAT_NAP,
  CHAT_PRICING_TIERS,
  CHAT_PRICING_FALLBACK,
  CHAT_INSURANCE_FALLBACK,
  CHAT_SERVICES_FALLBACK,
  CHAT_PROVIDER_FALLBACK,
} from '../src/lib/chatFacts.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const siteSource = readFileSync(join(repoRoot, 'client/src/data/site.ts'), 'utf8');
const pricingSource = readFileSync(join(repoRoot, 'client/src/data/pricing.ts'), 'utf8');
const marketingSource = readFileSync(join(repoRoot, 'client/src/data/marketing.ts'), 'utf8');
const servicesSource = readFileSync(join(repoRoot, 'client/src/data/generated/services.ts'), 'utf8');
const providerSource = readFileSync(join(repoRoot, 'client/src/data/provider.ts'), 'utf8');

test('1. phone number matches client/src/data/site.ts', () => {
  assert.match(siteSource, /phone: '\(407\) 603-1717'/);
  assert.equal(CHAT_NAP.phone, '(407) 603-1717');
});

test('2. address matches client/src/data/site.ts', () => {
  assert.match(siteSource, /full: '3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828'/);
  assert.equal(CHAT_NAP.address, '3680 Avalon Park E Blvd, Suite 310, Orlando, FL 32828');
});

test('3. email matches client/src/data/site.ts', () => {
  assert.match(siteSource, /email: 'contact@lifewellfhp\.com'/);
  assert.equal(CHAT_NAP.email, 'contact@lifewellfhp.com');
});

test('4. crisis line matches client/src/data/site.ts', () => {
  assert.match(siteSource, /phone: '988'/);
  assert.equal(CHAT_NAP.crisisPhone, '988');
});

test('5. hours match client/src/data/site.ts\'s display strings', () => {
  assert.match(siteSource, /display: '8:00 AM – 10:00 PM EST'/);
  assert.match(siteSource, /display: '7:00 AM – 10:00 PM EST'/);
  assert.ok(CHAT_NAP.hours.some((h) => h.includes('8:00 AM – 10:00 PM EST')));
  assert.ok(CHAT_NAP.hours.some((h) => h.includes('7:00 AM – 10:00 PM EST')));
});

test('6. psychiatric pricing fallback matches client/src/data/pricing.ts\'s approved figures', () => {
  const match = pricingSource.match(/export const psychiatricStatePricing: PsychiatricStatePricing\[\] = \[([\s\S]*?)\];/);
  assert.ok(match, "expected to find psychiatricStatePricing in client/src/data/pricing.ts");
  for (const state of CHAT_PRICING_FALLBACK) {
    const stateRegex = new RegExp(
      `state: '${state.state}', selfPayOnly: ${state.selfPayOnly}, slidingScaleAvailable: ${state.slidingScaleAvailable}, initialFee: ${state.initialFee}, followUpFee: ${state.followUpFee}`
    );
    assert.match(match[1], stateRegex, `expected ${state.state}'s chat fallback to match client/src/data/pricing.ts exactly`);
  }
});

test('7. non-psychiatric pricing tiers match client/src/data/pricing.ts', () => {
  const primaryCare = CHAT_PRICING_TIERS.find((t) => t.name === 'Primary Care');
  const weightMgmt = CHAT_PRICING_TIERS.find((t) => t.name === 'Weight Management');
  assert.match(pricingSource, /name: 'Primary Care',\s*initialFee: 135,\s*initialDuration: '60 minutes',\s*followUpFee: 85,\s*followUpDuration: '30 minutes'/);
  assert.match(pricingSource, /name: 'Weight Management',\s*initialFee: 125,\s*initialDuration: '60 minutes',\s*followUpFee: 85,\s*followUpDuration: '30 minutes'/);
  assert.equal(primaryCare.initialFee, 135);
  assert.equal(primaryCare.followUpFee, 85);
  assert.equal(weightMgmt.initialFee, 125);
  assert.equal(weightMgmt.followUpFee, 85);
});

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('8. the insurance fallback list is a subset of client/src/data/marketing.ts\'s real carrier names (every fallback name actually exists there)', () => {
  const match = marketingSource.match(/export const insuranceCarriers: InsuranceCarrier\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(match, 'expected to find insuranceCarriers in client/src/data/marketing.ts');
  for (const name of CHAT_INSURANCE_FALLBACK) {
    assert.match(match[1], new RegExp(`name: '${escapeRegExp(name)}'`), `expected "${name}" to exist in client's insuranceCarriers`);
  }
});

test('9. the insurance fallback list is complete — every real carrier name also appears in the chat fallback (no silent omission)', () => {
  const match = marketingSource.match(/export const insuranceCarriers: InsuranceCarrier\[\] = \[([\s\S]*?)\n\];/);
  const realNames = [...match[1].matchAll(/name: '([^']+)'/g)].map((m) => m[1]);
  for (const name of realNames) {
    assert.ok(CHAT_INSURANCE_FALLBACK.includes(name), `expected chat fallback to include real carrier "${name}"`);
  }
});

test('10. the services fallback list matches client/src/data/generated/services.ts\'s real titles exactly', () => {
  const realTitles = [...servicesSource.matchAll(/"title": "([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(CHAT_SERVICES_FALLBACK, realTitles);
});

test('11. the provider fallback matches client/src/data/provider.ts', () => {
  assert.match(providerSource, new RegExp(`name: '${escapeRegExp(CHAT_PROVIDER_FALLBACK.name)}'`));
  assert.match(providerSource, new RegExp(`credentials: '${escapeRegExp(CHAT_PROVIDER_FALLBACK.credentials)}'`));
  assert.match(providerSource, new RegExp(`role: '${escapeRegExp(CHAT_PROVIDER_FALLBACK.role)}'`));
});
