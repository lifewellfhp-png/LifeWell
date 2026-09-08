/**
 * Insurance approved-list reconciliation regression tests.
 *
 * The owner removed "BH Complete Commercial" and "FL DSNP" as accepted
 * Florida payers, and separately confirmed Curative is accepted for
 * eligible Florida patients. This locks the two authoritative sources —
 * PhaseA1Sync's `approvedInsurance` (admin/src/app/(app)/insurance/page.tsx)
 * and the client static fallback (client/src/data/marketing.ts's
 * `insuranceCarriers`) — in sync with both decisions, so a future
 * "Apply Approved Florida Insurance Setup" sync run reproduces exactly the
 * intended 14-payer set: the 13 pre-existing approved payers, plus
 * Curative, minus the two removed payers.
 *
 * Curative is asserted present exactly once in both lists, using the
 * local logo path — not the Production CMS row's presence, which is a
 * separate, out-of-band fact this test can't see. The corresponding
 * Production `logo_url` field still needs a manual Admin update; see the
 * handoff note in the commit this test ships with.
 *
 * No network calls, no CMS, no Production data, no React rendering — mirrors
 * this repo's established pattern (see test-phase14-retire-cms-pricing-sync.mjs)
 * of source-level assertions against the real shipped files.
 *
 *   npx tsx --test scripts/test-insurance-list-reconciliation.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insurancePageSource = readFileSync(join(__dirname, '../src/app/(app)/insurance/page.tsx'), 'utf8');
const marketingSource = readFileSync(join(__dirname, '../../client/src/data/marketing.ts'), 'utf8');
const badgesDir = join(__dirname, '../../client/public/images/insurance/badges');

const REMOVED_PAYERS = ['BH Complete Commercial', 'FL DSNP'];
const CURATIVE_LOGO = '/images/insurance/badges/curative.svg';

function extractApprovedInsurance(source) {
  const match = source.match(/const approvedInsurance = \[([\s\S]*?)\] as const;/);
  assert.ok(match, 'approvedInsurance array not found in admin insurance page source');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

function extractInsuranceCarriers(source) {
  const match = source.match(/export const insuranceCarriers: InsuranceCarrier\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(match, 'insuranceCarriers array not found in client marketing.ts source');
  return Array.from(match[1].matchAll(/name: '([^']+)'(?:[\s\S]*?logo: '([^']+)')?/g)).map((m) => ({ name: m[1], logo: m[2] }));
}

const approved = extractApprovedInsurance(insurancePageSource);
const carrierEntries = extractInsuranceCarriers(marketingSource);
const carriers = carrierEntries.map((c) => c.name);

test('admin approvedInsurance contains exactly 14 unique payer names', () => {
  assert.equal(approved.length, 14);
  assert.equal(new Set(approved).size, 14);
});

test('client insuranceCarriers contains exactly 14 unique payer names', () => {
  assert.equal(carriers.length, 14);
  assert.equal(new Set(carriers).size, 14);
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

test('Curative appears exactly once in admin approvedInsurance', () => {
  assert.equal(approved.filter((name) => name === 'Curative').length, 1);
});

test('Curative appears exactly once in client insuranceCarriers, using the local logo path', () => {
  const matches = carrierEntries.filter((c) => c.name === 'Curative');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].logo, CURATIVE_LOGO);
});

test('curative.svg exists locally, is not a hotlink, and is not the shared placeholder', () => {
  const path = join(badgesDir, 'curative.svg');
  assert.ok(existsSync(path), 'curative.svg must exist in client/public/images/insurance/badges');
  const svg = readFileSync(path, 'utf8');
  // Only the href/src *attribute value* matters here — the embedded base64
  // payload is long enough that "http"/"https" substrings turn up in it by
  // pure chance, so a blanket substring search over the whole file is a
  // false-positive trap. Check what the image element actually points to.
  const hrefMatch = svg.match(/(?:href|src)\s*=\s*"([^"]*)"/);
  assert.ok(hrefMatch, 'curative.svg must have an href/src on its <image> element');
  assert.match(hrefMatch[1], /^data:image\//, 'curative.svg must embed its artwork as a data URI, not reference an external (hotlinked) URL');
  assert.doesNotMatch(svg, /Insurance Plan|insurance-placeholder/, 'curative.svg must not be the generic placeholder');
});

test('PhaseA1Sync still unpublishes any Production row not present in approvedInsurance', () => {
  // Locks in the mechanism that makes the two lists above load-bearing: a
  // sync run must actively unpublish rows outside the approved set (not
  // merely skip them), so removed payers don't linger published, and
  // approved payers (Curative included, now that it's in the array) are
  // published/kept published instead.
  assert.match(insurancePageSource, /toUnpublish\s*=\s*rows\.filter\(\(row\)\s*=>\s*!usedIds\.has\(row\.id\)\s*&&\s*row\.published\)/);
  assert.match(insurancePageSource, /published:\s*false/);
});

test('PhaseA1Sync shows the exact create/update/unpublish plan before applying it', () => {
  // A prior sync run created 7 duplicate rows (with no logo) and
  // unpublished the originals (which had logos), because several
  // Production row names didn't exactly match their approved-list
  // counterpart. Matching is still exact-name (a real behavior change here
  // would need Production row names fixed to match, which is out of
  // this test's reach), but the tool must no longer apply that plan blind
  // — it has to show what will be created and what will be unpublished so
  // a human can catch a mismatch before confirming.
  assert.match(insurancePageSource, /toCreate\.length/);
  assert.match(insurancePageSource, /toUnpublish\.length/);
  assert.match(insurancePageSource, /confirm\(`Apply the approved Florida insurance list and disclaimer\?/);
});
