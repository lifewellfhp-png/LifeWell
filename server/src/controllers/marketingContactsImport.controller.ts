import type { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { getSupabase } from '../lib/supabase.js';
import { AppError, badRequest } from '../utils/errors.js';
import { writeAuditLog } from '../lib/audit.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';
import {
  MARKETING_AUDIENCE_TYPES,
  MARKETING_STATUSES,
  marketingContactEmail,
  marketingContactsImportPreviewSchema,
  marketingContactsImportConfirmSchema,
  type MarketingAudienceType,
  type MarketingSource,
  type MarketingStatus,
} from '../validation/adminSchemas.js';
import {
  signImportPreviewToken,
  verifyImportPreviewToken,
  PREVIEW_TOKEN_TTL_MINUTES,
} from '../lib/marketingImportToken.js';

// ---------------------------------------------------------------------------
// CSV contract (P4-I2E). A deliberately small, allow-listed set of columns —
// unrecognized headers reject the whole file rather than being silently
// dropped or imported. `source`, `email_normalized`, `id`, the two record
// timestamps, the two status timestamps, the consent timestamp, and
// `suppression_reason` are never accepted from a CSV: `source` is always
// forced to 'csv_import' by the server (see confirm), and the rest are
// either Postgres-generated or represent state this workflow has no
// truthful way to assert — none of those column names are ever written by
// this file (see test 20 in test-marketing-contacts-import.mjs).
// ---------------------------------------------------------------------------
export const ALLOWED_CSV_COLUMNS = [
  'email',
  'first_name',
  'last_name',
  'audience_type',
  'marketing_status',
  'consent_source',
] as const;

export const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CSV_ROWS = 5000; // data rows, excluding the header row
export const CONFIRM_INSERT_BATCH_SIZE = 50;

export type CsvClassification =
  | 'new'
  | 'existing_pending'
  | 'existing_subscribed'
  | 'existing_unsubscribed'
  | 'existing_suppressed'
  | 'duplicate_in_file'
  | 'invalid';

export type ClassifiedRow = {
  row_number: number;
  email: string;
  email_normalized: string;
  first_name: string | null;
  last_name: string | null;
  audience_type: MarketingAudienceType;
  marketing_status: MarketingStatus;
  consent_source: MarketingSource | null;
  classification: CsvClassification;
  reason: string | null;
};

export type HeaderValidation = { columnIndex: Record<string, number>; blankIndexes: number[] };

/**
 * Validates the header row against the allow-list. A header whose trimmed
 * value is empty is not rejected outright — it is recorded as a candidate
 * "blank trailing column" (common when a spreadsheet export carries extra
 * empty columns from a wider sheet); assertBlankColumnsEmpty() below only
 * allows it through if every data row is also blank in that position.
 */
export function validateCsvHeaders(rawHeaders: string[]): HeaderValidation {
  const columnIndex: Record<string, number> = {};
  const blankIndexes: number[] = [];
  const seen = new Set<string>();

  rawHeaders.forEach((raw, index) => {
    const header = raw.trim();
    if (header === '') {
      blankIndexes.push(index);
      return;
    }
    const key = header.toLowerCase();
    if (!(ALLOWED_CSV_COLUMNS as readonly string[]).includes(key)) {
      throw new Error(
        `Unrecognized column "${header}". Allowed columns: ${ALLOWED_CSV_COLUMNS.join(', ')}.`
      );
    }
    if (seen.has(key)) {
      throw new Error(`Duplicate column "${header}".`);
    }
    seen.add(key);
    columnIndex[key] = index;
  });

  if (columnIndex.email === undefined) {
    throw new Error("CSV is missing the required 'email' column.");
  }
  return { columnIndex, blankIndexes };
}

/** Rejects the file if a header-less column actually carries data anywhere — see validateCsvHeaders(). */
export function assertBlankColumnsEmpty(rows: string[][], blankIndexes: number[]): void {
  if (blankIndexes.length === 0) return;
  for (const row of rows) {
    for (const idx of blankIndexes) {
      const value = (row[idx] ?? '').trim();
      if (value !== '') {
        throw new Error(
          `Column ${idx + 1} has no header but contains data. Please name every column that contains data.`
        );
      }
    }
  }
}

/**
 * Defends against spreadsheet formula injection (P4-I2E) in human-name
 * fields: repeatedly strips a leading `=`, `+`, `-`, or `@` (after
 * whitespace) rather than rejecting the row outright — a stray leading
 * symbol is far more likely a spreadsheet artifact than an intentional
 * name, and stripping (vs. prefixing with a quote) avoids leaving a visible
 * artifact in the stored value. Bounded to 10 iterations against
 * pathological input. Never applied to the email field — email is validated
 * by format instead, so a legitimately-symbol-containing address is never
 * touched.
 */
export function neutralizeFormulaPrefix(value: string): string {
  let v = value.trim();
  let iterations = 0;
  while (iterations < 10 && v.length > 0 && /^[=+\-@]/.test(v)) {
    v = v.slice(1).trim();
    iterations += 1;
  }
  return v;
}

function invalidRow(rowNumber: number, emailRaw: string, reason: string): ClassifiedRow {
  return {
    row_number: rowNumber,
    email: emailRaw,
    email_normalized: emailRaw.trim().toLowerCase(),
    first_name: null,
    last_name: null,
    audience_type: 'other',
    marketing_status: 'pending',
    consent_source: null,
    classification: 'invalid',
    reason,
  };
}

/**
 * Validates and normalizes a single CSV data row in isolation (no DB, no
 * knowledge of other rows). Classification always starts as 'new' for a
 * structurally valid row — markInFileDuplicates() and
 * applyExistingClassification() refine it afterward.
 *
 * Consent provenance rule (P4-I2E): a subscribed row's consent_source must
 * be exactly 'csv_import', since this workflow can only truthfully
 * establish CSV provenance — anything else (blank, manual, website_signup,
 * other, or an invalid value) makes the row invalid rather than silently
 * downgraded to pending. For every non-subscribed row, consent_source is
 * always stored as null regardless of what the CSV column contains — it is
 * only ever meaningful paired with a subscribed status.
 */
export function classifyCsvRow(rowNumber: number, cells: string[], columnIndex: Record<string, number>): ClassifiedRow {
  const get = (name: string): string => {
    const idx = columnIndex[name];
    if (idx === undefined) return '';
    return (cells[idx] ?? '').trim();
  };

  const emailRaw = get('email');
  if (!emailRaw) return invalidRow(rowNumber, emailRaw, 'Missing email.');

  const emailCheck = marketingContactEmail.safeParse(emailRaw);
  if (!emailCheck.success) return invalidRow(rowNumber, emailRaw, 'Invalid email address.');
  const email = emailCheck.data;
  const emailNormalized = email.toLowerCase();

  const firstName = neutralizeFormulaPrefix(get('first_name'));
  const lastName = neutralizeFormulaPrefix(get('last_name'));
  if (firstName.length > 120) return invalidRow(rowNumber, emailRaw, 'First name exceeds 120 characters.');
  if (lastName.length > 120) return invalidRow(rowNumber, emailRaw, 'Last name exceeds 120 characters.');

  const audienceRaw = get('audience_type');
  const audience_type = audienceRaw === '' ? 'other' : audienceRaw;
  if (!(MARKETING_AUDIENCE_TYPES as readonly string[]).includes(audience_type)) {
    return invalidRow(rowNumber, emailRaw, `Invalid audience_type: "${audienceRaw}".`);
  }

  const statusRaw = get('marketing_status');
  const marketing_status = statusRaw === '' ? 'pending' : statusRaw;
  if (!(MARKETING_STATUSES as readonly string[]).includes(marketing_status)) {
    return invalidRow(rowNumber, emailRaw, `Invalid marketing_status: "${statusRaw}".`);
  }

  let consent_source: MarketingSource | null = null;
  if (marketing_status === 'subscribed') {
    const consentRaw = get('consent_source');
    if (consentRaw !== 'csv_import') {
      return invalidRow(rowNumber, emailRaw, 'Subscribed rows must have consent_source = csv_import.');
    }
    consent_source = 'csv_import';
  }

  return {
    row_number: rowNumber,
    email,
    email_normalized: emailNormalized,
    first_name: firstName || null,
    last_name: lastName || null,
    audience_type: audience_type as MarketingAudienceType,
    marketing_status: marketing_status as MarketingStatus,
    consent_source,
    classification: 'new',
    reason: null,
  };
}

/**
 * Mutates rows in place: among rows still classified 'new', groups by
 * normalized email. A group of >1 identical rows keeps its first occurrence
 * as canonical and marks every later occurrence 'duplicate_in_file'. A
 * group whose rows disagree on any field is never guessed at — every row in
 * that group (including the first) becomes 'invalid', per the instruction
 * not to silently pick a consent/status state among conflicting claims.
 */
export function markInFileDuplicates(rows: ClassifiedRow[]): void {
  const groups = new Map<string, ClassifiedRow[]>();
  for (const row of rows) {
    if (row.classification !== 'new') continue;
    const list = groups.get(row.email_normalized);
    if (list) list.push(row);
    else groups.set(row.email_normalized, [row]);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0]!;
    const rest = group.slice(1);
    const identical = rest.every(
      (r) =>
        r.first_name === first.first_name &&
        r.last_name === first.last_name &&
        r.audience_type === first.audience_type &&
        r.marketing_status === first.marketing_status &&
        r.consent_source === first.consent_source
    );
    if (identical) {
      for (const dup of rest) {
        dup.classification = 'duplicate_in_file';
        dup.reason = `Duplicate of row ${first.row_number} (identical data) — not imported.`;
      }
    } else {
      for (const conflicted of group) {
        conflicted.classification = 'invalid';
        conflicted.reason = 'Conflicting duplicate rows for this email in the uploaded file — none imported.';
      }
    }
  }
}

/**
 * Mutates rows in place: for every row still classified 'new', looks up
 * whether that normalized email already exists in the directory (via the
 * pre-fetched map, so this function itself makes no DB call and stays
 * synchronously testable) and reclassifies accordingly. Rows with no match
 * remain 'new'.
 */
export function applyExistingClassification(
  rows: ClassifiedRow[],
  existingStatusByEmail: Map<string, MarketingStatus>
): void {
  for (const row of rows) {
    if (row.classification !== 'new') continue;
    const existingStatus = existingStatusByEmail.get(row.email_normalized);
    if (!existingStatus) continue;
    row.classification = `existing_${existingStatus}` as CsvClassification;
    if (existingStatus === 'unsubscribed') {
      row.reason = 'Existing contact is unsubscribed and cannot be reactivated by CSV import.';
    } else if (existingStatus === 'suppressed') {
      row.reason = 'Existing contact is suppressed and cannot be reactivated by CSV import.';
    } else {
      row.reason = 'Existing contact already in the directory — not modified by import.';
    }
  }
}

export type ImportSummary = {
  total_rows: number;
  valid_new: number;
  existing: number;
  protected: number;
  duplicate_in_file: number;
  invalid: number;
};

/** `existing` = existing_pending + existing_subscribed; `protected` = existing_unsubscribed + existing_suppressed (the sticky, non-reactivatable subset). */
export function summarizeClassifications(rows: ClassifiedRow[]): ImportSummary {
  const summary: ImportSummary = {
    total_rows: rows.length,
    valid_new: 0,
    existing: 0,
    protected: 0,
    duplicate_in_file: 0,
    invalid: 0,
  };
  for (const row of rows) {
    switch (row.classification) {
      case 'new':
        summary.valid_new += 1;
        break;
      case 'existing_pending':
      case 'existing_subscribed':
        summary.existing += 1;
        break;
      case 'existing_unsubscribed':
      case 'existing_suppressed':
        summary.protected += 1;
        break;
      case 'duplicate_in_file':
        summary.duplicate_in_file += 1;
        break;
      case 'invalid':
        summary.invalid += 1;
        break;
    }
  }
  return summary;
}

const DB_LOOKUP_CHUNK = 500;

/** Looks up current marketing_status for a batch of normalized emails, chunked to keep any single Supabase `.in()` query bounded. */
async function fetchExistingStatuses(emailsNormalized: string[]): Promise<Map<string, MarketingStatus>> {
  const sb = getSupabase();
  const result = new Map<string, MarketingStatus>();
  const unique = Array.from(new Set(emailsNormalized));
  for (let i = 0; i < unique.length; i += DB_LOOKUP_CHUNK) {
    const chunk = unique.slice(i, i + DB_LOOKUP_CHUNK);
    if (chunk.length === 0) continue;
    const { data, error } = await sb
      .from('marketing_contacts')
      .select('email_normalized, marketing_status')
      .in('email_normalized', chunk);
    if (error) throw badRequest(error.message);
    for (const row of data ?? []) {
      result.set(row.email_normalized as string, row.marketing_status as MarketingStatus);
    }
  }
  return result;
}

function parseCsvTable(csvText: string): string[][] {
  try {
    return parse(csvText, {
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][];
  } catch {
    throw badRequest('Could not parse this file as CSV.');
  }
}

// ---------------------------------------------------------------------------
// Stage 1: preview. Parses, validates, classifies. NO DATABASE WRITES.
// ---------------------------------------------------------------------------
export async function previewMarketingContactsImport(req: Request, res: Response): Promise<void> {
  const parsed = marketingContactsImportPreviewSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid import request.');

  const csvText = parsed.data.csv;
  if (Buffer.byteLength(csvText, 'utf8') > MAX_CSV_BYTES) {
    throw badRequest(`CSV file is too large (max ${MAX_CSV_BYTES / (1024 * 1024)} MB).`);
  }

  const table = parseCsvTable(csvText);
  if (table.length === 0) throw badRequest('CSV file is empty.');

  const rawHeaders = table[0]!;
  const rawRows = table.slice(1);
  if (rawRows.length === 0) throw badRequest('CSV file has no data rows.');
  if (rawRows.length > MAX_CSV_ROWS) {
    throw badRequest(`CSV file has too many rows (max ${MAX_CSV_ROWS}).`);
  }

  let headerValidation: HeaderValidation;
  try {
    headerValidation = validateCsvHeaders(rawHeaders);
    assertBlankColumnsEmpty(rawRows, headerValidation.blankIndexes);
  } catch (err) {
    throw badRequest(err instanceof Error ? err.message : 'Invalid CSV header row.');
  }

  // Data rows start at spreadsheet line 2 (line 1 is the header).
  const rows = rawRows.map((cells, i) => classifyCsvRow(i + 2, cells, headerValidation.columnIndex));

  markInFileDuplicates(rows);

  const candidateEmails = rows.filter((r) => r.classification === 'new').map((r) => r.email_normalized);
  const existingStatuses = await fetchExistingStatuses(candidateEmails);
  applyExistingClassification(rows, existingStatuses);

  const summary = summarizeClassifications(rows);
  const eligibleRows = rows.filter((r) => r.classification === 'new');

  const actor = (req as AuthedRequest).admin!;
  const previewToken = signImportPreviewToken({
    adminId: actor.sub,
    rows: eligibleRows.map((r) => ({
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      audience_type: r.audience_type,
      marketing_status: r.marketing_status,
      consent_source: r.consent_source,
    })),
  });

  await writeAuditLog({
    actor,
    action: 'import_preview',
    resource: 'marketing_contacts',
    summary: 'Previewed marketing contacts CSV import',
    meta: { ...summary },
  });

  res.json({
    success: true,
    data: {
      preview_token: previewToken,
      expires_in_minutes: PREVIEW_TOKEN_TTL_MINUTES,
      summary,
      rows: rows.map((r) => ({
        row_number: r.row_number,
        email: r.email,
        first_name: r.first_name,
        last_name: r.last_name,
        audience_type: r.audience_type,
        marketing_status: r.marketing_status,
        classification: r.classification,
        reason: r.reason,
      })),
    },
  });
}

// ---------------------------------------------------------------------------
// Stage 2: confirm. Re-validates the preview token, re-checks duplicates,
// and inserts only rows that are still new. Never updates an existing row.
// ---------------------------------------------------------------------------
export async function confirmMarketingContactsImport(req: Request, res: Response): Promise<void> {
  const parsed = marketingContactsImportConfirmSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid confirmation request.');

  const actor = (req as AuthedRequest).admin!;

  let decoded;
  try {
    decoded = verifyImportPreviewToken(parsed.data.preview_token);
  } catch {
    throw new AppError(
      'This import preview has expired or is no longer valid. Please upload the file again.',
      400,
      { expose: true }
    );
  }
  if (decoded.adminId !== actor.sub) {
    throw new AppError('This import preview belongs to a different session.', 403, { expose: true });
  }

  const requested = decoded.rows.length;
  if (requested === 0) {
    const emptySummary = { requested: 0, inserted: 0, skipped_existing: 0, skipped_conflict: 0, failed: 0 };
    await writeAuditLog({
      actor,
      action: 'import_confirm',
      resource: 'marketing_contacts',
      summary: 'Imported marketing contacts from CSV',
      meta: { ...emptySummary },
    });
    res.json({ success: true, data: emptySummary });
    return;
  }

  // Re-check at confirm time: a row could have been created (by this admin
  // or another) between preview and confirm.
  const normalizedEmails = decoded.rows.map((r) => r.email.trim().toLowerCase());
  const existingNow = await fetchExistingStatuses(normalizedEmails);

  const toInsert = decoded.rows.filter((r) => !existingNow.has(r.email.trim().toLowerCase()));
  const skipped_existing = requested - toInsert.length;
  let inserted = 0;
  let skipped_conflict = 0;
  let failed = 0;

  const sb = getSupabase();
  const toPayload = (r: (typeof toInsert)[number]) => ({
    email: r.email,
    first_name: r.first_name,
    last_name: r.last_name,
    audience_type: r.audience_type,
    source: 'csv_import' as const,
    marketing_status: r.marketing_status,
    consent_source: r.consent_source,
  });

  for (let i = 0; i < toInsert.length; i += CONFIRM_INSERT_BATCH_SIZE) {
    const batch = toInsert.slice(i, i + CONFIRM_INSERT_BATCH_SIZE);
    const { data, error } = await sb
      .from('marketing_contacts')
      .insert(batch.map(toPayload))
      .select('id');

    if (!error) {
      inserted += data?.length ?? batch.length;
      continue;
    }

    // The batch failed as a whole (most likely a race-condition unique
    // violation from a row created concurrently) — insert this batch's rows
    // one at a time so a single bad row doesn't discard the rest of an
    // otherwise-valid batch. This is why the operation as a whole is not
    // atomic: see the P4-I2E report's "Atomic" note.
    for (const row of batch) {
      const { error: rowError } = await sb.from('marketing_contacts').insert(toPayload(row));
      if (!rowError) {
        inserted += 1;
      } else if ((rowError as { code?: string }).code === '23505') {
        skipped_conflict += 1;
      } else {
        failed += 1;
      }
    }
  }

  const summary = { requested, inserted, skipped_existing, skipped_conflict, failed };

  await writeAuditLog({
    actor,
    action: 'import_confirm',
    resource: 'marketing_contacts',
    summary: 'Imported marketing contacts from CSV',
    meta: { ...summary },
  });

  res.json({ success: true, data: summary });
}
