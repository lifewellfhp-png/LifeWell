/**
 * Regression tests for AI-search-visibility Part 3's Spanish site
 * infrastructure: the separate (es) root layout, its <html lang>, the
 * language switcher's path mapping, and the homepage's hreflang wiring.
 *
 *   npx tsx --test scripts/test-spanish-site-infra.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const esLayoutSource = readFileSync(join(root, 'src/app/(es)/es/layout.tsx'), 'utf8').replace(/\r\n/g, '\n');
const enLayoutSource = readFileSync(join(root, 'src/app/(en)/layout.tsx'), 'utf8').replace(/\r\n/g, '\n');
const esHomeSource = readFileSync(join(root, 'src/app/(es)/es/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
const switcherSource = readFileSync(join(root, 'src/components/layout/LanguageSwitcher.tsx'), 'utf8').replace(
  /\r\n/g,
  '\n'
);

test('1. the Spanish root layout declares <html lang="es">, separate from the English one', () => {
  assert.match(esLayoutSource, /<html lang="es"/);
  assert.match(enLayoutSource, /<html lang="en-US"/);
});

test('2. the Spanish layout renders HeaderEs/FooterEs, not the English Header/Footer', () => {
  assert.match(esLayoutSource, /<HeaderEs\b/);
  assert.match(esLayoutSource, /<FooterEs\b/);
  assert.doesNotMatch(esLayoutSource, /<SiteHeader\b/);
  assert.doesNotMatch(esLayoutSource, /<Footer\b/);
});

test('3. the chat assistant on the Spanish layout gets a localeNote; the English one does not', () => {
  const esChatBlock = esLayoutSource.slice(esLayoutSource.indexOf('<ChatAssistant'));
  assert.match(esChatBlock, /localeNote=/);
  assert.doesNotMatch(enLayoutSource, /localeNote=/);
});

test('4. the language switcher maps / <-> /es and preserves the rest of the path', () => {
  const fnStart = switcherSource.indexOf('function otherLocaleHref');
  const fnBody = switcherSource.slice(fnStart, switcherSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /pathname === '\/' \? '\/es' : `\/es\$\{pathname\}`/);
  assert.match(fnBody, /pathname\.replace\(\/\^\\\/es\/, ''\)/);
});

test('5. the switcher never auto-redirects — it only sets a cookie on explicit click, never reads it to redirect', () => {
  assert.match(switcherSource, /document\.cookie = /);
  assert.doesNotMatch(switcherSource, /router\.push|redirect\(/);
});

test('5b. the English homepage sets reciprocal hreflang to the Spanish homepage', () => {
  const enHomeSource = readFileSync(join(root, 'src/app/(en)/page.tsx'), 'utf8');
  assert.match(enHomeSource, /alternateLocale: \{ es: '\/es' \}/);
});

test('6. the Spanish homepage sets reciprocal hreflang back to the English homepage', () => {
  assert.match(esHomeSource, /path: '\/es'/);
  assert.match(esHomeSource, /alternateLocale: \{ en: '\/' \}/);
  assert.match(esHomeSource, /ogLocale: 'es_US'/);
});

test('7. the Spanish homepage reads live booking/fees data (never a stale duplicate of governed prices), but static copy for descriptive text', () => {
  assert.match(esHomeSource, /await getResolvedContent\(\)/);
  assert.match(esHomeSource, /cms\.booking\.page/);
});

test('8. the Spanish disclaimer helper is the exact owner-given sentence and is used on the homepage', () => {
  const siteSource = readFileSync(join(root, 'src/data/site.ts'), 'utf8');
  assert.match(
    siteSource,
    /Las consultas se realizan en inglés, francés y criollo haitiano\./
  );
  assert.match(esHomeSource, /formatCareLanguagesEs\(\)/);
});
