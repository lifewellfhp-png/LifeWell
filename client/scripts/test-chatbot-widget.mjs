/**
 * Regression tests for the site-wide chat widget (ChatWidget.tsx).
 *
 * Covers the invariants that matter most for a public-facing, healthcare-
 * practice chat surface: no free-text input exists anywhere in it (matching
 * the same non-clinical-boundary discipline test-contact-non-clinical-
 * boundary.mjs proves for the Contact form), the crisis/human-handoff line
 * is always present, lead capture reuses the existing validated ContactForm
 * rather than a new form, and no dollar figure or governance fact is
 * hardcoded as a literal where it should come from a prop/import instead.
 *
 * No React rendering harness exists in this project (no testing-library /
 * jsdom), so — matching every other test in this codebase — these are
 * source-structure checks, not DOM-rendering checks.
 *
 *   npx tsx --test scripts/test-chatbot-widget.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const widgetSource = readFileSync(join(root, 'src/components/chat/ChatWidget.tsx'), 'utf8');
const layoutSource = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');

test('1. no free-text input or textarea exists anywhere in the widget', () => {
  assert.doesNotMatch(widgetSource, /<input\b/);
  assert.doesNotMatch(widgetSource, /<textarea\b/);
});

test('2. the widget is button/menu-driven, not an open text composer', () => {
  // Every interactive control besides the lead-capture ContactForm is a
  // <button>; there is no form submission in ChatWidget.tsx itself (the
  // only <form> in this flow belongs to the embedded ContactForm).
  assert.doesNotMatch(widgetSource, /<form\b/);
  assert.match(widgetSource, /<ContactForm variant="compact"\s*\/>/);
});

test('3. lead capture reuses the existing validated ContactForm — no second, parallel submission path', () => {
  assert.match(widgetSource, /import \{ ContactForm \} from '@\/components\/forms\/ContactForm';/);
  assert.doesNotMatch(widgetSource, /fetch\(/);
  assert.doesNotMatch(widgetSource, /submitContact/);
});

test('4. the crisis line and a direct human phone number are always rendered, not gated behind a failed-understanding step', () => {
  const crisisFnStart = widgetSource.indexOf('function CrisisNote()');
  assert.ok(crisisFnStart >= 0, 'expected a CrisisNote component');
  const crisisFnBody = widgetSource.slice(crisisFnStart, widgetSource.indexOf('\n}', crisisFnStart));
  assert.match(crisisFnBody, /site\.crisis\.phoneHref/);
  assert.match(crisisFnBody, /site\.contact\.phoneHref/);
  // Rendered unconditionally at the end of the panel, on every screen.
  assert.match(widgetSource, /<CrisisNote \/>\s*\n\s*<\/div>\s*\n\s*\)\}/);
});

test('5. psychiatric pricing is read from the resolved prop, never a hardcoded dollar literal', () => {
  assert.match(widgetSource, /psychiatricStatePricing\s*:\s*PsychiatricStatePricing\[\]/);
  assert.match(widgetSource, /psychiatricStatePricing\.map\(/);
  // No bare "$NNN" literal anywhere in the component source.
  assert.doesNotMatch(widgetSource, /\$\d{2,4}\b/);
});

test('6. Primary Care / Weight Management pricing comes from the shared pricingTiers import, not a second copy', () => {
  assert.match(widgetSource, /import \{ pricingTiers \} from '@\/data\/pricing';/);
  assert.match(widgetSource, /pricingTiers\.map\(/);
});

test('7. the self-pay-only label on the Service Areas screen is derived from the pricing prop, not a separate hardcoded claim', () => {
  const areasIdx = widgetSource.indexOf("screen === 'areas'");
  assert.ok(areasIdx >= 0);
  const areasBlock = widgetSource.slice(areasIdx, widgetSource.indexOf("screen === 'services'"));
  assert.match(areasBlock, /psychiatricStatePricing\.find/);
  assert.match(areasBlock, /selfPayOnly/);
});

test("8. booking goes through the shared SwapButton with trackAs=\"booking_click\" — conversion tracking stays consistent with the rest of the site", () => {
  assert.match(widgetSource, /<SwapButton href=\{bookingUrl\} trackAs="booking_click"/);
});

test('9. the widget is mounted exactly once, in the root layout, fed by the same getResolvedContent() every page uses', () => {
  assert.match(layoutSource, /import \{ ChatWidget \} from '@\/components\/chat\/ChatWidget';/);
  assert.match(layoutSource, /import \{ getResolvedContent \} from '@\/lib\/cms-resolve';/);
  const mountMatches = layoutSource.match(/<ChatWidget\b/g) || [];
  assert.equal(mountMatches.length, 1);
  assert.match(layoutSource, /<ChatWidget\s+psychiatricStatePricing=\{cms\.fees\.psychiatricStatePricing\}\s+bookingUrl=\{cms\.booking\.page\}\s*\/>/);
});

test('10. no clinical/symptom/diagnosis wording appears anywhere in the widget\'s own rendered copy (menu labels, screen text) — comments explaining the design rationale are not in scope', () => {
  // Strip /* */ and // comments first — the file's own doc comments discuss
  // *why* clinical wording is avoided, which legitimately uses words like
  // "symptom"; only rendered copy is checked here.
  const withoutComments = widgetSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  const forbidden = ['symptom', 'diagnos', 'prescri', 'treat your', 'you have anxiety', 'you have depression'];
  const lower = withoutComments.toLowerCase();
  for (const word of forbidden) {
    assert.doesNotMatch(lower, new RegExp(word), `widget copy must not reference "${word}"`);
  }
});
