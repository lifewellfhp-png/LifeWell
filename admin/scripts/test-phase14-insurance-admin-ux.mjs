/**
 * Phase 14 (Insurance Admin Governance Hardening) — Admin UX regression
 * tests. Covers the publish/unpublish confirmation, the approved-payer
 * indicator, and the logo URL field's helper text, all wired through the
 * existing generic ResourceManager mechanisms (Phase 11's
 * confirmFieldChange, Field.hint) rather than one-off insurance-specific
 * UI code.
 *
 * Source-level assertions against the real shipped files, matching this
 * repo's established convention (see test-insurance-list-reconciliation.mjs)
 * — no React rendering, no network calls, no CMS, no Production data.
 *
 *   npx tsx --test scripts/test-phase14-insurance-admin-ux.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const insurancePageSource = readFileSync(join(__dirname, '../src/app/(app)/insurance/page.tsx'), 'utf8');
const resourceManagerSource = readFileSync(join(__dirname, '../src/components/ResourceManager.tsx'), 'utf8');

// --- publish/unpublish confirmation ---

test('the Insurance page wires confirmFieldChange to the `published` field', () => {
  assert.match(insurancePageSource, /confirmFieldChange=\{\{\s*key:\s*'published'/);
});

test('the confirmation message text differs for publish vs unpublish and names the public consequence', () => {
  assert.match(insurancePageSource, /Publish \$\{name\}\?/);
  assert.match(insurancePageSource, /Unpublish \$\{name\}\?/);
  assert.match(insurancePageSource, /will appear on the public Fees & Insurance page/);
  assert.match(insurancePageSource, /will no longer appear on the public Fees & Insurance page/);
});

test('the confirmation message reads the payer name from the current form data, not a hardcoded value', () => {
  assert.match(insurancePageSource, /const name = String\(form\?\.name \|\| 'this insurer'\);/);
});

test('ResourceManager: confirmFieldChange only fires on edit (not create) and only when the value actually changed — this is Phase 11 machinery, unmodified by Phase 14', () => {
  assert.match(resourceManagerSource, /if \(isEdit && confirmFieldChange\)/);
  assert.match(resourceManagerSource, /if \(from !== to && !window\.confirm\(/);
});

test('ResourceManager: confirmFieldChange.message signature carries the current form data (widened for the Insurance page\'s payer-name message, backward compatible with existing 2-arg callers)', () => {
  assert.match(
    resourceManagerSource,
    /message:\s*\(from:\s*string,\s*to:\s*string,\s*form:\s*Record<string,\s*unknown>\)\s*=>\s*string;/
  );
  assert.match(resourceManagerSource, /confirmFieldChange\.message\(from,\s*to,\s*body\)/);
});

// --- approved-payer indicator ---

test('the Insurance table has an Approved column driven by the same approvedInsurance array PhaseA1Sync uses (not a separate/duplicated list)', () => {
  assert.match(insurancePageSource, /const APPROVED_INSURANCE_SET = new Set<string>\(approvedInsurance\);/);
  assert.match(insurancePageSource, /key:\s*'approved',\s*\n\s*label:\s*'Approved'/);
  assert.match(insurancePageSource, /APPROVED_INSURANCE_SET\.has\(String\(r\.name\)\)/);
});

test('approved and not-approved render distinct badges (visually obvious at a glance)', () => {
  assert.match(insurancePageSource, /<span className="badge ok">Approved<\/span>/);
  assert.match(insurancePageSource, /<span className="badge warn">Not approved<\/span>/);
});

test('the Published column stays within the first 4 columns, so it still renders on mobile cards (ResourceManager only shows columns.slice(0, 4) there) — a real regression this phase\'s own browser verification caught: adding Approved as the 4th column silently pushed Published off mobile', () => {
  const columnsMatch = insurancePageSource.match(/columns=\{\[([\s\S]*?)\n\s{6}\]\}/);
  assert.ok(columnsMatch, 'expected to locate the columns=[...] array');
  const keys = Array.from(columnsMatch[1].matchAll(/key:\s*'([^']+)'/g)).map((m) => m[1]);
  const publishedIndex = keys.indexOf('published');
  assert.ok(publishedIndex >= 0 && publishedIndex < 4, `expected 'published' within the first 4 columns, got index ${publishedIndex} of ${JSON.stringify(keys)}`);
});

// --- owner-facing helper text ---

test('helper text explains publication visibility and the approved-list restriction', () => {
  assert.match(insurancePageSource, /Published insurers appear on the public Fees &amp; Insurance page/);
  assert.match(insurancePageSource, /Only insurers in LifeWell&rsquo;s approved\s*\n?\s*payer list may be published/);
});

// --- logo URL field affordance ---

test('the logo_url field has a hint describing accepted formats, and is NOT type: "url"', () => {
  // Deliberately not type: 'url' — this field's most common legitimate value
  // is a relative local path, which HTML5's native url input validation
  // rejects as invalid. That validation runs across the whole form at
  // submit time, so setting this would silently block every save
  // (including ones that never touch logo_url) with no error and nothing
  // to debug from JS — this exact regression was caught and reverted
  // during this phase's own browser verification.
  const labelIdx = insurancePageSource.indexOf(`label: 'Logo URL (from Media)'`);
  assert.ok(labelIdx >= 0, 'expected the logo_url field label in the fields array');
  const fieldBlock = insurancePageSource.slice(labelIdx, labelIdx + 1100);
  assert.match(fieldBlock, /hint:\s*\(\)\s*=>/, 'expected a hint function on the logo_url field');
  // Line-anchored so this can't false-positive on the explanatory comment
  // above (which necessarily quotes the literal string "type: 'url'" to
  // explain why it isn't there) — only an actual `type: 'url',` property
  // line, not a `//`-prefixed mention of it, would match this.
  assert.doesNotMatch(fieldBlock, /^\s*type:\s*'url',\s*$/m);
});

test('the logo_url hint mentions both the local path convention and https support', () => {
  const hintMatch = insurancePageSource.match(/hint:\s*\(\)\s*=>\s*`([^`]+)`/);
  assert.ok(hintMatch, 'expected a logo_url hint template string');
  assert.match(hintMatch[1], /\/images\/insurance\//);
  assert.match(hintMatch[1], /https:\/\//);
});
