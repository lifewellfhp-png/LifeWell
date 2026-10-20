/**
 * Regression tests for AI-search-visibility Part 2 item 7: blog posts
 * must show the real CMS author byline (falling back to the practice
 * provider only when a post has none), and BlogPosting schema must
 * carry author credentials, not just a bare name.
 *
 *   npx tsx --test scripts/test-blog-author-credentials.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const pageSource = readFileSync(join(root, 'src/app/(en)/blog/[slug]/page.tsx'), 'utf8').replace(/\r\n/g, '\n');
const schemaSource = readFileSync(join(root, 'src/lib/schema.ts'), 'utf8').replace(/\r\n/g, '\n');

test('1. the blog post page reads post.author_name, falling back to BLOG_AUTHOR_BYLINE', () => {
  assert.match(pageSource, /const authorName = str\(post\.author_name\) \|\| BLOG_AUTHOR_BYLINE;/);
});

test('2. the schema and the visible byline both use the resolved authorName, not the hardcoded constant directly', () => {
  assert.match(pageSource, /authorName,\s*\n\s*breadcrumb: crumbs,/);
  assert.match(pageSource, /<span>By \{authorName\}<\/span>/);
  assert.doesNotMatch(pageSource, /authorName: BLOG_AUTHOR_BYLINE/);
  assert.doesNotMatch(pageSource, /<span>By \{BLOG_AUTHOR_BYLINE\}<\/span>/);
});

test('3. articleGraph references the full credentialed provider node (@id) when the author is the practice’s own provider', () => {
  const fnStart = schemaSource.indexOf('export function articleGraph');
  const fnBody = schemaSource.slice(fnStart, schemaSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /authorIsProvider\(input\.authorName\)/);
  assert.match(fnBody, /\{ '@id': PROVIDER_ID \}/);
});

test('4. a genuinely different guest-author name still renders as a bare Person (never fabricates credentials for an unknown author)', () => {
  const fnStart = schemaSource.indexOf('function authorIsProvider');
  const fnBody = schemaSource.slice(fnStart, schemaSource.indexOf('\n}', fnStart));
  assert.match(fnBody, /includes\(provider\.name\.toLowerCase\(\)\)/);
});

test('5. datePublished/dateModified wiring is untouched by this change', () => {
  assert.match(schemaSource, /\.\.\.\(input\.publishedAt \? \{ datePublished: input\.publishedAt \} : \{\}\)/);
  assert.match(schemaSource, /dateModified: input\.modifiedAt \?\? input\.publishedAt \?\? undefined/);
});
