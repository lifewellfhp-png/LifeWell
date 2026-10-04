/**
 * Regression tests for buildSystemPrompt() (server/src/lib/chatPrompt.ts) —
 * a pure function, given fixed pricing/insurance/services/provider
 * fixtures, with no network/CMS call.
 *
 *   npx tsx --test scripts/test-chat-system-prompt.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSystemPrompt } from '../src/lib/chatPrompt.ts';
import { CHAT_NAP, CHAT_INSURANCE_FALLBACK, CHAT_SERVICES_FALLBACK, CHAT_PROVIDER_FALLBACK } from '../src/lib/chatFacts.ts';

const PRICING_FIXTURE = [
  { state: 'Florida', selfPayOnly: false, slidingScaleAvailable: true, initialFee: 250, followUpFee: 150 },
  { state: 'Massachusetts', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 350, followUpFee: 175 },
  { state: 'Arizona', selfPayOnly: true, slidingScaleAvailable: true, initialFee: 325, followUpFee: 165 },
];

const INSURANCE_FIXTURE = ['Aetna (Commercial)', 'Medicaid'];
const SERVICES_FIXTURE = ['Psychiatric Evaluations', 'Weight Management'];
const PROVIDER_FIXTURE = { name: 'Jane Doe', credentials: 'PMHNP-BC', role: 'Psychiatric-Mental Health Nurse Practitioner' };

function buildPrompt(pricing = PRICING_FIXTURE, insurance = INSURANCE_FIXTURE, services = SERVICES_FIXTURE, provider = PROVIDER_FIXTURE) {
  return buildSystemPrompt(pricing, insurance, services, provider);
}

test('1. the prompt includes the exact pricing figures passed in, not a hardcoded value', () => {
  const prompt = buildPrompt();
  assert.match(prompt, /\$250/);
  assert.match(prompt, /\$150/);
  assert.match(prompt, /\$350/);
  assert.match(prompt, /\$175/);
  assert.match(prompt, /\$325/);
  assert.match(prompt, /\$165/);
});

test('2. changing the input pricing changes the prompt output — proves it is not a static string', () => {
  const changed = [{ ...PRICING_FIXTURE[0], initialFee: 999 }, PRICING_FIXTURE[1], PRICING_FIXTURE[2]];
  const prompt = buildPrompt(changed);
  assert.match(prompt, /\$999/);
  assert.doesNotMatch(prompt, /\$250\b/);
});

test('3. Self-Pay Only is stated for Massachusetts/Arizona but not Florida', () => {
  const prompt = buildPrompt();
  const flLine = prompt.split('\n').find((l) => l.startsWith('- Florida:'));
  const maLine = prompt.split('\n').find((l) => l.startsWith('- Massachusetts:'));
  assert.doesNotMatch(flLine, /Self-Pay Only/);
  assert.match(maLine, /Self-Pay Only/);
});

test('4. NAP facts (phone, address, hours) are present', () => {
  const prompt = buildPrompt();
  assert.match(prompt, new RegExp(CHAT_NAP.phone.replace(/[()]/g, '\\$&')));
  assert.match(prompt, new RegExp(CHAT_NAP.address));
  for (const hour of CHAT_NAP.hours) {
    assert.match(prompt, new RegExp(hour.replace(/[().]/g, '\\$&')));
  }
});

test('5. the clinical-boundary rules are present (no diagnosis/treatment/medication advice)', () => {
  const prompt = buildPrompt();
  assert.match(prompt, /never give a medical diagnosis/i);
  assert.match(prompt, /never claim to be a licensed clinician or a real person/i);
});

test('6. non-psychiatric tiers (Primary Care, Weight Management) are included', () => {
  const prompt = buildPrompt();
  assert.match(prompt, /Primary Care: Initial \$135/);
  assert.match(prompt, /Weight Management: Initial \$125/);
});

test('7. the prompt instructs plain-text replies, no markdown — replies render in a plain chat bubble, not a markdown renderer', () => {
  const prompt = buildPrompt();
  assert.match(prompt, /no markdown/i);
  assert.match(prompt, /no \*\*bold\*\*/);
});

test('8. the exact insurance list passed in is included, not a hardcoded value', () => {
  const prompt = buildPrompt(undefined, ['Totally Different Payer']);
  assert.match(prompt, /Totally Different Payer/);
  assert.doesNotMatch(prompt, /Aetna \(Commercial\)/);
});

test('9. the exact services list passed in is included, not a hardcoded value', () => {
  const prompt = buildPrompt(undefined, undefined, ['Some New Service Line']);
  assert.match(prompt, /Some New Service Line/);
  assert.doesNotMatch(prompt, /Psychiatric Evaluations/);
});

test('10. the exact provider info passed in is included, not a hardcoded value', () => {
  const prompt = buildPrompt(undefined, undefined, undefined, { name: 'Someone Else', credentials: 'MD', role: 'Psychiatrist' });
  assert.match(prompt, /Someone Else, MD \(Psychiatrist\)/);
});

test('11. the insurance list is explicitly scoped to Florida, matching the real site copy', () => {
  const prompt = buildPrompt();
  assert.match(prompt, /Florida only.*Massachusetts and Arizona are self-pay only/);
});

test('12. the rule against inventing facts explicitly covers insurance plans and services, not just pricing', () => {
  const prompt = buildPrompt();
  assert.match(prompt, /insurance plan or service not on these lists/i);
});

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('13. with the real fallback constants, the prompt renders every fallback insurance/service name and the fallback provider', () => {
  const prompt = buildSystemPrompt(PRICING_FIXTURE, CHAT_INSURANCE_FALLBACK, CHAT_SERVICES_FALLBACK, CHAT_PROVIDER_FALLBACK);
  for (const name of CHAT_INSURANCE_FALLBACK) {
    assert.match(prompt, new RegExp(escapeRegExp(name)), `expected insurance "${name}" in prompt`);
  }
  for (const title of CHAT_SERVICES_FALLBACK) {
    assert.match(prompt, new RegExp(escapeRegExp(title)), `expected service "${title}" in prompt`);
  }
  assert.match(prompt, new RegExp(escapeRegExp(CHAT_PROVIDER_FALLBACK.name)));
});
