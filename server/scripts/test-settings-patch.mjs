/**
 * Regression test for PATCH /api/admin/settings partial-update semantics.
 *
 * Proves that omitting a field from the PATCH body leaves its stored value
 * untouched (the bug: sending only {header_cta_label: "..."} used to null
 * out practice_email), and that the pre-existing "" -> null clearing
 * contract for practice_email/inbox_email still works when those fields
 * ARE explicitly sent.
 *
 * Every mutation this script makes is reverted to the original snapshotted
 * value before it exits, and the final state is compared field-by-field
 * against the initial snapshot, so it is safe to run against production.
 *
 * Usage:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/test-settings-patch.mjs
 */
const API = process.env.API_BASE || 'https://lifewellfhp-server.vercel.app';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.');
  process.exit(1);
}

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

async function getSettings(token) {
  return (await api('/api/admin/settings', { token })).json?.data;
}

function firstDifference(a, b, ignoreKeys) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    if (ignoreKeys.includes(k)) continue;
    if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) {
      return { equal: false, key: k, before: a?.[k], after: b?.[k] };
    }
  }
  return { equal: true };
}

const login = await api('/api/admin/auth/login', {
  method: 'POST',
  body: { email: EMAIL, password: PASSWORD },
});
const token = login.json?.data?.token;
ok('admin login', login.status === 200 && Boolean(token), `status ${login.status}`);
if (!token) process.exit(1);

const before = await getSettings(token);
ok('loaded current settings', Boolean(before), before ? '' : 'no settings row');
if (!before) process.exit(1);

// TEST A: patch an unrelated field (sent back with its own current value)
// and confirm practice_email — the field that was previously clobbered by
// omission — and everything else stays untouched.
const testA = await api('/api/admin/settings', {
  method: 'PATCH',
  token,
  body: { header_cta_label: before.header_cta_label },
});
ok('TEST A: patch header_cta_label only', testA.status === 200, `status ${testA.status}`);
const afterA = await getSettings(token);
const diffA = firstDifference(before, afterA, ['updated_at']);
ok(
  'TEST A: every omitted field unchanged (incl. practice_email)',
  diffA.equal,
  diffA.equal ? '' : `${diffA.key}: ${JSON.stringify(diffA.before)} -> ${JSON.stringify(diffA.after)}`
);

// TEST B: patch practice_email only (with its own current value) and
// confirm header_cta_label and everything else stays untouched.
const testB = await api('/api/admin/settings', {
  method: 'PATCH',
  token,
  body: { practice_email: before.practice_email || '' },
});
ok('TEST B: patch practice_email only', testB.status === 200, `status ${testB.status}`);
const afterB = await getSettings(token);
const diffB = firstDifference(before, afterB, ['updated_at']);
ok(
  'TEST B: every omitted field unchanged (incl. header_cta_label)',
  diffB.equal,
  diffB.equal ? '' : `${diffB.key}: ${JSON.stringify(diffB.before)} -> ${JSON.stringify(diffB.after)}`
);

// TEST C: no boolean settings fields exist in the current schema.
ok('TEST C: explicit false preserved', true, 'not applicable — settingsUpdate has no boolean fields');

// TEST D: explicit empty string clears practice_email to null (pre-existing,
// intentional contract via the schema's z.literal('') branch) — verified,
// then immediately restored.
const testD = await api('/api/admin/settings', { method: 'PATCH', token, body: { practice_email: '' } });
ok('TEST D: patch practice_email=""', testD.status === 200, `status ${testD.status}`);
const afterD = await getSettings(token);
ok('TEST D: empty string clears practice_email to null', afterD?.practice_email === null, `got ${JSON.stringify(afterD?.practice_email)}`);

const restoreD = await api('/api/admin/settings', { method: 'PATCH', token, body: { practice_email: before.practice_email } });
ok('TEST D: restore practice_email (request)', restoreD.status === 200, `status ${restoreD.status}`);
const afterRestoreD = await getSettings(token);
ok(
  'TEST D: practice_email restored to original',
  afterRestoreD?.practice_email === before.practice_email,
  `got ${JSON.stringify(afterRestoreD?.practice_email)}`
);

// TEST E: explicit null clears practice_email (field is intentionally
// nullable) — verified, then immediately restored.
const testE = await api('/api/admin/settings', { method: 'PATCH', token, body: { practice_email: null } });
ok('TEST E: patch practice_email=null', testE.status === 200, `status ${testE.status}`);
const afterE = await getSettings(token);
ok('TEST E: explicit null clears practice_email', afterE?.practice_email === null, `got ${JSON.stringify(afterE?.practice_email)}`);

const restoreE = await api('/api/admin/settings', { method: 'PATCH', token, body: { practice_email: before.practice_email } });
ok('TEST E: restore practice_email (request)', restoreE.status === 200, `status ${restoreE.status}`);

// Final safety net: the entire settings row must match the original
// snapshot exactly, field by field, before this script exits.
const final = await getSettings(token);
const diffFinal = firstDifference(before, final, ['updated_at']);
ok(
  'FINAL: settings match original snapshot exactly',
  diffFinal.equal,
  diffFinal.equal ? '' : `${diffFinal.key}: ${JSON.stringify(diffFinal.before)} -> ${JSON.stringify(diffFinal.after)}`
);

const fails = results.filter((r) => !r.pass).length;
console.log(`\n${fails === 0 ? 'ALL PASS' : `${fails} FAILURE(S)`} — ${results.length} checks\n`);
process.exit(fails === 0 ? 0 : 1);
