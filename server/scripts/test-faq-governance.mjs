/**
 * Phase 11 (FAQ Admin Governance Hardening) regression tests.
 *
 * Follows this codebase's established convention (see
 * test-admin-revocation-hardening.mjs): pure exported functions are tested
 * directly; anything that only makes sense wired to a live Supabase call
 * (assertUniqueFaqQuestion's actual DB round-trip, the crudFactory
 * request/response cycle) is verified via source-level assertions against
 * the real shipped files instead of a reimplementation or a live DB.
 *
 * No live Supabase connection, no Production credentials, no Production
 * data read or written.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-faq-governance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeFaqQuestion } from '../src/routes/admin.routes.js';
import { FAQ_CATEGORIES, faqCreate, faqUpdate } from '../src/validation/adminSchemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const adminRoutesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const crudFactorySource = readFileSync(join(root, 'src/routes/crudFactory.ts'), 'utf8');
const schemaSource = readFileSync(join(root, 'src/validation/adminSchemas.ts'), 'utf8');

// --- normalizeFaqQuestion: the exact matching contract duplicate
// prevention relies on (exact / case-insensitive / whitespace-normalized) ---

test('normalizeFaqQuestion: identical strings normalize identically', () => {
  assert.equal(normalizeFaqQuestion('Do you offer a sliding scale option?'), normalizeFaqQuestion('Do you offer a sliding scale option?'));
});

test('normalizeFaqQuestion: case differences are ignored', () => {
  assert.equal(
    normalizeFaqQuestion('Do You Offer A Sliding Scale Option?'),
    normalizeFaqQuestion('do you offer a sliding scale option?')
  );
});

test('normalizeFaqQuestion: leading/trailing whitespace is ignored', () => {
  assert.equal(
    normalizeFaqQuestion('  What insurance plans do you accept?  '),
    normalizeFaqQuestion('What insurance plans do you accept?')
  );
});

test('normalizeFaqQuestion: internal whitespace runs collapse to a single space', () => {
  assert.equal(
    normalizeFaqQuestion('What insurance   plans do you  accept?'),
    normalizeFaqQuestion('What insurance plans do you accept?')
  );
});

test('normalizeFaqQuestion: tabs/newlines count as whitespace too', () => {
  assert.equal(normalizeFaqQuestion('What is\tyour\ncancellation policy?'), normalizeFaqQuestion('What is your cancellation policy?'));
});

test('normalizeFaqQuestion: genuinely different questions stay different (no fuzzy/semantic matching)', () => {
  assert.notEqual(normalizeFaqQuestion('How much will my copay be?'), normalizeFaqQuestion('What determines my copay?'));
});

// --- FAQ_CATEGORIES: the current real category set, not invented values ---

test('FAQ_CATEGORIES matches the current real Production category inventory', () => {
  assert.deepEqual([...FAQ_CATEGORIES], ['General', 'Fees', 'Appointments']);
});

test('faqCreate schema rejects an arbitrary/misspelled category', () => {
  const result = faqCreate.safeParse({
    question: 'Test question?',
    answer: 'Test answer.',
    category: 'Feez', // the exact class of typo the Production incident hinged on
  });
  assert.equal(result.success, false);
});

test('faqCreate schema accepts each real category value', () => {
  for (const category of FAQ_CATEGORIES) {
    const result = faqCreate.safeParse({ question: 'Q?', answer: 'A.', category });
    assert.equal(result.success, true, `expected ${category} to be accepted`);
  }
});

test('faqCreate schema still accepts a null category (backward-compat with any historical null-category row)', () => {
  const result = faqCreate.safeParse({ question: 'Q?', answer: 'A.', category: null });
  assert.equal(result.success, true);
});

test('faqUpdate is a partial of faqCreate — a category-only PATCH is valid with no question/answer present', () => {
  const result = faqUpdate.safeParse({ category: 'Fees' });
  assert.equal(result.success, true);
});

// --- source-level wiring assertions: duplicate-question prevention ---

test('assertUniqueFaqQuestion excludes the row being edited (excludeId) from collision matches', () => {
  assert.match(adminRoutesSource, /row\.id !== excludeId/);
});

test('assertUniqueFaqQuestion compares questions via normalizeFaqQuestion on both sides', () => {
  assert.match(
    adminRoutesSource,
    /normalizeFaqQuestion\(String\(row\.question[^)]*\)\)\s*===\s*normalized/
  );
});

test('duplicate-question error is owner-friendly with no raw DB/SQL/table details exposed', () => {
  const match = adminRoutesSource.match(/throw new AppError\((['"`])([^'"`]*)\1,\s*409/);
  assert.ok(match, 'expected a 409 AppError for the duplicate case');
  const message = match[2];
  assert.doesNotMatch(message, /supabase/i);
  assert.doesNotMatch(message, /\bsql\b/i);
  assert.doesNotMatch(message, /\btable\b/i);
  assert.doesNotMatch(message, /\bid\b/);
});

test('the duplicate-question AppError is set to expose:true so the owner-friendly message reaches the Admin UI', () => {
  assert.match(adminRoutesSource, /throw new AppError\([^)]*expose:\s*true/);
});

const faqsRouteMatch = adminRoutesSource.match(/adminRouter\.use\(\s*'\/faqs'[\s\S]*?\n\)\s*;/);

test('validateCreate/validateUpdate for /faqs only run the uniqueness check when `question` is actually part of the payload', () => {
  assert.ok(faqsRouteMatch, 'expected to locate the /faqs createCrudRouter registration');
  const block = faqsRouteMatch[0];
  assert.match(block, /validateCreate:\s*async \(data\) => \{\s*if \(typeof data\.question === 'string'\)/);
  assert.match(block, /validateUpdate:\s*async \(data, id\) => \{\s*if \(typeof data\.question === 'string'\)/);
});

test('the /faqs route passes the row id through to validateUpdate so edit-exclusion works', () => {
  assert.ok(faqsRouteMatch, 'expected to locate the /faqs createCrudRouter registration');
  assert.match(faqsRouteMatch[0], /assertUniqueFaqQuestion\(data\.question,\s*id\)/);
});

// --- source-level wiring assertions: crudFactory hook mechanism stays additive/opt-in ---

test('validateCreate/validateUpdate are optional on CrudOptions (undefined by default for every other resource)', () => {
  assert.match(crudFactorySource, /validateCreate\?:\s*\(data: Record<string, unknown>\) => Promise<void>;/);
  assert.match(crudFactorySource, /validateUpdate\?:\s*\(data: Record<string, unknown>, id: string \| undefined\) => Promise<void>;/);
});

test('validateCreate runs before beforeCreate/insert, so a rejected FAQ never reaches the database', () => {
  const postIdx = crudFactorySource.indexOf("router.post(");
  const validateIdx = crudFactorySource.indexOf('if (validateCreate) await validateCreate(payload);', postIdx);
  const insertIdx = crudFactorySource.indexOf('.insert(payload)', postIdx);
  assert.ok(validateIdx > postIdx && insertIdx > validateIdx, 'expected validateCreate to run strictly before insert');
});

test('validateUpdate runs before the update payload is written to the database', () => {
  const patchIdx = crudFactorySource.indexOf("router.patch(");
  const validateIdx = crudFactorySource.indexOf('if (validateUpdate) await validateUpdate(', patchIdx);
  const updateIdx = crudFactorySource.indexOf('.update(payload)', patchIdx);
  assert.ok(validateIdx > patchIdx && updateIdx > validateIdx, 'expected validateUpdate to run strictly before update');
});

test('no other createCrudRouter call site passes validateCreate/validateUpdate — the hook is opt-in, not a behavior change for other resources', () => {
  const createCount = (adminRoutesSource.match(/validateCreate:/g) || []).length;
  const updateCount = (adminRoutesSource.match(/validateUpdate:/g) || []).length;
  assert.equal(createCount, 1, 'expected exactly one validateCreate: usage (the /faqs route)');
  assert.equal(updateCount, 1, 'expected exactly one validateUpdate: usage (the /faqs route)');
});

// --- no database migration introduced for this phase ---

test('no new SQL migration/DDL for faqs.category was introduced (Phase 11 is application-level only)', () => {
  let opsSql = '';
  let schemaSql = '';
  try {
    opsSql = readFileSync(join(root, 'supabase/ops.sql'), 'utf8');
  } catch {
    // file may not exist in every checkout state; absence is fine here
  }
  try {
    schemaSql = readFileSync(join(root, 'supabase/schema.sql'), 'utf8');
  } catch {
    // same
  }
  assert.doesNotMatch(opsSql, /ADD CONSTRAINT[^;]*faqs[^;]*category/i);
  assert.doesNotMatch(schemaSql, /ADD CONSTRAINT[^;]*faqs[^;]*category/i);
  assert.doesNotMatch(opsSql, /CHECK[^;]*category[^;]*IN\s*\(/i);
});

test('faqCreate/faqUpdate category enum enforcement lives only in adminSchemas.ts (application-level, not a DB constraint)', () => {
  assert.match(schemaSource, /export const FAQ_CATEGORIES = \['General', 'Fees', 'Appointments'\] as const;/);
});
