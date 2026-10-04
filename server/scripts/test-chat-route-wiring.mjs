/**
 * Structural regression tests for the /api/chat route wiring: confirms the
 * rate limiter is actually applied, and — the key safety guarantee —
 * confirms the controller never imports any lead-storage or email-sending
 * helper, so "no chat content is ever persisted" can't silently regress
 * without a visible test failure.
 *
 * Source-structure checks, matching this repo's established style (e.g.
 * client/scripts/test-contact-non-clinical-boundary.mjs) — no network, no
 * CMS, no Production data, no server boot required.
 *
 *   npx tsx --test scripts/test-chat-route-wiring.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const routesSource = readFileSync(join(root, 'src/routes/index.ts'), 'utf8');
const middlewareSource = readFileSync(join(root, 'src/middleware/index.ts'), 'utf8');
const controllerSource = readFileSync(join(root, 'src/controllers/chat.controller.ts'), 'utf8');

test('1. /api/chat is registered with chatLimiter applied', () => {
  assert.match(routesSource, /router\.post\('\/api\/chat',\s*chatLimiter,\s*asyncHandler\(handleChat\)\);/);
});

test('2. chatLimiter exists and is built on the shared limiter() factory, same as contactLimiter', () => {
  assert.match(middlewareSource, /export const chatLimiter = limiter\(/);
  const chatIdx = middlewareSource.indexOf('export const chatLimiter');
  const chatBlock = middlewareSource.slice(chatIdx, middlewareSource.indexOf(');', chatIdx) + 2);
  assert.match(chatBlock, /env\.RATE_LIMIT_CHAT/);
});

test('3. the chat controller never imports a lead-storage or email-sending helper', () => {
  assert.doesNotMatch(controllerSource, /storeLead/);
  assert.doesNotMatch(controllerSource, /sendContactNotification/);
  assert.doesNotMatch(controllerSource, /logEmailMessage/);
  assert.doesNotMatch(controllerSource, /from ['"]\.\.\/controllers\/leads\.controller/);
});

test('4. the chat controller checks for crisis language before calling Gemini', () => {
  const crisisIdx = controllerSource.indexOf('detectCrisis(message)');
  const geminiIdx = controllerSource.indexOf('callGemini(');
  assert.ok(crisisIdx >= 0, 'expected a detectCrisis(message) call');
  assert.ok(geminiIdx >= 0, 'expected a callGemini(...) call');
  assert.ok(crisisIdx < geminiIdx, 'crisis detection must run before the Gemini call, not after');
});

test('5. a crisis match returns directly, without falling through to the Gemini call', () => {
  const crisisBlockMatch = controllerSource.match(/if \(detectCrisis\(message\)\) \{([\s\S]*?)\n  \}/);
  assert.ok(crisisBlockMatch, 'expected an if (detectCrisis(message)) { ... } block');
  assert.match(crisisBlockMatch[1], /return;/);
});

test('6. error handling never echoes raw error details back to the client', () => {
  const catchBlock = controllerSource.slice(controllerSource.indexOf('} catch (err) {'));
  assert.doesNotMatch(catchBlock, /message:\s*err\.message/);
  assert.doesNotMatch(catchBlock, /message:\s*String\(err\)/);
});

test('7. successful responses use the shared {success, message} shape every other public endpoint uses, not a one-off field name', () => {
  assert.match(controllerSource, /res\.json\(\{ success: true, message: CRISIS_RESPONSE \}\)/);
  assert.match(controllerSource, /res\.json\(\{ success: true, message: reply \}\)/);
});

test('8. the controller fetches pricing, insurance, services, and provider info together (Promise.all), not sequentially or omitting any of them', () => {
  const allIdx = controllerSource.indexOf('Promise.all([');
  assert.ok(allIdx >= 0, 'expected a Promise.all([...]) call');
  const block = controllerSource.slice(allIdx, controllerSource.indexOf(']);', allIdx));
  assert.match(block, /getPsychiatricStatePricing\(\)/);
  assert.match(block, /getInsurancePlans\(\)/);
  assert.match(block, /getServicesList\(\)/);
  assert.match(block, /getProviderInfo\(\)/);
});

test('9. all four resolved values are passed into buildSystemPrompt, in the order buildSystemPrompt expects', () => {
  assert.match(controllerSource, /buildSystemPrompt\(pricing, insurance, services, provider\)/);
});
