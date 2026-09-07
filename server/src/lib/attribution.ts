/**
 * Phase 8 P3-1: shared, privacy-minimized attribution normalization for
 * conversion events.
 *
 * `device` is already a closed enum (mobile/tablet/desktop/unknown),
 * identical to analytics_events.device — validated entirely by
 * conversionIngestSchema's z.enum(), no further normalization needed here.
 *
 * `referrer_host` is the one field that needs real, defensive normalization:
 * this is a PUBLIC, unauthenticated endpoint, so the submitted value cannot
 * be trusted just because a well-behaved client would have already extracted
 * a clean hostname. normalizeReferrerHost() is the server-side trust
 * boundary — it independently re-validates whatever string arrives,
 * regardless of what the client claims to have sent.
 *
 * Rules (see the Phase 8 P3-1 task for the full specification):
 *   - Never accept a full URL — only a bare hostname. A path, query string,
 *     fragment, credentials, or port anywhere in the value is rejected
 *     outright (not stripped/truncated) rather than silently cleaned.
 *   - Parsed using the real URL constructor, not fragile string splitting.
 *   - Lowercased; a single trailing dot is stripped.
 *   - Rejected to null if empty, non-string, contains any character outside
 *     the conservative hostname charset, or exceeds MAX_HOST_LENGTH (253 —
 *     the standard maximum DNS hostname length, not an arbitrary guess).
 *   - Never logged, never echoed in an error message, never combined with
 *     any other request data.
 */

const MAX_HOST_LENGTH = 253;

/**
 * A conservative pre-filter, checked before any URL parsing is attempted.
 * Real hostnames (including IDNA/punycode forms like `xn--...`) only ever
 * use letters, digits, dots, and hyphens. This also closes a real gap in
 * naive URL-based validation: the WHATWG URL parser silently *strips*
 * embedded control characters (e.g. `\n`, `\t`) from a URL instead of
 * rejecting them, which would otherwise let a value with hidden control
 * characters slip through disguised as a clean host.
 */
const HOSTNAME_CHARSET_RE = /^[a-zA-Z0-9.-]+$/;

/**
 * Phase 8 P3-UTM-1: shared, privacy-safe normalization for the three
 * captured UTM fields (utm_source/utm_medium/utm_campaign) on page_view
 * events — the same untrusted-public-input trust boundary as
 * normalizeReferrerHost() above, since this is a public, unauthenticated
 * endpoint and the client is never trusted to have already sent a clean
 * value.
 *
 * Reject-to-null, never strip-and-keep: an unsafe value becomes null
 * (the page_view event still records, just without that one optional
 * attribution field) rather than a silently mutated, misleading partial
 * value. Matches analyticsIngestSchema's own max(120) bound; lowercased so
 * "Google"/"google" never fragment aggregation; a conservative
 * letters/digits/hyphen/underscore/period charset — deliberately narrower
 * than normalizeReferrerHost's hostname charset (no dots-as-hostname-only
 * concerns here, but no space/@/slash/colon/control characters either,
 * which is exactly what would let an email address, a path, or a
 * clinical-sounding free-text string slip in as a "campaign name").
 */
const MAX_UTM_LENGTH = 120;
const UTM_CHARSET_RE = /^[a-z0-9._-]+$/;

export function normalizeUtmValue(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_UTM_LENGTH) return null;
  const lowered = trimmed.toLowerCase();
  if (!UTM_CHARSET_RE.test(lowered)) return null;
  return lowered;
}

export function normalizeReferrerHost(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_HOST_LENGTH) return null;
  if (!HOSTNAME_CHARSET_RE.test(trimmed)) return null;

  let parsed: URL;
  try {
    // Reconstructed as an https:// URL so the real URL parser validates
    // hostname syntax — if `trimmed` were anything but a bare host (a path,
    // query, fragment, credentials, or port), the checks below reject it.
    parsed = new URL(`https://${trimmed}`);
  } catch {
    return null;
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') return null;
  if (parsed.search || parsed.hash || parsed.username || parsed.password || parsed.port) return null;

  let host = parsed.hostname.toLowerCase();
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (!host || host.length > MAX_HOST_LENGTH) return null;

  return host;
}
