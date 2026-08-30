/**
 * Structured, allowlist-based video embed resolution (P4-E3).
 *
 * Replaces trusting admin-supplied raw embed HTML. Every value here is
 * derived from parsing a URL with the platform `URL` class (never string
 * concatenation or regex-based HTML handling) and matched against a strict
 * allowlist of hosts and ID shapes. Only a validated, alphanumeric video ID
 * is ever interpolated into an iframe `src` — nothing user-supplied is ever
 * rendered as HTML.
 */

const YOUTUBE_ID_RE = /^[\w-]{6,15}$/;
const VIMEO_ID_RE = /^\d{6,12}$/;
const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
const VIMEO_HOSTS = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com']);

/** Parses `raw` as an absolute HTTPS URL, or returns null. Rejects
 * javascript:/data:/blob:/protocol-relative/malformed input by construction
 * — `new URL()` throws on anything that isn't a well-formed absolute URL,
 * and the protocol check excludes every non-https scheme explicitly. */
function safeHttpsUrl(raw: string | null | undefined): URL | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function extractYouTubeId(raw: string | null | undefined): string | null {
  const url = safeHttpsUrl(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  let id: string | null = null;
  if (host === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] || null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else if (url.pathname.startsWith('/embed/')) {
    id = url.pathname.slice('/embed/'.length).split('/')[0] || null;
  } else if (url.pathname.startsWith('/shorts/')) {
    id = url.pathname.slice('/shorts/'.length).split('/')[0] || null;
  }
  return id && YOUTUBE_ID_RE.test(id) ? id : null;
}

export function extractVimeoId(raw: string | null | undefined): string | null {
  const url = safeHttpsUrl(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase();
  if (!VIMEO_HOSTS.has(host)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  const id = segments[segments.length - 1];
  return id && VIMEO_ID_RE.test(id) ? id : null;
}

/** True only for a well-formed https:// URL — used for the `file` provider,
 * where the URL becomes a <video src>, not an iframe. */
export function isSafeHttpsUrl(raw: string | null | undefined): boolean {
  return safeHttpsUrl(raw) !== null;
}

/**
 * Returns the URL's canonical, re-serialized form (`URL.prototype.href`) if
 * it's a well-formed https:// URL, or null otherwise — never the raw input
 * string. Re-serializing (rather than passing the original string through)
 * percent-encodes anything that doesn't belong in a URL component, so a
 * value crafted to look like it "spills out" of the URL (e.g. an
 * unescaped `">` after a query parameter) is normalized into an inert,
 * fully-encoded string before it's ever used as an href/src.
 */
function canonicalHttpsUrl(raw: string | null | undefined): string | null {
  const url = safeHttpsUrl(raw);
  return url ? url.href : null;
}

export type ResolvedVideoEmbed =
  | { kind: 'youtube'; id: string }
  | { kind: 'vimeo'; id: string }
  | { kind: 'file'; url: string }
  /** `url` is null unless it independently passed the same https-only
   * check — an <a href> is not automatically safe just because it isn't
   * rendered as an iframe; React does not block `javascript:` hrefs, so
   * this must be validated too, not just the iframe/video paths. */
  | { kind: 'link'; url: string | null };

/**
 * Resolves a stored (provider, url) pair to a safe, structured render plan.
 * `provider` is a hint, not a trust boundary — every branch independently
 * re-validates the URL, so a mislabeled or legacy `provider` value (e.g. the
 * generic "embed" option) can never cause anything unsafe to render; it
 * just falls through to the plain outbound-link fallback.
 */
export function resolveVideoEmbed(provider: string | null | undefined, url: string | null | undefined): ResolvedVideoEmbed {
  const youtubeId = extractYouTubeId(url);
  if (youtubeId) return { kind: 'youtube', id: youtubeId };

  const vimeoId = extractVimeoId(url);
  if (vimeoId) return { kind: 'vimeo', id: vimeoId };

  if (provider === 'file') {
    const fileUrl = canonicalHttpsUrl(url);
    if (fileUrl) return { kind: 'file', url: fileUrl };
  }

  return { kind: 'link', url: canonicalHttpsUrl(url) };
}
