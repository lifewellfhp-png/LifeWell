/**
 * Regression tests for AI-search-visibility Part 2 item 4: /llms.txt
 * must be built from the same resolved content every page renders from
 * (never a hand-maintained second copy of these facts), and must never
 * claim Spanish as a language of care.
 *
 *   npx tsx --test scripts/test-llms-txt.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const source = readFileSync(join(root, 'src/app/llms.txt/route.ts'), 'utf8').replace(/\r\n/g, '\n');

test('1. the route is a GET handler returning text/plain', () => {
  assert.match(source, /export async function GET\(\)/);
  assert.match(source, /'Content-Type': 'text\/plain; charset=utf-8'/);
});

test('2. it reads from getResolvedContent(), never a hardcoded/static duplicate of services or pricing', () => {
  assert.match(source, /await getResolvedContent\(\)/);
  assert.match(source, /cms\.homeServices/);
  assert.match(source, /cms\.fees\.psychiatricStatePricing/);
  assert.match(source, /cms\.telehealthStates/);
});

test('3. languages of care come from the shared formatCareLanguages() helper, not a separate literal list', () => {
  assert.match(source, /formatCareLanguages\(\)/);
  assert.doesNotMatch(source, /'English', 'French'/);
});

test('4. the route doc comment states llms.txt is optional/unconfirmed by major AI providers', () => {
  assert.match(source, /optional and experimental/i);
  assert.match(source, /no\s*\n?\s*\*?\s*major AI provider/i);
});
