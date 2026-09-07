/**
 * Phase 13 (Admin Pricing Authority Alignment) regression tests.
 *
 * No network calls, no CMS, no Production data, no React rendering — mirrors
 * this repo's established pattern (see test-benefits-item-editor.mjs,
 * test-faq-governance-admin.mjs) of reimplementing pure closures for direct
 * logic testing, plus source-level assertions for wiring that only makes
 * sense inside a mounted component.
 *
 *   npx tsx --test scripts/test-phase13-admin-pricing-authority.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PROTECTED_PSYCHIATRIC_PRICING } from '../src/lib/protected-pricing.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const feesCopySource = readFileSync(join(__dirname, '../src/components/FeesCopy.tsx'), 'utf8');
const sectionsPageSource = readFileSync(join(__dirname, '../src/app/(app)/sections/page.tsx'), 'utf8');
const clientPricingSource = readFileSync(join(__dirname, '../../client/src/data/pricing.ts'), 'utf8');

function findState(name) {
  return PROTECTED_PSYCHIATRIC_PRICING.find((s) => s.state === name);
}

/** Mirrors the self_pay saveSection() payload construction in FeesCopy.tsx's onSubmit exactly. */
function buildSelfPaySavePayload(selfPayContent, selfPayHeading, selfPayBody) {
  return {
    ...selfPayContent,
    heading: selfPayHeading,
    body: selfPayBody.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// 1-5: protected pricing display values
// ---------------------------------------------------------------------------

test('1. Florida protected pricing is $300/$150', () => {
  assert.equal(findState('Florida').initialFee, 300);
  assert.equal(findState('Florida').followUpFee, 150);
});

test('2. Massachusetts protected pricing is $300/$175', () => {
  assert.equal(findState('Massachusetts').initialFee, 300);
  assert.equal(findState('Massachusetts').followUpFee, 175);
});

test('3. Arizona protected pricing is $325/$175', () => {
  assert.equal(findState('Arizona').initialFee, 325);
  assert.equal(findState('Arizona').followUpFee, 175);
});

test('4. Massachusetts displays Self-Pay Only', () => {
  assert.equal(findState('Massachusetts').selfPayOnly, true);
});

test('5. Arizona displays Self-Pay Only', () => {
  assert.equal(findState('Arizona').selfPayOnly, true);
});

test('Florida does not display Self-Pay Only', () => {
  assert.equal(findState('Florida').selfPayOnly, false);
});

// ---------------------------------------------------------------------------
// 6-12: no editable inputs can modify protected pricing
// ---------------------------------------------------------------------------

test('6. no editable pricing state exists in FeesCopy.tsx (the old psychiatricPricing useState was removed entirely)', () => {
  assert.doesNotMatch(feesCopySource, /useState<PsychiatricStatePricing/);
  assert.doesNotMatch(feesCopySource, /setPsychiatricPricing/);
});

test('7/8. no number input exists for Florida initial or follow-up fee', () => {
  assert.doesNotMatch(feesCopySource, /aria-label=\{`\$\{pricing\.state\} initial fee`\}/);
  assert.doesNotMatch(feesCopySource, /aria-label=\{`\$\{pricing\.state\} follow-up fee`\}/);
});

test('9/10/11/12. no type="number" input exists anywhere in the pricing display block (structurally impossible to edit MA/AZ initial or follow-up)', () => {
  const pricingBlockStart = feesCopySource.indexOf('Protected Psychiatric Pricing');
  const pricingBlockEnd = feesCopySource.indexOf('Intro body');
  const pricingBlock = feesCopySource.slice(pricingBlockStart, pricingBlockEnd);
  assert.doesNotMatch(pricingBlock, /type="number"/);
  assert.doesNotMatch(pricingBlock, /<input/);
  assert.doesNotMatch(pricingBlock, /<textarea/);
  assert.doesNotMatch(pricingBlock, /onChange/);
});

test('the pricing display renders PROTECTED_PSYCHIATRIC_PRICING directly (the actual protected source), not a locally editable copy', () => {
  assert.match(feesCopySource, /PROTECTED_PSYCHIATRIC_PRICING\.map/);
});

// ---------------------------------------------------------------------------
// 13: helper text
// ---------------------------------------------------------------------------

test('13. protected pricing helper text is present and non-alarming', () => {
  const helperTextMatch = feesCopySource.match(/Psychiatric self-pay pricing is managed[\s\S]*?here\./);
  assert.ok(helperTextMatch, 'expected the protected-pricing helper paragraph');
  assert.match(helperTextMatch[0], /Changes to these amounts require a code-level pricing update and deployment/);
  assert.doesNotMatch(helperTextMatch[0], /error|danger|broken|failed/i);
});

test('helper text does not expose a raw file path to the Admin user (scoped to the rendered JSX, not developer code comments)', () => {
  const jsxBlock = feesCopySource.slice(feesCopySource.indexOf('return ('));
  assert.doesNotMatch(jsxBlock, /client\/src\/data\/pricing\.ts/);
  assert.doesNotMatch(jsxBlock, /cms-resolve\.ts/);
});

// ---------------------------------------------------------------------------
// 14-16: marketing copy remains editable
// ---------------------------------------------------------------------------

test('14. Fees heading (intro heading) remains an editable input', () => {
  assert.match(feesCopySource, /id="fees-intro-heading"[\s\S]{0,120}onChange=\{\(e\) => setIntroHeading/);
});

test('15. self-pay explanatory copy remains editable (heading + body)', () => {
  assert.match(feesCopySource, /id="fees-selfpay-heading"[\s\S]{0,120}onChange=\{\(e\) => setSelfPayHeading/);
  assert.match(feesCopySource, /id="fees-selfpay-body"[\s\S]{0,150}onChange=\{\(e\) => setSelfPayBody/);
});

test('16. insurance disclaimer remains editable', () => {
  assert.match(feesCopySource, /id="fees-insurance-disclaimer"[\s\S]{0,200}onChange=\{\(e\) => setInsuranceDisclaimer/);
});

test('intro body remains editable', () => {
  assert.match(feesCopySource, /id="fees-intro-body"[\s\S]{0,120}onChange=\{\(e\) => setIntroBody/);
});

// ---------------------------------------------------------------------------
// 17-18: save payload protection (uses the actual save-payload construction logic)
// ---------------------------------------------------------------------------

test('17. saving marketing copy does not send a protected-pricing UPDATE — the payload never sets psychiatricStatePricing explicitly', () => {
  assert.doesNotMatch(feesCopySource, /psychiatricStatePricing:\s*psychiatric/);
  const saveBlock = feesCopySource.slice(feesCopySource.indexOf("saveSection(selfPayId"), feesCopySource.indexOf('saveSection(insuranceId'));
  assert.doesNotMatch(saveBlock, /psychiatricStatePricing:/);
});

test('18. existing CMS pricing data is not rewritten by an unrelated save — it passes through the spread completely unchanged', () => {
  const existingStalePricing = [{ state: 'Florida', initialFee: 999, followUpFee: 1, selfPayOnly: true, slidingScaleAvailable: false }];
  const loadedContent = { heading: 'Old heading', body: ['Old body'], psychiatricStatePricing: existingStalePricing };
  const payload = buildSelfPaySavePayload(loadedContent, 'New heading only', 'New body only');
  assert.deepEqual(payload.psychiatricStatePricing, existingStalePricing);
});

test('editing only the heading/body leaves any pre-existing pricing key byte-for-byte identical (even a deliberately hostile one)', () => {
  const hostile = [{ state: 'Massachusetts', initialFee: 1, followUpFee: 9999, selfPayOnly: false }];
  const loaded = { psychiatricStatePricing: hostile, someOtherLegacyField: 'kept too' };
  const payload = buildSelfPaySavePayload(loaded, 'New heading', 'New body');
  assert.deepEqual(payload.psychiatricStatePricing, hostile);
  assert.equal(payload.someOtherLegacyField, 'kept too');
});

test('a self_pay row with no pre-existing pricing key at all never gains one from a marketing-copy save', () => {
  const payload = buildSelfPaySavePayload({}, 'Heading', 'Body');
  assert.equal(Object.hasOwn(payload, 'psychiatricStatePricing'), false);
});

// ---------------------------------------------------------------------------
// 19-22: no authority change elsewhere; Phase 12A remains intact
// ---------------------------------------------------------------------------

test('19. no client pricing authority change — mapFees() still always uses the static source (Phase 12A marker still present)', () => {
  assert.match(clientPricingSource, /export const psychiatricStatePricing: PsychiatricStatePricing\[\] = \[/);
});

test('20. no server pricing authority change — this phase touches no server files (verified via the diff, not by this test alone; this test only confirms Admin does not talk to a new/different server endpoint)', () => {
  assert.doesNotMatch(feesCopySource, /\/api\/admin\/(?!sections)/);
});

test('21. no schema migration — protected-pricing.ts is a plain TypeScript module, not a database-backed resource', () => {
  assert.doesNotMatch(
    readFileSync(join(__dirname, '../src/lib/protected-pricing.ts'), 'utf8'),
    /supabase|createClient|from\(/i
  );
});

test('22. the Admin display constant reconciles exactly with client/src/data/pricing.ts\'s approved figures (no second, drifted pricing authority)', () => {
  const match = clientPricingSource.match(/export const psychiatricStatePricing: PsychiatricStatePricing\[\] = \[([\s\S]*?)\];/);
  assert.ok(match, 'expected to find psychiatricStatePricing in client/src/data/pricing.ts');
  for (const state of PROTECTED_PSYCHIATRIC_PRICING) {
    const stateRegex = new RegExp(
      `state: '${state.state}', selfPayOnly: ${state.selfPayOnly}, slidingScaleAvailable: \\w+, initialFee: ${state.initialFee}, followUpFee: ${state.followUpFee}`
    );
    assert.match(match[1], stateRegex, `expected ${state.state}'s admin display values to match client/src/data/pricing.ts exactly`);
  }
});

// ---------------------------------------------------------------------------
// 23-26: adjacent protected facts unaffected
// ---------------------------------------------------------------------------

test('23. sliding-scale wording is untouched by this phase (not present in FeesCopy.tsx at all — it lives in client static copy, unaffected)', () => {
  assert.doesNotMatch(feesCopySource, /Sliding Scale Available — Contact us/);
});

test('24. Florida-only insurance behavior is unchanged — Florida is the only state without Self-Pay Only in the protected display', () => {
  const selfPayOnlyStates = PROTECTED_PSYCHIATRIC_PRICING.filter((s) => s.selfPayOnly).map((s) => s.state);
  assert.deepEqual(selfPayOnlyStates.sort(), ['Arizona', 'Massachusetts']);
});

test('25. MA/AZ self-pay-only behavior is unchanged (both true, matching Phase 12A)', () => {
  assert.equal(findState('Massachusetts').selfPayOnly, true);
  assert.equal(findState('Arizona').selfPayOnly, true);
});

test('26. no $250 pricing reintroduced anywhere in the Admin pricing display', () => {
  assert.ok(!PROTECTED_PSYCHIATRIC_PRICING.some((s) => s.initialFee === 250 || s.followUpFee === 250));
  assert.doesNotMatch(feesCopySource, /\$250/);
});

// ---------------------------------------------------------------------------
// 27-30: protected areas untouched
// ---------------------------------------------------------------------------

test('27. FAQ content/category is untouched by this phase (FeesCopy.tsx has no FAQ-related code)', () => {
  assert.doesNotMatch(feesCopySource, /faq/i);
});

test('28. booking tracking is untouched (FeesCopy.tsx has no booking/trackAs code)', () => {
  assert.doesNotMatch(feesCopySource, /booking_click|trackAs/);
});

test('29. analytics is untouched (FeesCopy.tsx has no analytics code)', () => {
  assert.doesNotMatch(feesCopySource, /analytics/i);
});

test('30. campaigns are untouched (FeesCopy.tsx has no campaign code)', () => {
  assert.doesNotMatch(feesCopySource, /campaign/i);
});

// ---------------------------------------------------------------------------
// Raw JSON editor (Admin -> Sections) — targeted warning, not a global change
// ---------------------------------------------------------------------------

test('the generic Sections JSON editor still allows editing every section (no global behavior change)', () => {
  assert.match(sectionsPageSource, /type: 'json'/);
  assert.doesNotMatch(sectionsPageSource, /disabled/);
});

test('the fees/self_pay row gets a targeted hint warning that its pricing values are inert', () => {
  const contentFieldBlock = sectionsPageSource.slice(sectionsPageSource.indexOf("key: 'content'"));
  assert.match(contentFieldBlock, /form\.page_key === 'fees' && form\.section_key === 'self_pay'/);
  assert.match(contentFieldBlock, /no longer control public pricing/);
});

test('the hint is null (no warning shown) for every other section — it is scoped to exactly one row', () => {
  const contentFieldBlock = sectionsPageSource.slice(
    sectionsPageSource.indexOf("key: 'content'"),
    sectionsPageSource.indexOf("key: 'published'")
  );
  assert.match(contentFieldBlock, /: null/);
});
