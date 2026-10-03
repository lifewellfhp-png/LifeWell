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
import { CHAT_NAP, CHAT_PRICING_TIERS, CHAT_PRICING_FALLBACK } from '../src/lib/chatFacts.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '../..');
const siteSource = readFileSync(join(repoRoot, 'client/src/data/site.ts'), 'utf8');
const pricingSource = readFileSync(join(repoRoot, 'client/src/data/pricing.ts'), 'utf8');

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
