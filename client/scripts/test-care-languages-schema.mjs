/**
 * Regression tests for AI-search-visibility Part 2 item 6 (and the
 * LANGUAGE CHOICE hard constraint underlying this whole engagement
 * item): structured data must state the real clinical languages of
 * care (English, French, Haitian Creole) via knowsLanguage/
 * availableLanguage, sourced from one shared constant, and must never
 * list Spanish there — even once the site's written text is translated
 * into Spanish (Part 3), which is a different fact (inLanguage).
 *
 *   npx tsx --test scripts/test-care-languages-schema.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { CARE_LANGUAGES } from '../src/data/site.ts';
import { organizationNode, providerNode } from '../src/lib/schema.ts';

test('1. CARE_LANGUAGES is exactly English, French, Haitian Creole — never Spanish', () => {
  assert.deepEqual([...CARE_LANGUAGES], ['English', 'French', 'Haitian Creole']);
  assert.ok(!CARE_LANGUAGES.some((l) => /spanish/i.test(l)));
});

test('2. organizationNode() emits availableLanguage from CARE_LANGUAGES', () => {
  const node = organizationNode();
  assert.deepEqual(node.availableLanguage, ['English', 'French', 'Haitian Creole']);
});

test('3. providerNode() emits knowsLanguage from CARE_LANGUAGES', () => {
  const node = providerNode();
  assert.deepEqual(node.knowsLanguage, ['English', 'French', 'Haitian Creole']);
});

test('4. neither field ever includes Spanish, with or without CMS-resolved provider data', () => {
  const withResolved = providerNode({ name: 'Test Provider', credentials: 'PMHNP-BC' });
  assert.ok(!withResolved.knowsLanguage.some((l) => /spanish/i.test(l)));
  assert.ok(!organizationNode().availableLanguage.some((l) => /spanish/i.test(l)));
});
