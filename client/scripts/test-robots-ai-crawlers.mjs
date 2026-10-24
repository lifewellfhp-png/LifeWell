/**
 * Regression tests for AI-search-visibility Part 1 item 1: robots.ts must
 * explicitly allow named AI answer-engine crawlers, disallow
 * /unsubscribe, and link the sitemap.
 *
 * Source-structure assertions against the real file (not an import — this
 * file imports via the `@/` path alias, which the Admin/Server source
 * tests in this repo generally avoid executing directly for the same
 * reason), following this codebase's established convention.
 *
 *   npx tsx --test scripts/test-robots-ai-crawlers.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const sourceRaw = readFileSync(join(root, 'src/app/robots.ts'), 'utf8');
const source = sourceRaw.replace(/\r\n/g, '\n');

const EXPECTED_BOTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'GPTBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'Googlebot',
  'Google-Extended',
  'Bingbot',
  'Applebot',
  'Applebot-Extended',
];

test('1. every named AI crawler is listed', () => {
  for (const bot of EXPECTED_BOTS) {
    assert.ok(source.includes(`'${bot}'`), `expected '${bot}' to be listed`);
  }
});

test('2. each named bot gets its own rule, allow / and disallow /unsubscribe', () => {
  assert.match(source, /\.\.\.AI_CRAWLER_USER_AGENTS\.map\(\(userAgent\) => \(\{/);
  const mapBlock = source.slice(
    source.indexOf('...AI_CRAWLER_USER_AGENTS.map'),
    source.indexOf('})),', source.indexOf('...AI_CRAWLER_USER_AGENTS.map'))
  );
  assert.match(mapBlock, /allow: '\/'/);
  assert.match(mapBlock, /disallow: \['\/unsubscribe'\]/);
});

test('3. the wildcard rule still allows / and now disallows /unsubscribe', () => {
  const wildcardBlock = source.slice(source.indexOf("userAgent: '*',"), source.indexOf("userAgent: '*',") + 260);
  assert.match(wildcardBlock, /allow: '\/'/);
  assert.match(wildcardBlock, /disallow: \['\/unsubscribe'\]/);
});

test('4. the sitemap is linked, and no Spanish sitemap remains', () => {
  assert.match(source, /sitemap: `\$\{site\.url\}\/sitemap\.xml`/);
  assert.doesNotMatch(source, /sitemap-es/);
});

test('5. host is still set to the real production origin', () => {
  assert.match(source, /host: site\.url/);
});

