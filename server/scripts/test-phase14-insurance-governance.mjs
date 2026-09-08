/**
 * Phase 14 (Insurance Admin Governance Hardening) regression tests.
 *
 * The exact incidents this guards against, all observed in Production
 * without any of these protections: PhaseA1Sync created 7 duplicate payer
 * rows because nothing prevented a second row with a differently-formatted
 * name; an unrelated PATCH carried a stray leading tab straight into
 * Oxford's logo_url because nothing trimmed or validated it; and there was
 * no server-side concept of "approved payer" at all — any authenticated
 * PATCH could flip published:true on any row regardless of name, and
 * insuranceCreate's `published` defaults to true, so a bare create
 * published immediately.
 *
 * Follows this codebase's established convention (see
 * test-faq-governance.mjs / test-phase12-governance.mjs): pure exported
 * functions are tested directly; anything that only makes sense wired to a
 * live Supabase call is verified via source-level assertions against the
 * real shipped files.
 *
 * No live Supabase connection, no Production credentials, no Production
 * data read or written.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-phase14-insurance-governance.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { normalizeInsuranceName, normalizeAndValidateLogoUrl } from '../src/routes/admin.routes.js';
import { insuranceCreate, insuranceUpdate } from '../src/validation/adminSchemas.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const adminRoutesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const insuranceAdminPageSource = readFileSync(
  join(root, '../admin/src/app/(app)/insurance/page.tsx'),
  'utf8'
);

// --- normalizeInsuranceName: same contract as normalizeFaqQuestion ---

test('normalizeInsuranceName: identical strings normalize identically', () => {
  assert.equal(normalizeInsuranceName('Aetna (Commercial)'), normalizeInsuranceName('Aetna (Commercial)'));
});

test('normalizeInsuranceName: case differences collide (Oxford / oxford / OXFORD)', () => {
  const a = normalizeInsuranceName('Oxford');
  assert.equal(normalizeInsuranceName('oxford'), a);
  assert.equal(normalizeInsuranceName('OXFORD'), a);
});

test('normalizeInsuranceName: leading/trailing whitespace collides (" Oxford", "Oxford  ")', () => {
  const a = normalizeInsuranceName('Oxford');
  assert.equal(normalizeInsuranceName(' Oxford'), a);
  assert.equal(normalizeInsuranceName('Oxford  '), a);
});

test('normalizeInsuranceName: internal whitespace runs collapse (the "AVMED " / "Veterans ACCNR 3" truncation shape)', () => {
  assert.equal(normalizeInsuranceName('Cigna   (Commercial)'), normalizeInsuranceName('Cigna (Commercial)'));
});

test('normalizeInsuranceName: genuinely different payer names stay different', () => {
  assert.notEqual(normalizeInsuranceName('Aetna (Commercial)'), normalizeInsuranceName('Cigna (Commercial)'));
});

// --- APPROVED_INSURANCE_NAMES: drift detection against admin's source of truth ---

function extractAdminApprovedInsurance() {
  const match = insuranceAdminPageSource.match(/const approvedInsurance = \[([\s\S]*?)\] as const;/);
  assert.ok(match, 'expected to find approvedInsurance in the admin insurance page');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

function extractServerApprovedInsurance() {
  const match = adminRoutesSource.match(/const APPROVED_INSURANCE_NAMES = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(match, 'expected to find APPROVED_INSURANCE_NAMES in server/src/routes/admin.routes.ts');
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((m) => m[1]);
}

test('server APPROVED_INSURANCE_NAMES exactly matches admin approvedInsurance (no drift between the two apps)', () => {
  assert.deepEqual(extractServerApprovedInsurance(), extractAdminApprovedInsurance());
});

test('server approved set contains exactly 14 unique names', () => {
  const names = extractServerApprovedInsurance();
  assert.equal(names.length, 14);
  assert.equal(new Set(names).size, 14);
});

test('Curative is approved', () => {
  assert.ok(extractServerApprovedInsurance().includes('Curative'));
});

test('BH Complete Commercial, FL DSNP, and Magellan (Health) are absent from the approved set', () => {
  const names = extractServerApprovedInsurance();
  assert.ok(!names.includes('BH Complete Commercial'));
  assert.ok(!names.includes('FL DSNP'));
  assert.ok(!names.some((n) => /magellan/i.test(n)));
});

// --- normalizeAndValidateLogoUrl ---

test('logo URL: surrounding whitespace (the Oxford incident) is trimmed, not rejected', () => {
  assert.equal(
    normalizeAndValidateLogoUrl('\t/images/insurance/badges/oxford-commercial.svg'),
    '/images/insurance/badges/oxford-commercial.svg'
  );
  assert.equal(
    normalizeAndValidateLogoUrl('  /images/insurance/badges/curative.svg  '),
    '/images/insurance/badges/curative.svg'
  );
});

test('logo URL: a valid local /images/insurance/... path is accepted unchanged', () => {
  assert.equal(
    normalizeAndValidateLogoUrl('/images/insurance/badges/aetna-commercial.svg'),
    '/images/insurance/badges/aetna-commercial.svg'
  );
});

test('logo URL: a valid https URL is accepted when local paths are not used', () => {
  assert.equal(normalizeAndValidateLogoUrl('https://cdn.example.com/logo.svg'), 'https://cdn.example.com/logo.svg');
  assert.equal(normalizeAndValidateLogoUrl('http://cdn.example.com/logo.svg'), 'http://cdn.example.com/logo.svg');
});

test('logo URL: a local path outside /images/insurance/ is rejected', () => {
  assert.throws(() => normalizeAndValidateLogoUrl('/images/other/logo.svg'));
  assert.throws(() => normalizeAndValidateLogoUrl('/etc/passwd'));
});

test('logo URL: path traversal is rejected even under the safe prefix', () => {
  assert.throws(() => normalizeAndValidateLogoUrl('/images/insurance/../../../etc/passwd'));
  assert.throws(() => normalizeAndValidateLogoUrl('/images/insurance/badges/..\\..\\secrets.env'));
  assert.throws(() => normalizeAndValidateLogoUrl('/images/insurance/%2e%2e/escape.svg'));
});

test('logo URL: javascript: is rejected', () => {
  assert.throws(() => normalizeAndValidateLogoUrl('javascript:alert(1)'));
});

test('logo URL: data: is rejected', () => {
  assert.throws(() => normalizeAndValidateLogoUrl('data:text/html,<script>alert(1)</script>'));
});

test('logo URL: control characters are rejected', () => {
  assert.throws(() => normalizeAndValidateLogoUrl('/images/insurance/badges/aetna\x00.svg'));
});

test('logo URL: an unrecognized scheme/value is rejected, not silently rewritten into something else', () => {
  assert.throws(() => normalizeAndValidateLogoUrl('not-a-real-url-or-path'));
  assert.throws(() => normalizeAndValidateLogoUrl('ftp://example.com/logo.svg'));
});

test('logo URL: an empty string is left as-is (schema-level optional/nullable governs whether that is allowed at all)', () => {
  assert.equal(normalizeAndValidateLogoUrl('   '), '');
});

// --- source-level wiring: uniqueness + approved-payer publication checks ---

const insuranceRouteMatch = adminRoutesSource.match(/adminRouter\.use\(\s*'\/insurance'[\s\S]*?\n\);/);

test('the /insurance route registration exists with beforeCreate/beforeUpdate + validateCreate/validateUpdate wired', () => {
  assert.ok(insuranceRouteMatch, 'expected to locate the /insurance createCrudRouter registration');
  const block = insuranceRouteMatch[0];
  assert.match(block, /beforeCreate:\s*normalizeInsuranceLogoUrl/);
  assert.match(block, /beforeUpdate:\s*normalizeInsuranceLogoUrl/);
  assert.match(block, /validateCreate:\s*async \(data\)/);
  assert.match(block, /validateUpdate:\s*async \(data, id\)/);
});

test('insurance name uniqueness check only runs when `name` is actually part of the payload', () => {
  assert.ok(insuranceRouteMatch);
  assert.match(insuranceRouteMatch[0], /if \(typeof data\.name === 'string'\) await assertUniqueInsuranceName\(data\.name\);/);
  assert.match(insuranceRouteMatch[0], /if \(typeof data\.name === 'string'\) await assertUniqueInsuranceName\(data\.name, id\);/);
});

test('assertUniqueInsuranceName excludes the row being edited (excludeId) from collision matches', () => {
  assert.match(adminRoutesSource, /row\.id !== excludeId/);
});

test('duplicate-payer-name error is a friendly 409 with no raw DB/SQL/table/id details exposed', () => {
  const match = adminRoutesSource.match(/throw new AppError\((['"`])(An insurance payer[^'"`]*)\1,\s*409/);
  assert.ok(match, 'expected a 409 AppError for the duplicate insurance-name case');
  const message = match[2];
  assert.doesNotMatch(message, /supabase/i);
  assert.doesNotMatch(message, /\bsql\b/i);
  assert.doesNotMatch(message, /\btable\b/i);
  assert.doesNotMatch(message, /\bid\b/);
  assert.match(adminRoutesSource, /throw new AppError\(\s*'An insurance payer with this name already exists\.',\s*409,\s*\{\s*expose:\s*true\s*\}/);
});

test('assertApprovedForPublication only blocks when published is true — unpublishing is never blocked', () => {
  assert.match(adminRoutesSource, /async function assertApprovedForPublication[\s\S]{0,120}if \(!published\) return;/);
});

test('assertApprovedForPublication rejects with an owner-friendly, non-500 error naming the payer', () => {
  assert.match(
    adminRoutesSource,
    /is not on LifeWell's approved insurance payer list and cannot be published/
  );
});

test('assertInsurancePublicationAllowed only does extra work when `name` or `published` is actually present in the payload', () => {
  assert.match(adminRoutesSource, /if \(!nameProvided && !publishedProvided\) return;/);
});

// --- schema-level defaults this governance layer has to account for ---

test('insuranceCreate defaults `published` to true — confirms create-time publication checks cannot skip an omitted field', () => {
  const parsed = insuranceCreate.safeParse({ name: 'Some New Payer' });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.published, true);
});

test('insuranceUpdate (a partial of insuranceCreate) leaves `published`/`name` genuinely absent when omitted, not defaulted', () => {
  const parsed = insuranceUpdate.safeParse({ notes: 'internal note only' });
  assert.equal(parsed.success, true);
  assert.equal('published' in parsed.data, false);
  assert.equal('name' in parsed.data, false);
});

// --- no database migration introduced for this phase ---

test('no new SQL migration/DDL for insurance_plans uniqueness/approval was introduced (Phase 14 is application-level only)', () => {
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
  assert.doesNotMatch(opsSql, /ADD CONSTRAINT[^;]*insurance_plans/i);
  assert.doesNotMatch(schemaSql, /ADD CONSTRAINT[^;]*insurance_plans/i);
  assert.doesNotMatch(opsSql, /CREATE (UNIQUE )?INDEX[^;]*insurance_plans/i);
});
