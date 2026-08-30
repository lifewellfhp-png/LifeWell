/**
 * Regression tests for admin/src/app/api/csp-report/route.ts (P4-E4).
 *
 * Calls the real POST handler directly with constructed Web Request
 * objects (Next.js Route Handlers use the standard Request/Response API,
 * so no Next.js server is needed to exercise this). Captures console.log
 * to verify exactly what gets logged — never more than the allowlisted,
 * sanitized fields, and never anything reflected back in the HTTP
 * response itself.
 *
 * No network calls, no Supabase, no production data.
 *
 *   npx tsx --test scripts/test-csp-report-endpoint.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { POST } from '../src/app/api/csp-report/route.ts';

function req({ body, contentType = 'application/csp-report', contentLength, headers = {} } = {}) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body);
  const h = new Headers({
    'content-type': contentType,
    'content-length': String(contentLength ?? Buffer.byteLength(raw, 'utf8')),
    'x-forwarded-for': '203.0.113.7',
    ...headers,
  });
  return new Request('https://lifewellfhp-admin.vercel.app/api/csp-report', {
    method: 'POST',
    headers: h,
    body: raw,
  });
}

function captureLogs(fn) {
  const original = console.log;
  const calls = [];
  console.log = (...args) => calls.push(args);
  return Promise.resolve(fn()).finally(() => {
    console.log = original;
  }).then((result) => ({ result, calls }));
}

const validReport = {
  'csp-report': {
    'document-uri': 'https://lifewellfhp-admin.vercel.app/videos?foo=bar#frag',
    'referrer': '',
    'violated-directive': 'script-src-elem',
    'effective-directive': 'script-src-elem',
    'blocked-uri': 'https://evil.example.com/x.js?token=secret123',
    'disposition': 'report',
    'line-number': 12,
    'column-number': 39,
    'source-file': 'https://lifewellfhp-admin.vercel.app/videos',
    'status-code': 200,
  },
};

test('A. a valid CSP report returns 204 with an empty body', async () => {
  const res = await POST(req({ body: validReport }));
  assert.equal(res.status, 204);
  const text = await res.text();
  assert.equal(text, '');
});

test('B. wrong content-type is rejected with 415', async () => {
  const res = await POST(req({ body: validReport, contentType: 'text/plain' }));
  assert.equal(res.status, 415);
});

test('C. a Content-Length header over the cap is rejected with 413 before the body is read', async () => {
  const res = await POST(req({ body: validReport, contentLength: 999_999 }));
  assert.equal(res.status, 413);
});

test('D. an actually-oversized body is rejected with 413 even if Content-Length lies', async () => {
  const hugeReport = {
    'csp-report': { 'document-uri': 'https://example.com/' + 'x'.repeat(20_000) },
  };
  const raw = JSON.stringify(hugeReport);
  const res = await POST(
    req({ body: raw, contentLength: 10 }) // spoofed small Content-Length
  );
  assert.equal(res.status, 413);
});

test('E. malformed JSON is rejected with 400', async () => {
  const res = await POST(req({ body: '{not valid json' }));
  assert.equal(res.status, 400);
});

test('F. valid JSON missing the csp-report key is rejected with 400', async () => {
  const res = await POST(req({ body: { hello: 'world' } }));
  assert.equal(res.status, 400);
});

test('G. rate limiting: requests beyond the per-IP window limit return 429', async () => {
  const ip = '198.51.100.42';
  let last;
  for (let i = 0; i < 25; i++) {
    last = await POST(req({ body: validReport, headers: { 'x-forwarded-for': ip } }));
  }
  assert.equal(last.status, 429);
});

test('H. rate limiting is scoped per IP, not global', async () => {
  const busyIp = '198.51.100.99';
  for (let i = 0; i < 25; i++) {
    await POST(req({ body: validReport, headers: { 'x-forwarded-for': busyIp } }));
  }
  const freshIp = '198.51.100.100';
  const res = await POST(req({ body: validReport, headers: { 'x-forwarded-for': freshIp } }));
  assert.equal(res.status, 204);
});

test('I. only allowlisted fields are logged, with query strings/fragments stripped from URLs', async () => {
  const { calls } = await captureLogs(() => POST(req({ body: validReport, headers: { 'x-forwarded-for': '203.0.113.201' } })));
  assert.equal(calls.length, 1);
  const [label, json] = calls[0];
  assert.equal(label, 'csp-report-only-violation');
  const logged = JSON.parse(json);
  assert.deepEqual(Object.keys(logged).sort(), [
    'blockedUri',
    'columnNumber',
    'disposition',
    'documentUri',
    'effectiveDirective',
    'lineNumber',
    'sourceFile',
    'statusCode',
    'violatedDirective',
  ]);
  assert.equal(logged.documentUri, 'https://lifewellfhp-admin.vercel.app/videos');
  assert.equal(logged.blockedUri, 'https://evil.example.com/x.js');
  assert.doesNotMatch(json, /token=secret123/);
  assert.doesNotMatch(json, /foo=bar/);
  assert.doesNotMatch(json, /frag/);
});

test('J. unknown/extra fields in the submitted report are never logged', async () => {
  const reportWithExtras = {
    'csp-report': {
      ...validReport['csp-report'],
      'script-sample': 'alert(document.cookie)',
      'authorization': 'Bearer fake-token-should-never-appear',
      'nested': { anything: 'goes here' },
    },
  };
  const { calls } = await captureLogs(() =>
    POST(req({ body: reportWithExtras, headers: { 'x-forwarded-for': '203.0.113.202' } }))
  );
  const json = calls[0][1];
  assert.doesNotMatch(json, /script-sample/);
  assert.doesNotMatch(json, /alert\(document\.cookie\)/);
  assert.doesNotMatch(json, /authorization/i);
  assert.doesNotMatch(json, /fake-token/);
  assert.doesNotMatch(json, /nested/);
});

test('K. control characters in field values are stripped before logging (log-injection defense)', async () => {
  const reportWithControlChars = {
    'csp-report': {
      ...validReport['csp-report'],
      'violated-directive': 'script-src-elem\ncsp-report-only-violation FORGED-ENTRY',
    },
  };
  const { calls } = await captureLogs(() =>
    POST(req({ body: reportWithControlChars, headers: { 'x-forwarded-for': '203.0.113.203' } }))
  );
  const json = calls[0][1];
  const logged = JSON.parse(json);
  assert.doesNotMatch(logged.violatedDirective, /\n/);
  assert.equal(logged.violatedDirective.includes('FORGED-ENTRY'), true); // content kept, just de-newlined
});

test('L. the response never reflects any submitted content, including on error paths', async () => {
  const inputs = [
    req({ body: '{"csp-report": "<script>alert(1)</script>"}' }),
    req({ body: 'not json at all <script>' }),
    req({ body: validReport, contentType: 'text/html' }),
  ];
  for (const r of inputs) {
    const res = await POST(r);
    const text = await res.text();
    assert.doesNotMatch(text, /script/i);
    assert.equal(text.length <= 0 || !text.includes('<'), true);
  }
});

test('M. cookies, authorization headers, and the raw request body are never part of what gets logged', async () => {
  const { calls } = await captureLogs(() =>
    POST(
      req({
        body: validReport,
        headers: {
          'x-forwarded-for': '203.0.113.204',
          cookie: 'lw_admin_token=should-never-appear',
          authorization: 'Bearer should-never-appear-either',
        },
      })
    )
  );
  const json = calls[0][1];
  assert.doesNotMatch(json, /should-never-appear/);
});
