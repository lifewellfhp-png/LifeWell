import { NextResponse } from 'next/server';

/**
 * Content-Security-Policy-Report-Only violation collector (P4-E4).
 *
 * Receives the browser's automatic POST when a resource violates the
 * Report-Only policy set in src/middleware.ts (P4-G3D; previously
 * next.config.js). This endpoint exists purely to
 * observe those violations during the Stage 1 rollout (see P4-E2) — it
 * never enforces anything, never stores anything in Supabase, and never
 * forwards to a third-party monitoring vendor. Every field from the
 * request is treated as attacker-controllable (a CSP report is triggered
 * by whatever resource a page tried to load, which is exactly the kind of
 * input this system should not trust) and only a small, explicit allowlist
 * of diagnostic fields is ever logged, sanitized and length-bounded first.
 *
 * Only the classic `report-uri` shape is handled
 * (Content-Type: application/csp-report, body: { "csp-report": {...} } )
 * because that's the only reporting mechanism configured in the CSP header
 * — no `report-to`/`Reporting-Endpoints` header is set. If a later stage
 * adds `report-to`, this handler will need a matching update for the
 * newer `application/reports+json` array format.
 */

export const dynamic = 'force-dynamic';

const ALLOWED_CONTENT_TYPES = ['application/csp-report', 'application/json'];
const MAX_BODY_BYTES = 8 * 1024; // CSP reports are small JSON objects; generous but bounded.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_PER_WINDOW = 20;
/** Hard ceiling on distinct IPs tracked at once, so a flood from many
 * different addresses can't grow this map without bound on a long-lived
 * warm instance. Best-effort only — see rateLimited() below. */
const MAX_TRACKED_IPS = 5000;

// In-memory, per-instance, best-effort. Vercel serverless functions are
// not guaranteed to share memory across invocations or instances, so this
// is not a strict global rate limit — but it meaningfully bounds abuse
// from any single warm instance, and a persistent store (Redis, etc.)
// would be disproportionate infrastructure for a Report-Only observation
// endpoint that holds no sensitive data and is explicitly out of scope
// here.
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  if (hits.size >= MAX_TRACKED_IPS && !hits.has(ip)) hits.clear();
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX_PER_WINDOW;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'unknown';
}

/** Strips C0/C1 control characters (including \n, \r, \t) so a crafted
 * field value can never forge additional log lines or otherwise corrupt
 * the structured log entry it ends up in. */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
}

function safeString(value: unknown, maxLen = 300): string | null {
  if (typeof value !== 'string' || !value) return null;
  return stripControlChars(value).slice(0, maxLen);
}

function safeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Keeps only origin + pathname from a reported URL — query strings and
 * fragments are dropped unconditionally, since they could carry
 * incidental sensitive data (tokens, identifiers) that has no diagnostic
 * value for a CSP violation. Falls back to a bounded, sanitized string for
 * the non-URL values CSP sometimes reports (e.g. "inline", "eval"). */
function redactUrl(value: unknown): string | null {
  const str = safeString(value, 2000);
  if (!str) return null;
  try {
    const url = new URL(str);
    return `${url.origin}${url.pathname}`.slice(0, 500);
  } catch {
    return str.slice(0, 200);
  }
}

/** The only fields ever logged — everything else in the submitted report,
 * known or unknown, is discarded. Nothing here is ever echoed back in the
 * response. */
function extractAllowedFields(report: Record<string, unknown>) {
  return {
    documentUri: redactUrl(report['document-uri']),
    sourceFile: redactUrl(report['source-file']),
    blockedUri: redactUrl(report['blocked-uri']),
    violatedDirective: safeString(report['violated-directive'], 200),
    effectiveDirective: safeString(report['effective-directive'], 200),
    disposition: safeString(report['disposition'], 20),
    lineNumber: safeNumber(report['line-number']),
    columnNumber: safeNumber(report['column-number']),
    statusCode: safeNumber(report['status-code']),
  };
}

export async function POST(req: Request): Promise<Response> {
  if (rateLimited(clientIp(req))) {
    return new NextResponse(null, { status: 429 });
  }

  const contentType = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
    return new NextResponse(null, { status: 415 });
  }

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (contentLength > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  // Content-Length can be absent or spoofed — re-check the actual bytes
  // read, not just the declared header.
  if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>)['csp-report'] !== 'object' ||
    (parsed as Record<string, unknown>)['csp-report'] === null
  ) {
    return new NextResponse(null, { status: 400 });
  }

  const report = extractAllowedFields(
    (parsed as Record<string, unknown>)['csp-report'] as Record<string, unknown>
  );

  // Lands in the platform's function logs only — no Supabase, no
  // third-party monitoring vendor. Reviewed manually during the
  // observation period (see P4-E2's staged rollout plan).
  console.log('csp-report-only-violation', JSON.stringify(report));

  return new NextResponse(null, { status: 204 });
}
