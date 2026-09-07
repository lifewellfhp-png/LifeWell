/**
 * Test-hardening for Paubox success-response parsing and provider_message_id
 * persistence (Paubox response parsing test hardening task).
 *
 * Prior investigation (this session) confirmed the current parser in
 * sendViaPauboxApi() matches the OFFICIAL Paubox documentation for the exact
 * endpoint this codebase calls (POST https://api.paubox.com/v1/email/messages):
 *
 *   https://docs.paubox.com/email-api/messages.md
 *
 * Documented success response (quoted verbatim from that page):
 *   {
 *     "sourceTrackingId": "3d38ab13-0af8-4028-bd45-52e882e0d584",
 *     "customHeaders": { "X-Custom-Header": "value" },
 *     "data": "Service OK"
 *   }
 *
 * No test anywhere in this repository previously exercised the REAL
 * fetch -> res.json() -> sourceTrackingId extraction path inside
 * sendViaPauboxApi() — every existing test either regex-matched source text
 * (test-paubox-rest-api-migration.mjs) or handed classifyProviderOutcome() an
 * already-parsed synthetic PauboxApiResult (test-marketing-campaign-delivery.mjs),
 * bypassing the parser itself. This file closes that gap by calling the REAL
 * sendViaPauboxApi() and classifyProviderOutcome() against a fully mocked
 * globalThis.fetch — no duplicated parser logic, no real network call.
 *
 * CRITICAL: every test in this file replaces globalThis.fetch with a local
 * stub before use and restores the original reference afterward (try/finally).
 * The real Paubox endpoint is never reachable from this file: nothing here
 * ever calls the original, saved fetch reference. Zero real Paubox calls,
 * zero real emails, zero Production Supabase calls (marketing_campaign_recipients
 * persistence is proven via a source-structure assertion on the exact update
 * payload expression, the same technique this codebase's own test suite
 * already uses for every other DB-dependent orchestration path that needs a
 * live Supabase connection this environment does not have).
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-paubox-response-parsing.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { sendViaPauboxApi } from '../src/services/email.service.js';
import { classifyProviderOutcome, FAILURE_CODES } from '../src/services/marketingCampaignDelivery.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const deliveryServiceSource = readFileSync(join(root, 'src/services/marketingCampaignDelivery.service.ts'), 'utf8');

const REAL_FETCH = globalThis.fetch;
const SYNTHETIC_RECIPIENT = { address: 'test@example.invalid' };

/** Verbatim from https://docs.paubox.com/email-api/messages.md's documented success example. */
const DOCUMENTED_SUCCESS_BODY = {
  sourceTrackingId: '3d38ab13-0af8-4028-bd45-52e882e0d584',
  customHeaders: { 'X-Custom-Header': 'value' },
  data: 'Service OK',
};

function mockFetchOnce(impl) {
  let called = false;
  globalThis.fetch = async (...args) => {
    called = true;
    return impl(...args);
  };
  return () => called;
}

function jsonResponse(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH;
}

// --- 1-2. Documented success response: recognized + identifier extracted --------

test('1. the documented Paubox success response is recognized as a successful send (real sendViaPauboxApi, mocked fetch)', async () => {
  const wasCalled = mockFetchOnce(async () => jsonResponse(200, DOCUMENTED_SUCCESS_BODY));
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(wasCalled(), true, 'expected sendViaPauboxApi to call the mocked fetch');
    assert.equal(result.ok, true);
    assert.equal(result.httpStatus, 200);
  } finally {
    restoreFetch();
  }
});

test('2. the documented tracking identifier is extracted exactly, unmodified', async () => {
  mockFetchOnce(async () => jsonResponse(200, DOCUMENTED_SUCCESS_BODY));
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(result.sourceTrackingId, DOCUMENTED_SUCCESS_BODY.sourceTrackingId);
    assert.equal(result.sourceTrackingId, '3d38ab13-0af8-4028-bd45-52e882e0d584');
  } finally {
    restoreFetch();
  }
});

// --- 3-4. classifyProviderOutcome maps it to provider_message_id, unmodified ----

test('3. classifyProviderOutcome maps the REAL sendViaPauboxApi result to provider_message_id', async () => {
  mockFetchOnce(async () => jsonResponse(200, DOCUMENTED_SUCCESS_BODY));
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    const outcome = classifyProviderOutcome(result);
    assert.equal(outcome.status, 'sent');
    assert.equal(outcome.provider_message_id, DOCUMENTED_SUCCESS_BODY.sourceTrackingId);
  } finally {
    restoreFetch();
  }
});

test('4. provider_message_id is not transformed/truncated — proven end-to-end with the task\'s own synthetic id "test-source-tracking-id-123"', async () => {
  const SYNTHETIC_ID = 'test-source-tracking-id-123';
  mockFetchOnce(async () => jsonResponse(200, { sourceTrackingId: SYNTHETIC_ID, data: 'Service OK' }));
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    const outcome = classifyProviderOutcome(result);
    // Exact match — not just truthy/non-empty. Catches truncation, case
    // folding, whitespace trimming, or any other silent transformation.
    assert.equal(result.sourceTrackingId, SYNTHETIC_ID);
    assert.equal(outcome.provider_message_id, SYNTHETIC_ID);
    assert.equal(outcome.provider_message_id.length, SYNTHETIC_ID.length);
  } finally {
    restoreFetch();
  }
});

// --- 5. The exact persistence line maps outcome.provider_message_id unmodified -
// (source-structure proof — initiateCampaignSend() needs a live Supabase
// connection to execute at all, which this environment does not have; this
// matches the established technique used throughout this codebase's own test
// suite for every other DB-dependent orchestration path.)

test('5. the recipient-row update persists outcome.provider_message_id with only a `?? null` fallback — no other transformation', () => {
  const sentBranchStart = deliveryServiceSource.indexOf("if (outcome.status === 'sent') {");
  assert.ok(sentBranchStart > -1, 'expected to find the sent-outcome branch');
  const sentBranchEnd = deliveryServiceSource.indexOf('result.sent += 1;', sentBranchStart);
  const sentBranch = deliveryServiceSource.slice(sentBranchStart, sentBranchEnd);
  assert.match(sentBranch, /provider_message_id:\s*outcome\.provider_message_id\s*\?\?\s*null/);
  // No string transformation method is ever applied to the identifier before
  // it reaches the update payload.
  for (const method of ['.trim(', '.slice(', '.substring(', '.toLowerCase(', '.toUpperCase(', '.replace(']) {
    assert.doesNotMatch(sentBranch, new RegExp(`outcome\\.provider_message_id${method.replace('.', '\\.')}`.replace(/[()]/g, '\\$&')));
  }
});

// --- 6. Successful response with no identifier: current intended behavior ------
// This test documents and locks in CURRENT behavior — it does not assert
// this SHOULD change. This is the exact mechanism behind the 24 historical
// Labor Day rows: a genuine HTTP success with no sourceTrackingId in the
// body still completes as 'sent', with provider_message_id left null.

test('6. a successful HTTP response with no tracking identifier still resolves ok:true, sourceTrackingId undefined — not a crash, not a failure', async () => {
  mockFetchOnce(async () => jsonResponse(200, { data: 'Service OK' }));
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(result.ok, true);
    assert.equal(result.sourceTrackingId, undefined);
    const outcome = classifyProviderOutcome(result);
    assert.equal(outcome.status, 'sent');
    assert.equal(outcome.provider_message_id, undefined);
    // The exact `?? null` fallback this codebase already relies on (test 5)
    // is what turns this `undefined` into the null column value observed in
    // the historical rows — reproduced here deliberately, not asserted as
    // something to fix.
    assert.equal(outcome.provider_message_id ?? null, null);
  } finally {
    restoreFetch();
  }
});

// --- 7. Non-2xx remains a failure -------------------------------------------------

test('7. a non-2xx Paubox response remains classified as a definite failure (provider_rejected)', async () => {
  mockFetchOnce(async () => jsonResponse(422, { error: 'Unprocessable' }));
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 422);
    assert.equal(result.errorMessage, 'Paubox API responded 422');
    assert.equal(result.sourceTrackingId, undefined);
    const outcome = classifyProviderOutcome(result);
    assert.deepEqual(outcome, { status: 'failed', failure_code: FAILURE_CODES.PROVIDER_REJECTED });
  } finally {
    restoreFetch();
  }
});

// --- 8. Network exception is normalized, never thrown ----------------------------

test('8. a network exception is caught and normalized to ok:false, httpStatus:0 — never an unhandled rejection', async () => {
  globalThis.fetch = async () => {
    throw new Error('getaddrinfo ENOTFOUND api.paubox.com');
  };
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 0);
    assert.equal(result.errorMessage, 'Paubox API network error');
    const outcome = classifyProviderOutcome(result);
    assert.deepEqual(outcome, { status: 'failed', failure_code: FAILURE_CODES.TIMEOUT_AMBIGUOUS });
  } finally {
    restoreFetch();
  }
});

// --- 9. Timeout (AbortError) is classified distinctly, still ambiguous -----------

test('9. a timeout (AbortError) is normalized with its own message, and still classifies as ambiguous, never a definite rejection', async () => {
  globalThis.fetch = async () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(result.ok, false);
    assert.equal(result.httpStatus, 0);
    assert.equal(result.errorMessage, 'Paubox API request timed out');
    const outcome = classifyProviderOutcome(result);
    assert.equal(outcome.failure_code, FAILURE_CODES.TIMEOUT_AMBIGUOUS);
    assert.notEqual(outcome.failure_code, FAILURE_CODES.PROVIDER_REJECTED);
  } finally {
    restoreFetch();
  }
});

// --- 10. Non-JSON / empty success body does not throw ----------------------------

test('10. a 200 response with a non-JSON/empty body does not throw — ok stays true, sourceTrackingId stays undefined', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected end of JSON input');
    },
  });
  try {
    const result = await sendViaPauboxApi({ to: SYNTHETIC_RECIPIENT, subject: 'Test', text: 'Test', html: '<p>Test</p>' });
    assert.equal(result.ok, true);
    assert.equal(result.httpStatus, 200);
    assert.equal(result.sourceTrackingId, undefined);
  } finally {
    restoreFetch();
  }
});

// --- 11. Zero real network calls from this file -----------------------------------

test('11. globalThis.fetch is restored to the real implementation after every test in this file — no test leaves the mock installed', () => {
  // Every test above installs its own stub (mockFetchOnce or a direct
  // globalThis.fetch assignment) before calling sendViaPauboxApi, and each
  // one asserts on the result that only makes sense if its own stub was
  // actually hit (test 1's wasCalled() check, the specific ok/httpStatus/
  // sourceTrackingId/errorMessage values in tests 2-10 that only a stub
  // could produce). This final check confirms the real fetch reference is
  // back in place now that every test has run — combined with the
  // try/finally around each one, that's the guarantee no test in this file
  // ever reached the real network.
  assert.equal(globalThis.fetch, REAL_FETCH);
});
