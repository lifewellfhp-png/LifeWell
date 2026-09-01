import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase.js';
import { AppError, badRequest, notFound } from '../utils/errors.js';
import { fieldErrors } from '../validation/schemas.js';
import {
  marketingCampaignCreate,
  marketingCampaignUpdate,
  MARKETING_CAMPAIGN_STATUSES,
  MARKETING_AUDIENCE_TYPES,
} from '../validation/adminSchemas.js';
import { writeAuditLog } from '../lib/audit.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';
import { resolvePagination, escapeForFilter } from './marketingContacts.controller.js';

/**
 * Marketing campaign DRAFTS (P4-I4B). This controller manages
 * public.marketing_campaigns (P4-I4A, Production-verified) — draft
 * content and audience-selection criteria only. It never sends email,
 * never queries an email provider, and never writes to marketing_contacts
 * (the recipient-count preview below is SELECT/COUNT-only).
 *
 * Reuses resolvePagination/escapeForFilter from marketingContacts.controller
 * rather than duplicating them — same package, same concern, no reason for
 * a second copy (unlike the Admin/Server split elsewhere in this codebase,
 * which duplicates by necessity across separate deployments).
 */

const MAX_SEARCH_LENGTH = 200;
const SORTABLE_COLUMNS = new Set(['created_at', 'updated_at', 'name', 'status']);
const STATUS_VALUES = new Set<string>(MARKETING_CAMPAIGN_STATUSES);
const AUDIENCE_VALUES = new Set<string>(MARKETING_AUDIENCE_TYPES);
/** Sentinel for "audience_type IS NULL" (All Subscribed Contacts) — distinct from omitting the filter entirely (no filter, every audience). */
const NULL_AUDIENCE_SENTINEL = 'null';

const uuidParam = z.string().uuid();

export async function listMarketingCampaigns(req: Request, res: Response): Promise<void> {
  const { page, pageSize } = resolvePagination(req.query);

  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  if (status !== undefined && !STATUS_VALUES.has(status)) {
    throw badRequest('Invalid status filter.');
  }

  const audienceRaw = typeof req.query.audience_type === 'string' ? req.query.audience_type : undefined;
  if (audienceRaw !== undefined && audienceRaw !== NULL_AUDIENCE_SENTINEL && !AUDIENCE_VALUES.has(audienceRaw)) {
    throw badRequest('Invalid audience_type filter.');
  }

  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'created_at';
  if (!SORTABLE_COLUMNS.has(sort)) throw badRequest('Invalid sort field.');
  const order = req.query.order === 'asc' ? 'asc' : 'desc';

  const searchRaw = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (searchRaw.length > MAX_SEARCH_LENGTH) throw badRequest('Search term is too long.');

  let query = getSupabase()
    .from('marketing_campaigns')
    .select('*', { count: 'exact' })
    .order(sort, { ascending: order === 'asc' });

  if (status) query = query.eq('status', status);
  if (audienceRaw === NULL_AUDIENCE_SENTINEL) query = query.is('audience_type', null);
  else if (audienceRaw) query = query.eq('audience_type', audienceRaw);
  if (searchRaw) {
    const escaped = escapeForFilter(searchRaw);
    query = query.or(`name.ilike.%${escaped}%,subject.ilike.%${escaped}%`);
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

export async function getMarketingCampaign(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid campaign id.');

  const { data, error } = await getSupabase()
    .from('marketing_campaigns')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Marketing campaign not found.');
  res.json({ success: true, data });
}

export async function createMarketingCampaign(req: Request, res: Response): Promise<void> {
  const parsed = marketingCampaignCreate.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Invalid marketing campaign payload.', fieldErrors(parsed.error));
  }

  const actor = (req as AuthedRequest).admin;
  const payload = {
    name: parsed.data.name,
    subject: parsed.data.subject,
    preview_text: parsed.data.preview_text ?? null,
    content: parsed.data.content,
    audience_type: parsed.data.audience_type ?? null,
    // Server-controlled — never accepted from the request body (the schema
    // has no `created_by` field at all). Falls back to null rather than
    // throwing if, for some reason, no admin claim is present, matching how
    // admin_audit_logs.actor_id is nullable for the same reason.
    created_by: actor?.sub ?? null,
  };

  const { data, error } = await getSupabase().from('marketing_campaigns').insert(payload).select('*').single();
  if (error) throw badRequest(error.message);

  await writeAuditLog({
    actor,
    action: 'create',
    resource: 'marketing_campaigns',
    resourceId: data.id,
    summary: 'Created marketing campaign draft',
    // Deliberately no name/subject/content — see module docblock.
    meta: { status: data.status, audience_type: data.audience_type },
  });

  res.status(201).json({ success: true, data });
}

/**
 * Editability decision, as a pure function of the campaign's CURRENT
 * status — extracted so it is directly unit-testable without a live
 * Supabase connection. Only a draft is editable; anything else (chiefly
 * archived) is a 409 conflict, matching the resubscribe-eligibility
 * pattern in marketingContacts.controller.ts.
 */
export function assertCampaignEditable(currentStatus: string): void {
  if (currentStatus !== 'draft') {
    throw new AppError('This campaign is archived and cannot be edited.', 409, { expose: true });
  }
}

export async function updateMarketingCampaign(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid campaign id.');

  const parsed = marketingCampaignUpdate.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Invalid marketing campaign update.', fieldErrors(parsed.error));
  }

  const { data: before, error: beforeError } = await getSupabase()
    .from('marketing_campaigns')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (beforeError) throw badRequest(beforeError.message);
  if (!before) throw notFound('Marketing campaign not found.');

  assertCampaignEditable(before.status as string);

  const payload: Record<string, unknown> = {
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await getSupabase()
    .from('marketing_campaigns')
    .update(payload)
    .eq('id', parsedId.data)
    .select('*')
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Marketing campaign not found.');

  const actor = (req as AuthedRequest).admin;
  // Field NAMES only — never values, and never subject/content text. See
  // module docblock and P4-I4B task section 24.
  const changedFields = Object.keys(parsed.data);
  await writeAuditLog({
    actor,
    action: 'update',
    resource: 'marketing_campaigns',
    resourceId: data.id,
    summary: 'Updated marketing campaign draft',
    meta: changedFields.length ? { changed_fields: changedFields } : undefined,
  });

  res.json({ success: true, data });
}

/**
 * The archive write payload, as a pure function of the server-computed
 * timestamp — extracted so a test can assert exactly which keys it sets
 * (status/archived_at/updated_at, all three together) without a live
 * Supabase connection.
 */
export function buildArchivePayload(now: string): Record<string, unknown> {
  return { status: 'archived', archived_at: now, updated_at: now };
}

export async function archiveMarketingCampaign(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid campaign id.');

  const { data: before, error: beforeError } = await getSupabase()
    .from('marketing_campaigns')
    .select('*')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (beforeError) throw badRequest(beforeError.message);
  if (!before) throw notFound('Marketing campaign not found.');

  // Idempotent: archiving an already-archived campaign is a no-op that
  // returns the current row unchanged, never rewriting archived_at.
  if (before.status === 'archived') {
    res.json({ success: true, data: before });
    return;
  }

  const now = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from('marketing_campaigns')
    .update(buildArchivePayload(now))
    .eq('id', parsedId.data)
    .select('*')
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!data) throw notFound('Marketing campaign not found.');

  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'archive',
    resource: 'marketing_campaigns',
    resourceId: data.id,
    summary: 'Archived marketing campaign',
    meta: { status: data.status },
  });

  res.json({ success: true, data });
}

export type RecipientEligibilityFilters = {
  marketing_status: 'subscribed';
  audience_type?: string;
};

/**
 * Recipient eligibility (P4-I4B section 13, the critical safety rule),
 * expressed as a pure function of the campaign's audience_type — extracted
 * so it is directly unit-testable without a live Supabase connection.
 * `marketing_status` is always the literal 'subscribed' — there is no
 * code path that can produce 'pending'/'unsubscribed'/'suppressed' here.
 * A falsy (null/undefined) audience_type omits the audience_type key
 * entirely, meaning every subscribed contact; a truthy one narrows to
 * that one audience — but never replaces or weakens the subscribed
 * requirement.
 */
export function buildRecipientEligibilityFilters(audienceType: string | null | undefined): RecipientEligibilityFilters {
  const filters: RecipientEligibilityFilters = { marketing_status: 'subscribed' };
  if (audienceType) filters.audience_type = audienceType;
  return filters;
}

/**
 * Recipient eligibility preview. This is a live COUNT against current
 * marketing_contacts state — nothing is cached, persisted, or written back
 * to marketing_campaigns, and no contact identity (id/email/name) is ever
 * returned: the select() below uses `head: true`, so Postgres/PostgREST
 * never even returns row data, only the count header.
 */
export async function previewMarketingCampaignRecipients(req: Request, res: Response): Promise<void> {
  const parsedId = uuidParam.safeParse(req.params.id);
  if (!parsedId.success) throw badRequest('Invalid campaign id.');

  const { data: campaign, error: campaignError } = await getSupabase()
    .from('marketing_campaigns')
    .select('id, audience_type')
    .eq('id', parsedId.data)
    .maybeSingle();
  if (campaignError) throw badRequest(campaignError.message);
  if (!campaign) throw notFound('Marketing campaign not found.');

  const filters = buildRecipientEligibilityFilters(campaign.audience_type as string | null);
  let query = getSupabase()
    .from('marketing_contacts')
    .select('id', { count: 'exact', head: true })
    .eq('marketing_status', filters.marketing_status);
  if (filters.audience_type) {
    query = query.eq('audience_type', filters.audience_type);
  }

  const { count, error } = await query;
  if (error) throw badRequest(error.message);

  res.json({
    success: true,
    data: {
      eligible_count: count ?? 0,
      audience_type: campaign.audience_type ?? null,
    },
  });
}
