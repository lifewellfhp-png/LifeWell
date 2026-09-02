/**
 * End-to-end persistence test: proves that editing an existing item from Admin
 * shows up on the production website AND survives the "Restore missing defaults"
 * import (which used to overwrite admin edits with hardcoded content).
 *
 * Flow:
 *   1. Login to Admin API.
 *   2. Snapshot the current insurance_plans, faqs, and site_sections state.
 *   3. Edit an existing service summary with a QA marker.
 *   4. Verify the marker on the public API and the live /our-services page.
 *   5. Run POST /api/admin/content/import-live.
 *   6. Verify the marker is STILL there (import must not overwrite edits).
 *   7. Verify insurance_plans, faqs, and site_sections are all BYTE-IDENTICAL
 *      to the step-2 snapshots — the import must have zero write authority
 *      over insurance (see server/src/controllers/importLive.controller.ts;
 *      a stale hardcoded seed list previously reintroduced obsolete payer
 *      records here) and, per the same investigation, zero write authority
 *      over the Fees FAQ category and the homepage "benefits" section, both
 *      of which previously reseeded stale, first-person WordPress copy
 *      (including a FAQ naming "individual therapy, couples therapy" as
 *      offered service types).
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

/** Normalized, id-sorted FAQ snapshot for before/after comparison. */
async function faqSnapshot(token) {
  const res = await api('/api/admin/faqs', { token });
  const rows = res.json?.data ?? [];
  return rows
    .map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      category: r.category,
      published: r.published,
      sort_order: r.sort_order,
    }))
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

/** Normalized, id-sorted homepage-sections snapshot for before/after comparison. */
async function homeSectionsSnapshot(token) {
  const res = await api('/api/admin/sections', { token });
  const rows = res.json?.data ?? [];
  return rows
    .filter((r) => r.page_key === 'home')
    .map((r) => ({
      id: r.id,
      page_key: r.page_key,
      section_key: r.section_key,
      published: r.published,
      content: r.content,
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
const faqsBefore = await faqSnapshot(token);
const homeSectionsBefore = await homeSectionsSnapshot(token);

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

const faqsAfter = await faqSnapshot(token);
const faqsUnchanged = JSON.stringify(faqsBefore) === JSON.stringify(faqsAfter);
ok(
  'import-live did NOT mutate existing faqs rows',
  faqsUnchanged,
  faqsUnchanged
    ? `${faqsAfter.length} rows unchanged`
    : `MISMATCH: before=${faqsBefore.length} rows, after=${faqsAfter.length} rows`
);

const faqTextAfter = JSON.stringify(faqsAfter);
ok(
  'import-live did NOT reintroduce the obsolete therapy FAQ',
  !faqTextAfter.includes('individual therapy, couples therapy') &&
    !faqTextAfter.includes('How much does a telehealth therapy session cost?'),
  'obsolete Fees-category therapy wording is absent from faqs after import'
);
ok(
  'import-live did NOT reintroduce any Fees-category default FAQ',
  !faqsAfter.some((r) => r.category === 'Fees' && !faqsBefore.some((b) => b.id === r.id)),
  'no new Fees-category row appeared — Fees FAQs have zero write authority from this import'
);

const homeSectionsAfter = await homeSectionsSnapshot(token);
const homeSectionsUnchanged = JSON.stringify(homeSectionsBefore) === JSON.stringify(homeSectionsAfter);
ok(
  'import-live did NOT mutate existing home site_sections rows',
  homeSectionsUnchanged,
  homeSectionsUnchanged
    ? `${homeSectionsAfter.length} rows unchanged`
    : `MISMATCH: before=${homeSectionsBefore.length} rows, after=${homeSectionsAfter.length} rows`
);

const benefitsRowExisted = homeSectionsBefore.some((r) => r.section_key === 'benefits');
const benefitsRowAppeared = !benefitsRowExisted && homeSectionsAfter.some((r) => r.section_key === 'benefits');
ok(
  'import-live did NOT create a new "benefits" home section',
  !benefitsRowAppeared,
  benefitsRowExisted
    ? 'a benefits row already existed (Admin-managed) — untouched, as expected'
    : 'no benefits row before or after — zero write authority confirmed'
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
