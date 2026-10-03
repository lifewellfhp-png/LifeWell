/**
 * Regression tests for the hybrid chat assistant (ChatAssistant.tsx),
 * replacing the earlier button-only ChatWidget. Proves the hybrid design
 * invariants: "Book an Appointment" and "Request a Callback" stay as fixed,
 * deterministic actions (tracked SwapButton / real consented ContactForm,
 * not LLM-generated text), the free-text box goes through the real Express
 * server (not a relative Next.js route), the crisis footer is always
 * present, and nothing is persisted to browser storage.
 *
 * No React rendering harness exists in this project (no testing-library /
 * jsdom), so — matching every other test in this codebase — these are
 * source-structure checks, not DOM-rendering checks.
 *
 *   npx tsx --test scripts/test-chat-assistant-hybrid-ui.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const widgetSource = readFileSync(join(root, 'src/components/chat/ChatAssistant.tsx'), 'utf8');
const layoutSource = readFileSync(join(root, 'src/app/layout.tsx'), 'utf8');
const apiSource = readFileSync(join(root, 'src/lib/api.ts'), 'utf8');

test('1. ChatWidget.tsx no longer exists — replaced, not left dangling alongside the new component', () => {
  assert.throws(() => readFileSync(join(root, 'src/components/chat/ChatWidget.tsx'), 'utf8'));
});

test('2. "Book an Appointment" renders the tracked SwapButton, not LLM-generated text', () => {
  const handlerStart = widgetSource.indexOf('const handleBook');
  assert.ok(handlerStart >= 0);
  const handlerBody = widgetSource.slice(handlerStart, widgetSource.indexOf('const handleCallback'));
  assert.match(handlerBody, /<SwapButton href=\{bookingUrl\} trackAs="booking_click"/);
});

test('3. "Request a Callback" renders the real, unmodified compact ContactForm, not LLM-generated text', () => {
  const handlerStart = widgetSource.indexOf('const handleCallback');
  assert.ok(handlerStart >= 0);
  const handlerBody = widgetSource.slice(handlerStart, widgetSource.indexOf('const handleSubmit'));
  assert.match(handlerBody, /<ContactForm variant="compact"\s*\/>/);
});

test('4. the free-text submit handler calls submitChatMessage (the real Express server), never submitContact or a relative /api/chat fetch', () => {
  const handlerStart = widgetSource.indexOf('const handleSubmit');
  assert.ok(handlerStart >= 0);
  const handlerBody = widgetSource.slice(handlerStart, widgetSource.indexOf('return (', handlerStart));
  assert.match(handlerBody, /submitChatMessage\(/);
  assert.doesNotMatch(handlerBody, /submitContact\(/);
  assert.doesNotMatch(widgetSource, /fetch\(['"]\/api\/chat['"]\)/);
});

test('5. submitChatMessage itself goes through the shared post() helper to the real API base, not a relative Next.js route', () => {
  assert.match(apiSource, /export const submitChatMessage = \(payload[\s\S]{0,80}=>\s*post\('\/api\/chat', payload\);/);
});

test('6. the crisis footer is always rendered, not gated behind a failed free-text exchange', () => {
  const crisisFnStart = widgetSource.indexOf('function CrisisFooter()');
  assert.ok(crisisFnStart >= 0);
  const crisisFnBody = widgetSource.slice(crisisFnStart, widgetSource.indexOf('\n}', crisisFnStart));
  assert.match(crisisFnBody, /site\.crisis\.phoneHref/);
  assert.match(crisisFnBody, /site\.contact\.phoneHref/);
  const footerMatches = widgetSource.match(/<CrisisFooter \/>/g) || [];
  assert.equal(footerMatches.length, 1);
});

test('7. the disclaimer discloses that replies are AI-generated', () => {
  assert.match(widgetSource, /AI-generated/i);
});

test('8. no chat content is ever written to localStorage or sessionStorage', () => {
  // The file's own top-of-file doc comment explains this design decision
  // and legitimately uses the words "localStorage"/"sessionStorage" while
  // explaining why neither is used — strip comments first so that
  // explanation isn't mistaken for actual usage.
  const withoutComments = widgetSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(withoutComments, /localStorage/);
  assert.doesNotMatch(withoutComments, /sessionStorage/);
});

test('9. no free-text input exists outside the one scoped Q&A box (ContactForm\'s own fields are a separate, already-tested component)', () => {
  const inputMatches = widgetSource.match(/<input\b/g) || [];
  assert.equal(inputMatches.length, 1, 'expected exactly one <input> — the Q&A text box');
  assert.doesNotMatch(widgetSource, /<textarea\b/);
});

test('10. the widget is mounted exactly once, in the root layout, fed by the same getResolvedContent() every page uses', () => {
  assert.match(layoutSource, /import \{ ChatAssistant \} from '@\/components\/chat\/ChatAssistant';/);
  assert.match(layoutSource, /import \{ getResolvedContent \} from '@\/lib\/cms-resolve';/);
  const mountMatches = layoutSource.match(/<ChatAssistant\b/g) || [];
  assert.equal(mountMatches.length, 1);
  assert.match(
    layoutSource,
    /<ChatAssistant\s+psychiatricStatePricing=\{cms\.fees\.psychiatricStatePricing\}\s+bookingUrl=\{cms\.booking\.page\}\s*\/>/
  );
});

test('11. the conversation history sent to the server tracks only free-text Q&A turns, not the Book/Callback button interactions', () => {
  // handleBook/handleCallback append to `messages` (the UI transcript) only;
  // neither should ever touch `history`/`setHistory` — that array is the
  // payload sent to the LLM and must stay pure natural-language turns.
  const handleBookBody = widgetSource.slice(
    widgetSource.indexOf('const handleBook'),
    widgetSource.indexOf('const handleCallback')
  );
  const handleCallbackBody = widgetSource.slice(
    widgetSource.indexOf('const handleCallback'),
    widgetSource.indexOf('const handleSubmit')
  );
  assert.doesNotMatch(handleBookBody, /setHistory/);
  assert.doesNotMatch(handleCallbackBody, /setHistory/);
});

test('12. no clinical/symptom/diagnosis wording appears in the widget\'s own copy (comments explaining the design are not in scope)', () => {
  const withoutComments = widgetSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const forbidden = ['symptom', 'diagnos', 'prescri', 'treat your', 'you have anxiety', 'you have depression'];
  const lower = withoutComments.toLowerCase();
  for (const word of forbidden) {
    assert.doesNotMatch(lower, new RegExp(word), `widget copy must not reference "${word}"`);
  }
});
