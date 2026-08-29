/**
 * End-to-end persistence test: proves that editing an existing item from Admin
 * shows up on the production website AND survives the "Restore missing defaults"
 * import (which used to overwrite admin edits with hardcoded content).
 *
 * Flow:
 *   1. Login to Admin API.
 *   2. Snapshot the current insurance_plans state.
 *   3. Edit an existing service summary with a QA marker.
 *   4. Verify the marker on the public API and the live /our-services page.
 *   5. Run POST /api/admin/content/import-live.
 *   6. Verify the marker is STILL there (import must not overwrite edits).
 *   7. Verify insurance_plans is BYTE-IDENTICAL to the step-2 snapshot — the
 *      import must have zero write authority over insurance (see
 *      server/src/controllers/importLive.controller.ts; a stale hardcoded
 *      seed list previously reintroduced obsolete payer records here).
 *   8. Revert the service summary to the original text.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-admin-persistence.mjs
 */
const API = process.env.API_BASE || 'https://lifewellfhp-server.vercel.app';
const SITE = process.env.SITE_BASE || 'https://www.lifewellfhp.com';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.');
  process.exit(1);
}

const stamp = Date.now();
const marker = `[QA-EDIT-${stamp}]`;
const results = [];

function ok(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, json };
}

async function publicServiceSummary(slug) {
  const res = await api(`/api/public/content?ts=${Date.now()}`);
  const services = res.json?.data?.services ?? [];
  const row = services.find((s) => s.slug === slug);
  return row ? String(row.summary || '') : null;
}

/** Normalized, id-sorted insurance snapshot for before/after comparison. */
async function insuranceSnapshot(token) {
  const res = await api('/api/admin/insurance', { token });
  const rows = res.json?.data ?? [];
  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      sort_order: r.sort_order,
      published: r.published,
      self_pay: r.self_pay,
      logo_url: r.logo_url,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

const login = await api('/api/admin/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
});
const token = login.json?.data?.token;
ok('admin login', login.status === 200 && Boolean(token), `status ${login.status}`);
if (!token) process.exit(1);

const list = await api('/api/admin/services', { token });
const services = list.json?.data ?? [];
const target = services.find((s) => s.slug && s.summary);
ok('found existing service', Boolean(target), target?.slug || 'none');
if (!target) process.exit(1);

const original = String(target.summary);
const edited = `${original} ${marker}`;

const patch = await api(`/api/admin/services/${target.id}`, {
  method: 'PATCH',
  token,
  body: { summary: edited },
});
ok('edit existing service', patch.status === 200, `status ${patch.status}`);

await new Promise((r) => setTimeout(r, 4000));

const afterEdit = await publicServiceSummary(target.slug);
ok('edit visible on public API', Boolean(afterEdit && afterEdit.includes(marker)));

const pageHtml = await fetch(`${SITE}/our-services?qa=${stamp}`, {
  headers: { 'Cache-Control': 'no-cache' },
}).then((r) => r.text());
ok('edit visible on live website', pageHtml.includes(marker));

const insuranceBefore = await insuranceSnapshot(token);

const imp = await api('/api/admin/content/import-live', { method: 'POST', token });
ok('run restore-defaults import', imp.status === 200, imp.json?.message || `status ${imp.status}`);
ok('import response has no insurance key', !('insurance' in (imp.json?.data ?? {})), JSON.stringify(imp.json?.data));

await new Promise((r) => setTimeout(r, 3000));

const afterImport = await publicServiceSummary(target.slug);
ok(
  'edit SURVIVED the import (no overwrite)',
  Boolean(afterImport && afterImport.includes(marker)),
  afterImport === null ? 'service missing!' : afterImport.includes(marker) ? 'marker intact' : 'marker LOST'
);

const insuranceAfter = await insuranceSnapshot(token);
const insuranceUnchanged = JSON.stringify(insuranceBefore) === JSON.stringify(insuranceAfter);
ok(
  'import-live did NOT mutate insurance_plans',
  insuranceUnchanged,
  insuranceUnchanged
    ? `${insuranceAfter.length} rows unchanged`
    : `MISMATCH: before=${insuranceBefore.length} rows, after=${insuranceAfter.length} rows`
);

const revert = await api(`/api/admin/services/${target.id}`, {
  method: 'PATCH',
  token,
  body: { summary: original },
});
ok('revert service to original', revert.status === 200, `status ${revert.status}`);

const fails = results.filter((r) => !r.pass).length;
console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`} — ${results.length} checks\n`);
process.exit(fails === 0 ? 0 : 1);
