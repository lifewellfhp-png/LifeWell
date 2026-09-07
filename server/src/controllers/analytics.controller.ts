import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import {
  analyticsIngestSchema,
  conversionIngestSchema,
} from '../validation/adminSchemas.js';
import { normalizeReferrerHost, normalizeUtmValue } from '../lib/attribution.js';

export async function handleAnalyticsIngest(req: Request, res: Response): Promise<void> {
  const parsed = analyticsIngestSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid analytics payload.');

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
 * Boundary rule (defined before implementation, applies everywhere in this
 * file): `from` and `to` are calendar dates (YYYY-MM-DD) as observed in
 * REPORT_TIMEZONE, and both are INCLUSIVE from the caller's perspective. The
 * underlying Supabase query window is the standard half-open interval
 * [localMidnight(from), localMidnight(to + 1 day)) — start inclusive, end
 * exclusive — so every calendar day in the range is counted exactly once,
 * whether it's the first, last, or a middle day, with no midnight-boundary
 * event ever double-counted or dropped. Day-bucketing for the trend chart
 * uses the same zone, so "Aug 30" always means Aug 30 in REPORT_TIMEZONE,
 * never Aug 30 UTC.
 */
const REPORT_TIMEZONE = 'America/New_York';
const MAX_RANGE_DAYS = 366;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The UTC instant of `dateStr`'s (YYYY-MM-DD) local midnight in `timeZone`. */
function zonedMidnightToUtc(dateStr: string, timeZone: string): Date {
  const naiveUtc = new Date(`${dateStr}T00:00:00.000Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, string> = {};
  for (const part of fmt.formatToParts(naiveUtc)) parts[part.type] = part.value;
  const hour = Number(parts.hour) % 24; // some ICU builds render midnight as "24"
  const zonedAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    hour,
    Number(parts.minute),
    Number(parts.second)
  );
  const offsetMs = zonedAsUtc - naiveUtc.getTime();
  return new Date(naiveUtc.getTime() - offsetMs);
}

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

/** The calendar date (YYYY-MM-DD) a stored UTC timestamp falls on, as observed in `timeZone`. */
function dateKeyInZone(isoUtc: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(isoUtc)
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

export async function getAnalyticsSummary(req: Request, res: Response): Promise<void> {
  const sb = getSupabase();
  const { from, to } = resolveRange(req.query);
  const rangeDays = calendarDaysBetween(from, to) + 1;

  const rangeStart = zonedMidnightToUtc(from, REPORT_TIMEZONE);
  const rangeEnd = zonedMidnightToUtc(addCalendarDays(to, 1), REPORT_TIMEZONE);

  const [eventsRes, conversionsRes] = await Promise.all([
    sb
      .from('analytics_events')
      .select('event_type, path, referrer_host, device, created_at')
      .gte('created_at', rangeStart.toISOString())
      .lt('created_at', rangeEnd.toISOString()),
    sb
      .from('conversions')
      .select('conversion_type, path, device, referrer_host, created_at')
      .gte('created_at', rangeStart.toISOString())
      .lt('created_at', rangeEnd.toISOString()),
  ]);

  if (eventsRes.error) throw badRequest(eventsRes.error.message);
  if (conversionsRes.error) throw badRequest(conversionsRes.error.message);

  const events = eventsRes.data ?? [];
  const conversions = conversionsRes.data ?? [];

  const pageViews = events.filter((e) => e.event_type === 'page_view');
  const byPath: Record<string, number> = {};
  const byDevice: Record<string, number> = {};
  const byReferrer: Record<string, number> = {};
  const byDay: Record<string, number> = {};

  for (const e of pageViews) {
    const path = e.path || '/';
    byPath[path] = (byPath[path] ?? 0) + 1;
    const device = e.device || 'unknown';
    byDevice[device] = (byDevice[device] ?? 0) + 1;
    const ref = e.referrer_host || 'direct';
    byReferrer[ref] = (byReferrer[ref] ?? 0) + 1;
    const day = dateKeyInZone(e.created_at as string, REPORT_TIMEZONE);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  const popularPages = Object.entries(byPath)
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  const trafficSources = Object.entries(byReferrer)
    .map(([source, visits]) => ({ source, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 15);

  const trends = Object.entries(byDay)
    .map(([date, views]) => ({ date, views }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const conversionCounts = conversions.reduce<Record<string, number>>((acc, c) => {
    acc[c.conversion_type] = (acc[c.conversion_type] ?? 0) + 1;
    return acc;
  }, {});

  const byBookingClickPath: Record<string, number> = {};
  for (const c of conversions) {
    if (c.conversion_type !== 'booking_click') continue;
    const path = c.path || '/';
    byBookingClickPath[path] = (byBookingClickPath[path] ?? 0) + 1;
  }
  const topBookingPages = Object.entries(byBookingClickPath)
    .map(([path, clicks]) => ({ path, clicks }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 15);

  // Phase 8 P3-1: device/referrer attribution for booking_click only —
  // matches topBookingPages' own scoping above (the conversion type this
  // reporting was built for). Missing values are historical rows recorded
  // before this column existed, or the rare payload that omitted them; both
  // are treated identically to page views' own fallback convention
  // ('unknown' device, 'direct' referrer) — never fabricated as a specific
  // value.
  const byBookingClickDevice: Record<string, number> = {};
  const byBookingClickReferrer: Record<string, number> = {};
  for (const c of conversions) {
    if (c.conversion_type !== 'booking_click') continue;
    const device = c.device || 'unknown';
    byBookingClickDevice[device] = (byBookingClickDevice[device] ?? 0) + 1;
    const ref = c.referrer_host || 'direct';
    byBookingClickReferrer[ref] = (byBookingClickReferrer[ref] ?? 0) + 1;
  }
  const bookingClicksByReferrer = Object.entries(byBookingClickReferrer)
    .map(([source, visits]) => ({ source, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 15);

  // Comparison period: the immediately preceding window of the SAME length
  // (in calendar days) as the selected range, bounded by the same
  // REPORT_TIMEZONE half-open rule — generalizes the old hardcoded
  // "prior 30 days" comparison to any range length.
  const priorTo = addCalendarDays(from, -1);
  const priorFrom = addCalendarDays(priorTo, -(rangeDays - 1));
  const priorStart = zonedMidnightToUtc(priorFrom, REPORT_TIMEZONE);
  const priorEnd = rangeStart;

  const [priorEvents, priorConversions] = await Promise.all([
    sb
      .from('analytics_events')
      .select('event_type, created_at')
      .gte('created_at', priorStart.toISOString())
      .lt('created_at', priorEnd.toISOString()),
    sb
      .from('conversions')
      .select('id, created_at')
      .gte('created_at', priorStart.toISOString())
      .lt('created_at', priorEnd.toISOString()),
  ]);
  const priorViews = (priorEvents.data ?? []).filter((e) => e.event_type === 'page_view').length;
  const priorConv = (priorConversions.data ?? []).length;

  const pct = (now: number, prev: number) => {
    if (!prev) return now ? 100 : 0;
    return Math.round(((now - prev) / prev) * 100);
  };

  res.json({
    success: true,
    data: {
      from,
      to,
      timezone: REPORT_TIMEZONE,
      rangeDays,
      totals: {
        pageViews: pageViews.length,
        conversions: conversions.length,
      },
      deltas: {
        pageViews: pct(pageViews.length, priorViews),
        conversions: pct(conversions.length, priorConv),
      },
      popularPages,
      devices: byDevice,
      trafficSources,
      trends,
      conversionCounts,
      topBookingPages,
      bookingClicksByDevice: byBookingClickDevice,
      bookingClicksByReferrer,
    },
  });
}
