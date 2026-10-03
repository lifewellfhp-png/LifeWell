/**
 * Regression tests for the deterministic crisis-language gate
 * (server/src/lib/chatCrisis.ts) that runs BEFORE every Gemini call.
 *
 * No network calls, no CMS, no Production data — pure function tests only.
 *
 *   npx tsx --test scripts/test-chat-crisis-detection.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCrisis, CRISIS_RESPONSE, CRISIS_KEYWORDS } from '../src/lib/chatCrisis.ts';

test('1. every keyword in CRISIS_KEYWORDS triggers detectCrisis on its own', () => {
  for (const keyword of CRISIS_KEYWORDS) {
    assert.equal(detectCrisis(keyword), true, `expected "${keyword}" to trigger detectCrisis`);
  }
});

test('2. keywords are detected case-insensitively and inside a longer sentence', () => {
  assert.equal(detectCrisis('I have been thinking about SUICIDE lately'), true);
  assert.equal(detectCrisis('Sometimes I just want to Kill Myself and be done with it'), true);
});

test('3. benign pricing/hours/booking questions do not trigger detectCrisis', () => {
  const benign = [
    'What is the price for an initial psychiatric evaluation in Florida?',
    'What are your office hours?',
    'Do you accept insurance in Massachusetts?',
    'How do I book an appointment?',
    'Can you tell me about weight management services?',
    'I want to kill some time before my appointment', // contains "kill" but not a listed phrase
  ];
  for (const message of benign) {
    assert.equal(detectCrisis(message), false, `expected "${message}" to NOT trigger detectCrisis`);
  }
});

test('4. CRISIS_RESPONSE cites 988, 911, and the office phone number', () => {
  assert.match(CRISIS_RESPONSE, /988/);
  assert.match(CRISIS_RESPONSE, /911/);
  assert.match(CRISIS_RESPONSE, /\(407\) 603-1717/);
});

test('5. CRISIS_KEYWORDS is a plain, explicit array — not computed/fuzzy matching', () => {
  assert.ok(Array.isArray(CRISIS_KEYWORDS));
  assert.ok(CRISIS_KEYWORDS.length >= 20, 'expected a reasonably broad, reviewable keyword list');
  for (const keyword of CRISIS_KEYWORDS) {
    assert.equal(typeof keyword, 'string');
    assert.equal(keyword, keyword.toLowerCase(), 'keywords should be stored lowercase to match detectCrisis\'s normalization');
  }
});
