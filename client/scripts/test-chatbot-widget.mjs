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

test('2. the widget is a button-driven message transcript, not an open text composer', () => {
  // Every interactive control besides the lead-capture ContactForm is a
  // <button>; there is no form submission in ChatWidget.tsx itself (the
  // only <form> in this flow belongs to the embedded ContactForm).
  assert.doesNotMatch(widgetSource, /<form\b/);
  assert.match(widgetSource, /<ContactForm variant="compact"\s*\/>/);
  // Every bot turn that isn't terminal offers option buttons, never a text
  // box, to continue the conversation.
  assert.match(widgetSource, /m\.options\.map\(/);
});

test('3. lead capture reuses the existing validated ContactForm — no second, parallel submission path', () => {
  assert.match(widgetSource, /import \{ ContactForm \} from '@\/components\/forms\/ContactForm';/);
  assert.doesNotMatch(widgetSource, /fetch\(/);
  assert.doesNotMatch(widgetSource, /submitContact/);
});

test('4. the crisis line and a direct human phone number are always rendered, not gated behind a failed-understanding step', () => {
  const crisisFnStart = widgetSource.indexOf('function CrisisFooter()');
  assert.ok(crisisFnStart >= 0, 'expected a CrisisFooter component');
  const crisisFnBody = widgetSource.slice(crisisFnStart, widgetSource.indexOf('\n}', crisisFnStart));
  assert.match(crisisFnBody, /site\.crisis\.phoneHref/);
  assert.match(crisisFnBody, /site\.contact\.phoneHref/);
  // Rendered unconditionally once per open panel, as a sibling AFTER the
  // per-message transcript — not nested inside messages.map, so it is never
  // tied to any particular bot reply or failure state.
  const footerMatches = widgetSource.match(/<CrisisFooter \/>/g) || [];
  assert.equal(footerMatches.length, 1);
  const messagesMapEnd = widgetSource.indexOf('</div>\n\n          <CrisisFooter />');
  assert.ok(messagesMapEnd >= 0, 'expected CrisisFooter to sit immediately after the transcript container closes');
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

test('7. the self-pay-only label on the Service Areas reply is derived from the pricing prop, not a separate hardcoded claim', () => {
  const areasIdx = widgetSource.indexOf("case 'AREAS':");
  assert.ok(areasIdx >= 0, "expected a case 'AREAS': branch in the reply() function");
  const areasBlock = widgetSource.slice(areasIdx, widgetSource.indexOf("case 'SERVICES':"));
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

test('11. every non-terminal bot reply (PRICING, AREAS, SERVICES, BOOK, CALLBACK) loops back to the main menu instead of dead-ending the conversation', () => {
  for (const action of ['PRICING', 'AREAS', 'SERVICES', 'BOOK', 'CALLBACK']) {
    const caseIdx = widgetSource.indexOf(`case '${action}':`);
    assert.ok(caseIdx >= 0, `expected a case '${action}': branch`);
    const nextCaseIdx = widgetSource.indexOf("case '", caseIdx + 1);
    const block = widgetSource.slice(caseIdx, nextCaseIdx > 0 ? nextCaseIdx : undefined);
    assert.match(block, /action: 'MENU'/, `${action} reply must offer a way back to the main menu`);
  }
});

test("12. clicking an option appends both the user's selection and the bot's reply to the transcript, rather than replacing it", () => {
  const handlerStart = widgetSource.indexOf('const handleOptionClick');
  assert.ok(handlerStart >= 0);
  const handlerBody = widgetSource.slice(handlerStart, widgetSource.indexOf('};', handlerStart));
  assert.match(handlerBody, /setMessages\(\(prev\) => \[\s*\.\.\.prev,/);
  assert.match(handlerBody, /sender: 'user'/);
  assert.match(handlerBody, /reply\(action, psychiatricStatePricing, bookingUrl\)/);
});
