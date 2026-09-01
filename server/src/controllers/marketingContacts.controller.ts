import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase.js';
import { AppError, badRequest, notFound } from '../utils/errors.js';
import { fieldErrors } from '../validation/schemas.js';
import {
  marketingContactCreate,
  marketingContactUpdate,
  assertEffectiveMarketingConsent,
  assertMarketingStatusTransition,
  MARKETING_STATUSES,
  MARKETING_AUDIENCE_TYPES,
  MARKETING_SOURCES,
} from '../validation/adminSchemas.js';
import { diffChanges, writeAuditLog } from '../lib/audit.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_SEARCH_LENGTH = 200;

const SORTABLE_COLUMNS = new Set(['created_at', 'updated_at', 'email', 'marketing_status', 'audience_type']);
const STATUS_VALUES = new Set<string>(MARKETING_STATUSES);
const AUDIENCE_VALUES = new Set<string>(MARKETING_AUDIENCE_TYPES);
const SOURCE_VALUES = new Set<string>(MARKETING_SOURCES);

const uuidParam = z.string().uuid();

/**
 * Escapes the characters that carry special meaning inside a PostgREST
 * `ilike`/`or` filter value (`%`, `_` for ILIKE wildcards; `,`/`(`/`)` as
 * Supabase's own filter-syntax delimiters) so a search term is always
 * treated as literal data, never as filter syntax — the search box can
 * never be used to construct an arbitrary query.
 */
function escapeForFilter(value: string): string {
  return value.replace(/[%_,()]/g, (ch) => `\\${ch}`);
}

/**
 * Pure page/pageSize resolution, extracted so the clamping/capping
 * arithmetic is directly unit-testable without a live Supabase connection.
 */
export function resolvePagination(query: { page?: unknown; pageSize?: unknown }): {
  page: number;
  pageSize: number;
} {
  const pageRaw = Number(query.page);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const pageSizeRaw = Number(query.pageSize);
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
      ? Math.min(Math.floor(pageSizeRaw), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

export function isUniqueEmailViolation(error: { code?: string } | null): boolean {
  // Postgres unique_violation is SQLSTATE 23505; supabase-js/PostgREST
  // surfaces it as `error.code` on the returned PostgrestError.
  return error?.code === '23505';
}

/**
 * A field-level diff via the existing diffChanges() with one deliberate
 * exception: email is never duplicated into audit metadata as plain
 * old/new text. Every other field this table has is already
 * non-identifying operational metadata (status/audience/source/consent),
 * so the general helper is reused for those, not replaced.
 */
export function sanitizedAuditChanges(
  before: Record<string, unknown> | null,
  payload: Record<string, unknown>
): Record<string, unknown> | undefined {
  const changes = diffChanges(before, payload);
  if (!changes) return changes;
  if ('email' in changes) {
    const { email: _emailChange, ...rest } = changes;
    return { ...rest, email: { changed: true } };
  }
  return changes;
}

/**
 * Server-set transition timestamps — only when this request actually
 * transitions INTO that status and the caller didn't already supply a
 * timestamp of their own. Extracted as a pure function so the timestamping
 * rule is directly unit-testable.
 */
export function resolveStatusTimestamps(
  before: { marketing_status?: unknown },
  submitted: { marketing_status?: string; unsubscribed_at?: string | null; suppressed_at?: string | null }
): { unsubscribed_at?: string; suppressed_at?: string } {
  const out: { unsubscribed_at?: string; suppressed_at?: string } = {};
  const now = new Date().toISOString();
  if (
    submitted.marketing_status === 'unsubscribed' &&
    before.marketing_status !== 'unsubscribed' &&
    submitted.unsubscribed_at === undefined
  ) {
    out.unsubscribed_at = now;
  }
  if (
    submitted.marketing_status === 'suppressed' &&
    before.marketing_status !== 'suppressed' &&
    submitted.suppressed_at === undefined
  ) {
    out.suppressed_at = now;
  }
  return out;
}

export async function listMarketingContacts(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = resolvePagination(req.query);

  const marketing_status = typeof req.query.marketing_status === 'string' ? req.query.marketing_status : undefined;
  if (marketing_status !== undefined && !STATUS_VALUES.has(marketing_status)) {
    throw badRequest('Invalid marketing_status filter.');
  }
  const audience_type = typeof req.query.audience_type === 'string' ? req.query.audience_type : undefined;
  if (audience_type !== undefined && !AUDIENCE_VALUES.has(audience_type)) {
    throw badRequest('Invalid audience_type filter.');
  }
  const source = typeof req.query.source === 'string' ? req.query.source : undefined;
  if (source !== undefined && !SOURCE_VALUES.has(source)) {
    throw badRequest('Invalid source filter.');
  }

  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'created_at';
  if (!SORTABLE_COLUMNS.has(sort)) throw badRequest('Invalid sort field.');
  const order = req.query.order === 'asc' ? 'asc' : 'desc';

  const searchRaw = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (searchRaw.length > MAX_SEARCH_LENGTH) throw badRequest('Search term is too long.');

  let query = getSupabase()
    .from('marketing_contacts')
    .select('*', { count: 'exact' })
    .order(sort, { ascending: order === 'asc' });

  if (marketing_status) query = query.eq('marketing_status', marketing_status);
  if (audience_type) query = query.eq('audience_type', audience_type);
  if (source) query = query.eq('source', source);
  if (searchRaw) {
    const escaped = escapeForFilter(searchRaw);
    query = query.or(`email.ilike.%${escaped}%,first_name.ilike.%${escaped}%,last_name.ilike.%${escaped}%`);
  }

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) throw badRequest(error.message);

  const total = count ?? 0;
  res.json({
    success: true,
    data: {
      items: data ?? [],
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
  });
}

export async function getMarketingContact(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid contact id.');

  const { data, error } = await getSupabase()
    .from('marketing_contacts')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Marketing contact not found.');
  res.json({ success: true, data });
}

export async function createMarketingContact(req: Request, res: Response): Promise<void> {
  const parsed = marketingContactCreate.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Invalid marketing contact payload.', fieldErrors(parsed.error));
  }

  const payload = {
    email: parsed.data.email,
    first_name: parsed.data.first_name ?? null,
    last_name: parsed.data.last_name ?? null,
    audience_type: parsed.data.audience_type,
    source: parsed.data.source,
    marketing_status: parsed.data.marketing_status,
    consent_source: parsed.data.consent_source ?? null,
    consent_at: parsed.data.consent_at ?? null,
    unsubscribed_at: parsed.data.unsubscribed_at ?? null,
    suppressed_at: parsed.data.suppressed_at ?? null,
    suppression_reason: parsed.data.suppression_reason ?? null,
  };

  const { data, error } = await getSupabase().from('marketing_contacts').insert(payload).select('*').single();

  if (error) {
    if (isUniqueEmailViolation(error)) {
      throw new AppError('A marketing contact with this email already exists.', 409, { expose: true });
    }
    throw badRequest(error.message);
  }

  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'create',
    resource: 'marketing_contacts',
    resourceId: data.id,
    summary: 'Created marketing contact',
    meta: {
      audience_type: data.audience_type,
      source: data.source,
      marketing_status: data.marketing_status,
    },
  });

  res.status(201).json({ success: true, data });
}

export async function updateMarketingContact(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid contact id.');

  const parsed = marketingContactUpdate.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Invalid marketing contact update.', fieldErrors(parsed.error));
  }

  const { data: before, error: beforeError } = await getSupabase()
    .from('marketing_contacts')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (beforeError) throw badRequest(beforeError.message);
  if (!before) throw notFound('Marketing contact not found.');

  // Effective-row validation: evaluate the row PATCH would actually
  // produce (existing values merged with submitted ones), not merely the
  // submitted payload in isolation — mirrors the P4-G6 testimonial
  // consent invariant.
  const effective = { ...before, ...parsed.data };

  try {
    assertEffectiveMarketingConsent(effective);
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : 'Invalid consent state.', 422, {
      expose: true,
      fields: { consent_source: 'A consent_source is required to mark a contact subscribed.' },
    });
  }

  if (parsed.data.marketing_status !== undefined) {
    try {
      assertMarketingStatusTransition(before.marketing_status as string, parsed.data.marketing_status);
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : 'Invalid status transition.', 422, {
        expose: true,
        fields: { marketing_status: 'This status change is not allowed through this endpoint.' },
      });
    }
  }

  const payload: Record<string, unknown> = {
    ...parsed.data,
    ...resolveStatusTimestamps(before, parsed.data),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabase()
    .from('marketing_contacts')
    .update(payload)
    .eq('id', parsedId.data)
    .select('*')
    .maybeSingle();

  if (error) {
    if (isUniqueEmailViolation(error)) {
      throw new AppError('A marketing contact with this email already exists.', 409, { expose: true });
    }
    throw badRequest(error.message);
  }
  if (!data) throw notFound('Marketing contact not found.');

  const actor = (req as AuthedRequest).admin;
  const changes = sanitizedAuditChanges(before as Record<string, unknown>, payload);
  const statusChanged =
    parsed.data.marketing_status !== undefined && parsed.data.marketing_status !== before.marketing_status;

  await writeAuditLog({
    actor,
    action: statusChanged ? 'status_change' : 'update',
    resource: 'marketing_contacts',
    resourceId: data.id,
    summary: statusChanged ? 'Changed marketing contact status' : 'Updated marketing contact',
    meta: changes ? { changes } : undefined,
  });

  res.json({ success: true, data });
}
