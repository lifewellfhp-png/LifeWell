/**
 * Regression tests for the Marketing Contacts CSV import workflow (P4-I2E):
 * server/src/controllers/marketingContactsImport.controller.ts and
 * server/src/lib/marketingImportToken.ts.
 *
 * Follows the same established convention as test-marketing-contacts.mjs:
 * pure parsing/classification/token functions are unit-tested directly with
 * synthetic inputs (no live Supabase connection is used or needed), and
 * route-level auth checks mount the REAL adminRouter, relying on requests
 * failing before ever reaching Supabase.
 *
 * No live Supabase connection, no real Production credentials, no
 * marketing contact emails created, imported, or sent to any provider.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-marketing-contacts-import.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { parse } from 'csv-parse/sync';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from '../src/config/env.js';
import { assertMarketingStatusTransition } from '../src/validation/adminSchemas.js';
import { requirePermission } from '../src/middleware/adminAuth.js';
import {
  ALLOWED_CSV_COLUMNS,
  MAX_CSV_BYTES,
  MAX_CSV_ROWS,
  validateCsvHeaders,
  assertBlankColumnsEmpty,
  classifyCsvRow,
  markInFileDuplicates,
  applyExistingClassification,
  summarizeClassifications,
  neutralizeFormulaPrefix,
} from '../src/controllers/marketingContactsImport.controller.js';
import {
  signImportPreviewToken,
  verifyImportPreviewToken,
  PREVIEW_TOKEN_TTL_MINUTES,
} from '../src/lib/marketingImportToken.js';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, notFoundHandler } from '../src/middleware/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const routesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const importControllerSource = readFileSync(
  join(root, 'src/controllers/marketingContactsImport.controller.ts'),
  'utf8'
);
const tokenSource = readFileSync(join(root, 'src/lib/marketingImportToken.ts'), 'utf8');

function startRealAdminApp() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
    const server = app.listen(0, () => resolve(server));
  });
}

function sliceFn(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start > -1, `expected to find "${startMarker}"`);
  assert.ok(end > start, `expected to find "${endMarker}" after "${startMarker}"`);
  return source.slice(start, end);
}

const previewFnSource = sliceFn(
  importControllerSource,
  'export async function previewMarketingContactsImport',
  'export async function confirmMarketingContactsImport'
);
const confirmFnSource = importControllerSource.slice(
  importControllerSource.indexOf('export async function confirmMarketingContactsImport')
);

const row = (overrides = {}) => ({
  email: 'a@example.com',
  first_name: '',
  last_name: '',
  audience_type: '',
  marketing_status: '',
  consent_source: '',
  ...overrides,
});

const COLUMNS = { email: 0, first_name: 1, last_name: 2, audience_type: 3, marketing_status: 4, consent_source: 5 };
function cellsFrom(r) {
  return [r.email, r.first_name, r.last_name, r.audience_type, r.marketing_status, r.consent_source];
}

// --- 1/3. Auth required -------------------------------------------------

test('1. preview requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-contacts/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: 'email\na@example.com\n' }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

test('3. confirm requires Admin auth', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/marketing-contacts/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preview_token: 'x' }),
    });
    assert.equal(res.status, 401);
  } finally {
    server.close();
  }
});

// --- 2/4. Permission required --------------------------------------------

test('2/4. preview and confirm routes are wired with requireAdmin + requirePermission(marketing_contacts)', () => {
  const start = routesSource.indexOf('CSV import (P4-I2E)');
  // Bounded to just this block — the marketing-campaigns block (P4-I4B)
  // sits right after it and has its own dedicated route-count assertion in
  // test-marketing-campaigns.mjs.
  const end = routesSource.indexOf('Marketing campaign DRAFTS (P4-I4B)', start);
  const block = routesSource.slice(start, end);
  assert.match(block, /'\/marketing-contacts\/import\/preview'/);
  assert.match(block, /'\/marketing-contacts\/import\/confirm'/);
  const routeCount = (block.match(/'\/marketing-contacts\/import/g) || []).length;
  const permissionCount = (block.match(/requirePermission\('marketing_contacts'\)/g) || []).length;
  const requireAdminCount = (block.match(/requireAdmin,/g) || []).length;
  assert.equal(routeCount, 2);
  assert.equal(permissionCount, 2);
  assert.equal(requireAdminCount, 2);
});

test('2/4b. the real requirePermission(marketing_contacts) middleware rejects staff without the module and allows staff with it', () => {
  const guard = requirePermission('marketing_contacts');

  let error;
  guard({ admin: { role: 'staff', permissions: [] } }, {}, (err) => {
    error = err;
  });
  assert.ok(error, 'expected an error to be passed to next()');
  assert.equal(error.status, 403);

  let called = false;
  guard({ admin: { role: 'staff', permissions: ['marketing_contacts'] } }, {}, (err) => {
    called = err === undefined;
  });
  assert.equal(called, true);

  let superOk = false;
  guard({ admin: { role: 'super_admin', permissions: [] } }, {}, (err) => {
    superOk = err === undefined;
  });
  assert.equal(superOk, true);
});

// --- 5. Email required -----------------------------------------------------

test('5. a row with no email is invalid', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ email: '' })), COLUMNS);
  assert.equal(r.classification, 'invalid');
  assert.match(r.reason, /Missing email/);
});

// --- 6. Optional columns accepted -------------------------------------------

test('6. all six allowed columns (one required, five optional) are accepted together', () => {
  const { columnIndex } = validateCsvHeaders([
    'email',
    'first_name',
    'last_name',
    'audience_type',
    'marketing_status',
    'consent_source',
  ]);
  for (const col of ALLOWED_CSV_COLUMNS) {
    assert.ok(col in columnIndex, `expected "${col}" to be recognized`);
  }
});

test('email alone (no optional columns) is sufficient', () => {
  assert.doesNotThrow(() => validateCsvHeaders(['email']));
});

// --- 7-11. Unknown/rejected columns ------------------------------------------

test('7. an unrecognized column is rejected', () => {
  assert.throws(() => validateCsvHeaders(['email', 'favorite_color']), /Unrecognized column/);
});

test('8. a source column is rejected (server always sets source itself)', () => {
  assert.throws(() => validateCsvHeaders(['email', 'source']), /Unrecognized column/);
});

test('9. an email_normalized column is rejected (Postgres-generated, never application-writable)', () => {
  assert.throws(() => validateCsvHeaders(['email', 'email_normalized']), /Unrecognized column/);
});

test('10. clinical columns (diagnosis, medications) are rejected', () => {
  assert.throws(() => validateCsvHeaders(['email', 'diagnosis']), /Unrecognized column/);
  assert.throws(() => validateCsvHeaders(['email', 'medications']), /Unrecognized column/);
  assert.throws(() => validateCsvHeaders(['email', 'symptoms']), /Unrecognized column/);
});

test('11. a phone column is rejected', () => {
  assert.throws(() => validateCsvHeaders(['email', 'phone']), /Unrecognized column/);
});

test('id/consent_at/unsubscribed_at/suppressed_at/suppression_reason/created_at/updated_at/notes are all rejected', () => {
  for (const col of [
    'id',
    'consent_at',
    'unsubscribed_at',
    'suppressed_at',
    'suppression_reason',
    'created_at',
    'updated_at',
    'notes',
  ]) {
    assert.throws(() => validateCsvHeaders(['email', col]), /Unrecognized column/, `expected "${col}" to be rejected`);
  }
});

test('a completely blank trailing header is ignored only if every data row is also blank there, otherwise rejected', () => {
  const { blankIndexes } = validateCsvHeaders(['email', '']);
  assert.deepEqual(blankIndexes, [1]);
  assert.doesNotThrow(() => assertBlankColumnsEmpty([['a@example.com', '']], blankIndexes));
  assert.throws(
    () => assertBlankColumnsEmpty([['a@example.com', 'unexpected data']], blankIndexes),
    /has no header but contains data/
  );
});

// --- 12. Invalid email -------------------------------------------------------

test('12. an invalid email is rejected', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ email: 'not-an-email' })), COLUMNS);
  assert.equal(r.classification, 'invalid');
  assert.match(r.reason, /Invalid email/);
});

// --- 13/14/15. Defaults ------------------------------------------------------

test('13. missing marketing_status defaults to pending', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ marketing_status: '' })), COLUMNS);
  assert.equal(r.marketing_status, 'pending');
  assert.equal(r.classification, 'new');
});

test('14. missing audience_type defaults to other', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ audience_type: '' })), COLUMNS);
  assert.equal(r.audience_type, 'other');
});

test('15. existing_patient audience with no marketing_status becomes pending, never subscribed', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ audience_type: 'existing_patient', marketing_status: '' })), COLUMNS);
  assert.equal(r.audience_type, 'existing_patient');
  assert.equal(r.marketing_status, 'pending');
  assert.notEqual(r.marketing_status, 'subscribed');
});

// --- 16-19. Subscribed consent provenance -----------------------------------

test('16. subscribed without consent_source is invalid', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ marketing_status: 'subscribed', consent_source: '' })), COLUMNS);
  assert.equal(r.classification, 'invalid');
  assert.match(r.reason, /csv_import/);
});

test('17. subscribed with consent_source=manual is invalid for CSV import', () => {
  const r = classifyCsvRow(2, cellsFrom(row({ marketing_status: 'subscribed', consent_source: 'manual' })), COLUMNS);
  assert.equal(r.classification, 'invalid');
});

test('18. subscribed with consent_source=website_signup is invalid for CSV import', () => {
  const r = classifyCsvRow(
    2,
    cellsFrom(row({ marketing_status: 'subscribed', consent_source: 'website_signup' })),
    COLUMNS
  );
  assert.equal(r.classification, 'invalid');
});

test('19. subscribed with consent_source=csv_import is valid', () => {
  const r = classifyCsvRow(
    2,
    cellsFrom(row({ marketing_status: 'subscribed', consent_source: 'csv_import' })),
    COLUMNS
  );
  assert.equal(r.classification, 'new');
  assert.equal(r.marketing_status, 'subscribed');
  assert.equal(r.consent_source, 'csv_import');
});

test('a non-subscribed row never carries a consent_source, even if the CSV column has a value', () => {
  const r = classifyCsvRow(
    2,
    cellsFrom(row({ marketing_status: 'pending', consent_source: 'manual' })),
    COLUMNS
  );
  assert.equal(r.consent_source, null);
});

// --- 20. consent_at never fabricated -----------------------------------------

test('20. consent_at is never fabricated anywhere in the import path', () => {
  assert.doesNotMatch(importControllerSource, /consent_at/);
});

// --- 21/22. Duplicates -------------------------------------------------------

test('21. duplicate normalized emails within the file are detected (case/whitespace-insensitive)', () => {
  const rows = [
    classifyCsvRow(2, cellsFrom(row({ email: 'John@Example.com' })), COLUMNS),
    classifyCsvRow(3, cellsFrom(row({ email: ' john@example.com ' })), COLUMNS),
  ];
  markInFileDuplicates(rows);
  assert.equal(rows[0].classification, 'new');
  assert.equal(rows[1].classification, 'duplicate_in_file');
  assert.match(rows[1].reason, /Duplicate of row 2/);
});

test('22. conflicting duplicate rows are flagged invalid, never silently merged', () => {
  const rows = [
    classifyCsvRow(2, cellsFrom(row({ email: 'a@example.com', marketing_status: 'pending' })), COLUMNS),
    classifyCsvRow(
      3,
      cellsFrom(row({ email: 'a@example.com', marketing_status: 'subscribed', consent_source: 'csv_import' })),
      COLUMNS
    ),
  ];
  markInFileDuplicates(rows);
  assert.equal(rows[0].classification, 'invalid');
  assert.equal(rows[1].classification, 'invalid');
  assert.match(rows[0].reason, /Conflicting duplicate/);
  assert.match(rows[1].reason, /Conflicting duplicate/);
});

// --- 23-26. Existing contacts -------------------------------------------------

test('23. an existing pending contact is classified existing_pending (skipped)', () => {
  const rows = [classifyCsvRow(2, cellsFrom(row()), COLUMNS)];
  applyExistingClassification(rows, new Map([['a@example.com', 'pending']]));
  assert.equal(rows[0].classification, 'existing_pending');
});

test('24. an existing subscribed contact is classified existing_subscribed (skipped)', () => {
  const rows = [classifyCsvRow(2, cellsFrom(row()), COLUMNS)];
  applyExistingClassification(rows, new Map([['a@example.com', 'subscribed']]));
  assert.equal(rows[0].classification, 'existing_subscribed');
});

test('25. an existing unsubscribed contact is protected/skipped, never reactivated', () => {
  const rows = [classifyCsvRow(2, cellsFrom(row({ marketing_status: 'subscribed', consent_source: 'csv_import' })), COLUMNS)];
  applyExistingClassification(rows, new Map([['a@example.com', 'unsubscribed']]));
  assert.equal(rows[0].classification, 'existing_unsubscribed');
  assert.match(rows[0].reason, /cannot be reactivated/);
});

test('26. an existing suppressed contact is protected/skipped, never weakened', () => {
  const rows = [classifyCsvRow(2, cellsFrom(row()), COLUMNS)];
  applyExistingClassification(rows, new Map([['a@example.com', 'suppressed']]));
  assert.equal(rows[0].classification, 'existing_suppressed');
  assert.match(rows[0].reason, /cannot be reactivated/);
});

// --- 27-30. Insert-new-only model --------------------------------------------

test('27. confirm never calls .update() on marketing_contacts', () => {
  assert.doesNotMatch(confirmFnSource, /\.update\(/);
});

test('28. only rows still classified new (assembled into toInsert) are ever inserted', () => {
  assert.match(confirmFnSource, /toInsert/);
  assert.match(confirmFnSource, /\.insert\(/);
});

test('29. no upsert/onConflict overwrite logic exists anywhere in the import path', () => {
  assert.doesNotMatch(importControllerSource, /upsert:\s*true/);
  assert.doesNotMatch(importControllerSource, /\.upsert\(/);
  assert.doesNotMatch(importControllerSource, /onConflict/i);
});

test('30. preview performs zero database writes', () => {
  assert.doesNotMatch(previewFnSource, /\.insert\(/);
  assert.doesNotMatch(previewFnSource, /\.update\(/);
  assert.doesNotMatch(previewFnSource, /\.upsert\(/);
  assert.doesNotMatch(previewFnSource, /\.delete\(/);
});

// --- 31-34. Preview token integrity -------------------------------------------

test('31. confirm requires a valid preview token; garbage is rejected', () => {
  assert.throws(() => verifyImportPreviewToken('not-a-real-token'));
});

test('32. a tampered token (payload or signature altered) is rejected', () => {
  const token = signImportPreviewToken({ adminId: 'admin-1', rows: [] });
  const parts = token.split('.');
  // Flip a character in the signature segment.
  const lastChar = parts[2].slice(-1);
  const flipped = lastChar === 'A' ? 'B' : 'A';
  parts[2] = parts[2].slice(0, -1) + flipped;
  assert.throws(() => verifyImportPreviewToken(parts.join('.')));
});

test('33. an expired token is rejected', () => {
  const expired = jwt.sign(
    { type: 'marketing_contacts_import_preview', adminId: 'admin-1', rows: [] },
    env.ADMIN_JWT_SECRET,
    { algorithm: 'HS256', expiresIn: -10 }
  );
  assert.throws(() => verifyImportPreviewToken(expired), /jwt expired|expired/i);
});

test('34. the preview token has a short, bounded lifetime (10-30 minutes)', () => {
  assert.equal(PREVIEW_TOKEN_TTL_MINUTES, 20);
  assert.ok(PREVIEW_TOKEN_TTL_MINUTES >= 10 && PREVIEW_TOKEN_TTL_MINUTES <= 30);
});

test('a token signed for a different admin is structurally valid but carries that adminId (confirm rejects the mismatch)', () => {
  const token = signImportPreviewToken({ adminId: 'admin-1', rows: [] });
  const decoded = verifyImportPreviewToken(token);
  assert.equal(decoded.adminId, 'admin-1');
  assert.match(confirmFnSource, /decoded\.adminId !== actor\.sub/);
});

test('an admin session-style JWT (different claim shape) is not accepted as an import preview token', () => {
  const sessionLike = jwt.sign({ sub: 'admin-1', role: 'staff', permissions: [], tv: 0 }, env.ADMIN_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '30d',
  });
  assert.throws(() => verifyImportPreviewToken(sessionLike), /Not a marketing contacts import preview token/);
});

// --- 35/36. Confirm re-checks duplicates, never overwrites -------------------

test('35. confirm re-checks the database for duplicates before inserting (does not trust the token alone)', () => {
  assert.match(confirmFnSource, /fetchExistingStatuses/);
  assert.match(confirmFnSource, /existingNow/);
});

test('36. the duplicate re-check happens before insert, and a race duplicate is skipped, never overwritten', () => {
  const existingNowIndex = confirmFnSource.indexOf('existingNow');
  const firstInsertIndex = confirmFnSource.indexOf('.insert(');
  assert.ok(existingNowIndex > -1 && firstInsertIndex > existingNowIndex, 'expected the duplicate re-check before any insert');
  assert.match(confirmFnSource, /skipped_existing/);
});

// --- 37/38. Limits -------------------------------------------------------------

test('37. the file-size limit is 5 MB', () => {
  assert.equal(MAX_CSV_BYTES, 5 * 1024 * 1024);
});

test('38. the row-count limit is 5,000 data rows', () => {
  assert.equal(MAX_CSV_ROWS, 5000);
});

// --- 39/40. Real CSV parsing ---------------------------------------------------

test('39. quoted fields with embedded commas are parsed correctly', () => {
  const table = parse('email,last_name\na@example.com,"Smith, Jr."\n', {
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });
  assert.deepEqual(table[1], ['a@example.com', 'Smith, Jr.']);
});

test('39b. escaped quotes inside a quoted field are parsed correctly', () => {
  const table = parse('email,last_name\na@example.com,"O""Brien"\n', {
    bom: true,
    skip_empty_lines: true,
    trim: true,
  });
  assert.deepEqual(table[1], ['a@example.com', 'O"Brien']);
});

test('40. a leading UTF-8 BOM is stripped so the header is recognized cleanly', () => {
  const csvWithBom = '﻿email,first_name\na@example.com,Alex\n';
  const table = parse(csvWithBom, { bom: true, skip_empty_lines: true, trim: true });
  const { columnIndex } = validateCsvHeaders(table[0]);
  assert.equal(columnIndex.email, 0);
});

// --- 41. Formula-injection neutralization ---------------------------------------

test('41. dangerous leading characters are stripped from name fields, valid names and emails are untouched', () => {
  assert.equal(neutralizeFormulaPrefix('=SUM(A1:A9)'), 'SUM(A1:A9)');
  assert.equal(neutralizeFormulaPrefix('+1234567890'), '1234567890');
  assert.equal(neutralizeFormulaPrefix('-Anne'), 'Anne');
  assert.equal(neutralizeFormulaPrefix('@here'), 'here');
  assert.equal(neutralizeFormulaPrefix('Anne'), 'Anne');

  const r = classifyCsvRow(2, cellsFrom(row({ email: 'user+tag@example.com', first_name: '=cmd' })), COLUMNS);
  assert.equal(r.email, 'user+tag@example.com', 'email must never be formula-stripped');
  assert.equal(r.first_name, 'cmd');
});

// --- 42-44. Audit logging is aggregate-only -------------------------------------

test('42. the preview audit log records only aggregate counts', () => {
  assert.match(previewFnSource, /action:\s*'import_preview'/);
  assert.match(previewFnSource, /meta:\s*\{\s*\.\.\.summary\s*\}/);
});

test('43. the confirm audit log records only aggregate counts', () => {
  assert.match(confirmFnSource, /action:\s*'import_confirm'/);
  assert.match(confirmFnSource, /meta:\s*\{\s*\.\.\.summary\s*\}/);
});

test('44. neither audit call includes a raw email list, preview token, or authorization header', () => {
  for (const src of [previewFnSource, confirmFnSource]) {
    const auditStart = src.indexOf('writeAuditLog({');
    const auditEnd = src.indexOf('});', auditStart);
    const auditCall = src.slice(auditStart, auditEnd);
    assert.doesNotMatch(auditCall, /\.email\b/);
    assert.doesNotMatch(auditCall, /rows\.map/);
    assert.doesNotMatch(auditCall, /preview_token/);
    assert.doesNotMatch(auditCall, /authorization/i);
  }
});

// --- 45/46. No email-provider or patient-system calls ----------------------------

test('45. no email-provider integration exists anywhere in the import path', () => {
  for (const term of ['paubox', 'mailchimp', 'convertkit', 'newsletter.service', 'email.service']) {
    for (const src of [importControllerSource, tokenSource]) {
      assert.doesNotMatch(src, new RegExp(term, 'i'), `unexpected email-provider reference "${term}"`);
    }
  }
});

test('46. no patient-system integration exists anywhere in the import path', () => {
  for (const term of ['charm', 'medicalmine']) {
    for (const src of [importControllerSource, tokenSource]) {
      assert.doesNotMatch(src, new RegExp(term, 'i'), `unexpected patient-system reference "${term}"`);
    }
  }
});

// --- 47. No DELETE behavior ------------------------------------------------------

test('47. no DELETE route or delete behavior was introduced', () => {
  assert.doesNotMatch(routesSource, /adminRouter\.delete\(\s*'\/marketing-contacts/);
  assert.doesNotMatch(importControllerSource, /\.delete\(/);
});

// --- 48. Existing P4-I2C protections remain intact --------------------------------

test('48. the existing P4-I2C status-transition protections are unchanged', () => {
  assert.throws(() => assertMarketingStatusTransition('unsubscribed', 'subscribed'));
  assert.throws(() => assertMarketingStatusTransition('suppressed', 'subscribed'));
  assert.throws(() => assertMarketingStatusTransition('suppressed', 'unsubscribed'));
  assert.doesNotThrow(() => assertMarketingStatusTransition('pending', 'subscribed'));
});

// --- Summary aggregation (supports the preview response contract) ----------------

test('summarizeClassifications buckets existing vs protected as specified', () => {
  const rows = [
    { classification: 'new' },
    { classification: 'existing_pending' },
    { classification: 'existing_subscribed' },
    { classification: 'existing_unsubscribed' },
    { classification: 'existing_suppressed' },
    { classification: 'duplicate_in_file' },
    { classification: 'invalid' },
  ];
  const summary = summarizeClassifications(rows);
  assert.deepEqual(summary, {
    total_rows: 7,
    valid_new: 1,
    existing: 2,
    protected: 2,
    duplicate_in_file: 1,
    invalid: 1,
  });
});
