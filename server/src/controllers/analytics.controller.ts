import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import {
  analyticsIngestSchema,
  conversionIngestSchema,
} from '../validation/adminSchemas.js';
import { normalizeReferrerHost, normalizeUtmValue } from '../lib/attribution.js';
import { isExcludedRequest } from '../lib/trafficFilter.js';

export async function handleAnalyticsIngest(req: Request, res: Response): Promise<void> {
  const parsed = analyticsIngestSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid analytics payload.');

  // Known bots/crawlers, headless/automation tooling, and traffic from an
  // origin other than the real public site are not patient traffic — the
  // request still succeeds (the client's fire-and-forget beacon ignores
  // the response either way), it just never reaches the database.
  if (isExcludedRequest(req).excluded) {
    res.status(201).json({ success: true });
    return;
  }

  // Never accept free-text or identifiers — schema already strips them.
  // Phase 8 P3-UTM-1: utm_source/utm_medium/utm_campaign are independently
  // re-validated here (this is a public, unauthenticated endpoint — the
  // schema's max(120) bound is a first-pass filter, not the trust
  // boundary). An unsafe optional UTM value is normalized to null rather
  // than failing the whole request — the page_view itself still records.
  const payload = {
    ...parsed.data,
    utm_source: normalizeUtmValue(parsed.data.utm_source),
    utm_medium: normalizeUtmValue(parsed.data.utm_medium),
    utm_campaign: normalizeUtmValue(parsed.data.utm_campaign),
  };

  const { error } = await getSupabase().from('analytics_events').insert(payload);
  if (error) throw badRequest(error.message);
  res.status(201).json({ success: true });
}

export async function handleConversionIngest(req: Request, res: Response): Promise<void> {
  const parsed = conversionIngestSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid conversion payload.');

  // Same non-patient-traffic exclusion as handleAnalyticsIngest above.
  if (isExcludedRequest(req).excluded) {
    res.status(201).json({ success: true });
    return;
  }

  // Strip any accidental PII keys from meta.
  const meta = { ...parsed.data.meta };
  for (const key of Object.keys(meta)) {
    if (/email|phone|name|message|dob|ssn|mrn/i.test(key)) delete meta[key];
  }

  const { error } = await getSupabase().from('conversions').insert({
    conversion_type: parsed.data.conversion_type,
    path: parsed.data.path ?? null,
    meta,
    // Phase 8 P3-1: device is already validated to the closed enum by the
    // schema above; referrer_host is independently re-validated here
    // (this is a public, unauthenticated endpoint — the submitted string is
    // never trusted just because a well-behaved client would have already
    // sent a clean value). Never a raw user agent or full referrer URL.
    device: parsed.data.device ?? null,
    referrer_host: normalizeReferrerHost(parsed.data.referrer_host),
  });
  if (error) throw badRequest(error.message);
  res.status(201).json({ success: true });
}

/**
 * Phase 8 P2-1: one explicit reporting timezone, used end-to-end for every
 * date boundary and trend bucket in getAnalyticsSummary — America/New_York,
 * matching the practice's Orlando, FL location and its own published
 * business hours (client/src/data/site.ts labels them "EST"; an IANA zone is
 * used here instead of a fixed offset so DST is handled automatically and
 * correctly year-round, rather than repeating that "always EST" imprecision).
 * The resolved zone is echoed back in the API response (`timezone`) so the
 * Admin UI displays it rather than hardcoding a second copy of this fact.
 *
 * Boundary rule (defined before implementation; enforced inside the
 * analytics_summary() Postgres function — see
 * server/supabase/migrations/20261019180354_analytics_summary_rpc.sql —
 * rather than in this file, now that aggregation happens in SQL): `from`
 * and `to` are calendar dates (YYYY-MM-DD) as observed in REPORT_TIMEZONE,
 * and both are INCLUSIVE from the caller's perspective. The underlying
 * query window is the standard half-open interval [localMidnight(from),
 * localMidnight(to + 1 day)) — start inclusive, end exclusive — so every
 * calendar day in the range is counted exactly once, whether it's the
 * first, last, or a middle day, with no midnight-boundary event ever
 * double-counted or dropped. Day-bucketing for the trend chart uses the
 * same zone, so "Aug 30" always means Aug 30 in REPORT_TIMEZONE, never
 * Aug 30 UTC. This function still computes `from`/`to`/`rangeDays` in
 * JS (resolveRange, calendarDaysBetween below) — only the zoned-midnight
 * conversion and the actual row counting moved into SQL.
 */
const REPORT_TIMEZONE = 'America/New_York';
const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Adds (or subtracts, for a negative count) whole calendar days to a YYYY-MM-DD string. */
function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole calendar days from `fromStr` to `toStr` (0 when equal). */
function calendarDaysBetween(fromStr: string, toStr: string): number {
  const a = new Date(`${fromStr}T00:00:00.000Z`).getTime();
  const b = new Date(`${toStr}T00:00:00.000Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Today's calendar date (YYYY-MM-DD) as observed in `timeZone`. */
function todayInZone(timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date()
  );
}

function isValidCalendarDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parts = value.split('-').map(Number);
  const y = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  const d = parts[2] ?? 0;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const PRESETS = ['today', '7d', '30d'] as const;
type Preset = (typeof PRESETS)[number];

function isPreset(value: string): value is Preset {
  return (PRESETS as readonly string[]).includes(value);
}

/** Resolves and validates the requested (or default) reporting range — see the boundary-rule comment above. */
function resolveRange(query: Request['query']): { from: string; to: string } {
  const presetRaw = typeof query.preset === 'string' ? query.preset : undefined;
  const fromRaw = typeof query.from === 'string' ? query.from : undefined;
  const toRaw = typeof query.to === 'string' ? query.to : undefined;

  if (presetRaw !== undefined) {
    if (fromRaw !== undefined || toRaw !== undefined) {
      throw badRequest('Provide either preset or from/to, not both.');
    }
    if (!isPreset(presetRaw)) throw badRequest("preset must be one of: 'today', '7d', '30d'.");
    const to = todayInZone(REPORT_TIMEZONE);
    const spanDays = presetRaw === 'today' ? 1 : presetRaw === '7d' ? 7 : 30;
    return { from: addCalendarDays(to, -(spanDays - 1)), to };
  }

  if (fromRaw === undefined && toRaw === undefined) {
    // Default: last 30 calendar days ending today, in REPORT_TIMEZONE —
    // preserves the pre-P2-1 default window.
    const to = todayInZone(REPORT_TIMEZONE);
    return { from: addCalendarDays(to, -29), to };
  }

  if (fromRaw === undefined || toRaw === undefined) {
    throw badRequest('Both from and to must be provided together.');
  }
  if (!isValidCalendarDate(fromRaw) || !isValidCalendarDate(toRaw)) {
    throw badRequest('from/to must be valid calendar dates in YYYY-MM-DD format.');
  }
  if (fromRaw > toRaw) throw badRequest('from must not be after to.');
  const spanDays = calendarDaysBetween(fromRaw, toRaw) + 1;
  if (spanDays > MAX_RANGE_DAYS) throw badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days.`);

  return { from: fromRaw, to: toRaw };
}

export type UtmShareRow = { value: string; count: number; share: number };

/**
 * Turns a value->count map into a descending-sorted, deterministically-
 * tied ranking with each row's share of THIS map's own total — never the
 * overall page-view total. That distinction is the whole point of P3-UTM-2
 * section 13/14: "share" for utm_source must mean "of UTM-source-attributed
 * page views", not "of all traffic", so unattributed/direct traffic is
 * never made to look like it belongs to a campaign. Pure and directly
 * unit-testable with synthetic input.
 */
export function buildUtmShareRanking(counts: Record<string, number>): UtmShareRow[] {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  return Object.entries(counts)
    .map(([value, count]) => ({
      value,
      count,
      // One decimal place — matches the task's own worked examples (62.5%).
      share: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => (b.count !== a.count ? b.count - a.count : a.value.localeCompare(b.value)));
}

/**
 * Shape of the JSONB object returned by the analytics_summary(p_from,
 * p_to, p_tz) Postgres function — see
 * server/supabase/migrations/20261019180354_analytics_summary_rpc.sql.
 * All counting/grouping happens in SQL (count(*), group by, limit) so no
 * PostgREST row cap ever applies, unlike a plain .select() of raw rows.
 */
type AnalyticsSummaryRpcResult = {
  pageViews: number;
  conversions: number;
  priorPageViews: number;
  priorConversions: number;
  byDevice: Record<string, number>;
  popularPages: { path: string; views: number }[];
  trafficSources: { source: string; visits: number }[];
  trends: { date: string; views: number }[];
  utmSourceCounts: Record<string, number>;
  utmCampaignCounts: Record<string, number>;
  conversionCounts: Record<string, number>;
  topBookingPages: { path: string; clicks: number }[];
  bookingClicksByDevice: Record<string, number>;
  bookingClicksByReferrer: { source: string; visits: number }[];
};

const pct = (now: number, prev: number) => {
  if (!prev) return now ? 100 : 0;
  return Math.round(((now - prev) / prev) * 100);
};

export async function getAnalyticsSummary(req: Request, res: Response): Promise<void> {
  const sb = getSupabase();
  const { from, to } = resolveRange(req.query);
  const rangeDays = calendarDaysBetween(from, to) + 1;

  const { data, error } = await sb.rpc('analytics_summary', {
    p_from: from,
    p_to: to,
    p_tz: REPORT_TIMEZONE,
  });
  if (error) throw badRequest(error.message);
  const result = data as AnalyticsSummaryRpcResult;

  // Uncapped (no top-N slice): unlike topBookingPages/popularPages, this
  // report is not authorized to break its own reconciliation guarantee by
  // hiding rows without an "Other" bucket — see the P3-UTM-2 task's row-cap
  // section. UTM value cardinality in practice is small (a curated set of
  // marketing sources/campaigns, not one row per page), so no cap is safe.
  const utmSources = buildUtmShareRanking(result.utmSourceCounts);
  const utmCampaigns = buildUtmShareRanking(result.utmCampaignCounts);

  res.json({
    success: true,
    data: {
      from,
      to,
      timezone: REPORT_TIMEZONE,
      rangeDays,
      totals: {
        pageViews: result.pageViews,
        conversions: result.conversions,
      },
      deltas: {
        pageViews: pct(result.pageViews, result.priorPageViews),
        conversions: pct(result.conversions, result.priorConversions),
      },
      popularPages: result.popularPages,
      devices: result.byDevice,
      trafficSources: result.trafficSources,
      utmSources,
      utmCampaigns,
      trends: result.trends,
      conversionCounts: result.conversionCounts,
      topBookingPages: result.topBookingPages,
      bookingClicksByDevice: result.bookingClicksByDevice,
      bookingClicksByReferrer: result.bookingClicksByReferrer,
    },
  });
}
