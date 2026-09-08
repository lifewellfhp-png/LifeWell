/**
 * Insurance approved-list reconciliation regression tests.
 *
 * The owner removed "BH Complete Commercial" and "FL DSNP" as accepted
 * Florida payers. This locks the two authoritative sources —
 * PhaseA1Sync's `approvedInsurance` (admin/src/app/(app)/insurance/page.tsx)
 * and the client static fallback (client/src/data/marketing.ts's
 * `insuranceCarriers`) — in sync with that decision, so a future
 * "Apply Approved Florida Insurance Setup" sync run reproduces exactly the
 * intended 13-payer set rather than silently reintroducing either removed
 * payer.
 *
 * "Curative" is deliberately asserted absent from both lists. It has not
 * gone through the approved-list process; a Production CMS row existing
 * for it does not make it part of the code-level approved set. Running
 * PhaseA1Sync's sync would (correctly, per current source) unpublish any
 * Production row whose name isn't in `approvedInsurance` — Curative
 * included, since it isn't in the array either.
 *
 * No network calls, no CMS, no Production data, no React rendering — mirrors
 * this repo's established pattern (see test-phase14-retire-cms-pricing-sync.mjs)
 * of source-level assertions against the real shipped files.
 *
 *   npx tsx --test scripts/test-insurance-list-reconciliation.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insurancePageSource = readFileSync(join(__dirname, '../src/app/(app)/insurance/page.tsx'), 'utf8');
const marketingSource = readFileSync(join(__dirname, '../../client/src/data/marketing.ts'), 'utf8');

const REMOVED_PAYERS = ['BH Complete Commercial', 'FL DSNP'];
const UNAUTHORIZED_PAYERS = ['Curative'];

function extractApprovedInsurance(source) {
  const match = source.match(/const approvedInsurance = \[([\s\S]*?)\] as const;/);
  assert.ok(match, 'approvedInsurance array not found in admin insurance page source');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

function extractInsuranceCarriers(source) {
  const match = source.match(/export const insuranceCarriers: InsuranceCarrier\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(match, 'insuranceCarriers array not found in client marketing.ts source');
  return Array.from(match[1].matchAll(/name: '([^']+)'/g)).map((m) => m[1]);
}

const approved = extractApprovedInsurance(insurancePageSource);
const carriers = extractInsuranceCarriers(marketingSource);

test('admin approvedInsurance contains exactly 13 unique payer names', () => {
  assert.equal(approved.length, 13);
  assert.equal(new Set(approved).size, 13);
});

test('client insuranceCarriers contains exactly 13 unique payer names', () => {
  assert.equal(carriers.length, 13);
  assert.equal(new Set(carriers).size, 13);
});

test('admin and client approved-list names match exactly (same set, same order)', () => {
  assert.deepEqual(carriers, approved);
});

test('removed payers (BH Complete Commercial, FL DSNP) are absent from both lists', () => {
  for (const name of REMOVED_PAYERS) {
    assert.ok(!approved.includes(name), `${name} must not be in admin approvedInsurance`);
    assert.ok(!carriers.includes(name), `${name} must not be in client insuranceCarriers`);
  }
});

test('unauthorized payers (Curative) are absent from both approved-list sources', () => {
  for (const name of UNAUTHORIZED_PAYERS) {
    assert.ok(!approved.includes(name), `${name} must not be in admin approvedInsurance`);
    assert.ok(!carriers.includes(name), `${name} must not be in client insuranceCarriers`);
  }
});

test('PhaseA1Sync still unpublishes any Production row not present in approvedInsurance', () => {
  // Locks in the mechanism that makes the two lists above load-bearing: a
  // sync run must actively unpublish rows outside the approved set (not
  // merely skip them), so removed/unauthorized payers don't linger published.
  assert.match(insurancePageSource, /if \(usedIds\.has\(row\.id\)\) continue;/);
  assert.match(insurancePageSource, /published:\s*false/);
});
