/**
 * Shared site/API base-URL resolution and reachability preflight for the
 * check-*.mjs audit scripts.
 *
 * Local development's `.env.local` can point `NEXT_PUBLIC_API_URL` at an
 * unreachable local port (see client/.env.local, client/.env.example).
 * When that happens, the Next.js server silently falls back to whatever
 * static content it has, which an audit script can't tell apart from a real
 * content regression unless it checks the dependency itself. This module
 * makes that distinction explicit: it reports which URLs are under test and
 * whether each responds *before* any assertions run, so a down local
 * dependency is reported as an environment problem, never a product defect
 * — and never silently retried against production.
 */

export const SITE_BASE = process.env.SITE_BASE ?? 'http://localhost:3000';
export const API_BASE = process.env.API_BASE ?? 'http://localhost:4000';

const TIMEOUT_MS = 5000;

async function probe(base, path) {
  const target = base.replace(/\/$/, '') + path;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const start = Date.now();
  try {
    const res = await fetch(target, { signal: controller.signal, redirect: 'manual' });
    return { ok: res.status > 0 && res.status < 500, status: res.status, ms: Date.now() - start };
  } catch (err) {
    return { ok: false, status: null, ms: Date.now() - start, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reports SITE_BASE/API_BASE and probes each. Exits the process with code 2
 * (distinct from the code-1 "assertions failed" exit used by every script
 * that calls this) when a `require*` endpoint doesn't respond, so a CI log
 * or terminal never has to guess whether a red run means "the product is
 * broken" or "nobody started the local server."
 *
 * Never falls back to a different host on failure — an unreachable
 * localhost is reported and the process exits; it is not silently retried
 * against production.
 */
export async function preflight({
  requireSite = true,
  requireApi = false,
  sitePath = '/',
  apiPath = '/health',
} = {}) {
  console.log('Preflight');
  console.log(`  site: ${SITE_BASE}`);
  console.log(`  api:  ${API_BASE}`);

  const site = await probe(SITE_BASE, sitePath);
  console.log(
    `  site reachable: ${site.ok ? 'yes' : 'no'}` +
      `${site.status ? ` (${site.status}, ${site.ms}ms)` : ''}` +
      `${site.error ? ` — ${site.error}` : ''}`
  );

  let api = { ok: true };
  if (requireApi) {
    api = await probe(API_BASE, apiPath);
    console.log(
      `  api reachable:  ${api.ok ? 'yes' : 'no'}` +
        `${api.status ? ` (${api.status}, ${api.ms}ms)` : ''}` +
        `${api.error ? ` — ${api.error}` : ''}`
    );
  }
  console.log('');

  if (requireSite && !site.ok) {
    console.error(
      `ENVIRONMENT: cannot reach the site at ${SITE_BASE}.\n` +
        `This is a local test-environment problem, not a product defect.\n` +
        `Start it with \`npm run build && npm start\` in client/, or set SITE_BASE to a reachable URL.\n`
    );
    process.exit(2);
  }
  if (requireApi && !api.ok) {
    console.error(
      `ENVIRONMENT: cannot reach the API at ${API_BASE}.\n` +
        `This is a local test-environment problem, not a product defect.\n` +
        `Start it with \`npm start\` in server/, or set API_BASE to a reachable URL.\n` +
        `Never point a form-submission test (check-forms.mjs) at the production API — it issues real POSTs.\n`
    );
    process.exit(2);
  }

  return { site, api };
}

/**
 * Best-effort fetch of the public CMS payload. Returns null (never throws)
 * on any failure, so callers can treat "CMS unreachable" as "skip the
 * CMS-dependent assertion," not "the assertion failed."
 */
export async function tryFetchPublicContent(apiBase = API_BASE) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(`${apiBase.replace(/\/$/, '')}/api/public/content`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}
