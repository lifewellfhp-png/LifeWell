/**
 * Regression tests for buildSystemPrompt() (server/src/lib/chatPrompt.ts) —
 * a pure function, given a fixed pricing fixture, with no network/CMS call.
 *
 *   npx tsx --test scripts/test-chat-system-prompt.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../src/lib/chatPrompt.ts';
import { CHAT_NAP } from '../src/lib/chatFacts.ts';

const FIXTURE = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 250, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 350, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 165 },
];

test('1. the prompt includes the exact pricing figures passed in, not a hardcoded value', () => {
  const prompt = buildSystemPrompt(FIXTURE);
  assert.match(prompt, /\$250/);
  assert.match(prompt, /\$150/);
  assert.match(prompt, /\$350/);
  assert.match(prompt, /\$175/);
  assert.match(prompt, /\$325/);
  assert.match(prompt, /\$165/);
});

test('2. changing the input pricing changes the prompt output — proves it is not a static string', () => {
  const changed = [
    { ...FIXTURE[0], initialFee: 999 },
    FIXTURE[1],
    FIXTURE[2],
  ];
  const prompt = buildSystemPrompt(changed);
  assert.match(prompt, /\$999/);
  assert.doesNotMatch(prompt, /\$250\b/);
});

test('3. Self-Pay Only is stated for Massachusetts/Arizona but not Florida', () => {
  const prompt = buildSystemPrompt(FIXTURE);
  const flLine = prompt.split('\n').find((l) => l.startsWith('- Florida:'));
  const maLine = prompt.split('\n').find((l) => l.startsWith('- Massachusetts:'));
  assert.doesNotMatch(flLine, /Self-Pay Only/);
  assert.match(maLine, /Self-Pay Only/);
});

test('4. NAP facts (phone, address, hours) are present', () => {
  const prompt = buildSystemPrompt(FIXTURE);
  assert.match(prompt, new RegExp(CHAT_NAP.phone.replace(/[()]/g, '\\$&')));
  assert.match(prompt, new RegExp(CHAT_NAP.address));
  for (const hour of CHAT_NAP.hours) {
    assert.match(prompt, new RegExp(hour.replace(/[().]/g, '\\$&')));
  }
});

test('5. the clinical-boundary rules are present (no diagnosis/treatment/medication advice)', () => {
  const prompt = buildSystemPrompt(FIXTURE);
  assert.match(prompt, /never give a medical diagnosis/i);
  assert.match(prompt, /never claim to be a licensed clinician or a real person/i);
});

test('6. non-psychiatric tiers (Primary Care, Weight Management) are included', () => {
  const prompt = buildSystemPrompt(FIXTURE);
  assert.match(prompt, /Primary Care: Initial \$135/);
  assert.match(prompt, /Weight Management: Initial \$125/);
});

test('7. the prompt instructs plain-text replies, no markdown — replies render in a plain chat bubble, not a markdown renderer', () => {
  const prompt = buildSystemPrompt(FIXTURE);
  assert.match(prompt, /no markdown/i);
  assert.match(prompt, /no \*\*bold\*\*/);
});
