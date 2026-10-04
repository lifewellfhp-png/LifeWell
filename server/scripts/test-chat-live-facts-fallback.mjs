/**
 * Regression tests for the live-with-fallback fetchers added to
 * chatFacts.ts (getInsurancePlans, getServicesList, getProviderInfo) —
 * mirrors getPsychiatricStatePricing's existing pattern. In this test
 * environment Supabase is unconfigured (no SUPABASE_URL/SERVICE_ROLE_KEY
 * set), so each fetcher's actual code path under test here is the
 * graceful-degradation branch — no network call is made.
 *
 *   npx tsx --test scripts/test-chat-live-facts-fallback.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getInsurancePlans,
  getServicesList,
  getProviderInfo,
  CHAT_INSURANCE_FALLBACK,
  CHAT_SERVICES_FALLBACK,
  CHAT_PROVIDER_FALLBACK,
} from '../src/lib/chatFacts.ts';

test('1. getInsurancePlans() degrades to CHAT_INSURANCE_FALLBACK when Supabase is unconfigured, never throws', async () => {
  const result = await getInsurancePlans();
  assert.deepEqual(result, CHAT_INSURANCE_FALLBACK);
});

test('2. getServicesList() degrades to CHAT_SERVICES_FALLBACK when Supabase is unconfigured, never throws', async () => {
  const result = await getServicesList();
  assert.deepEqual(result, CHAT_SERVICES_FALLBACK);
});

test('3. getProviderInfo() degrades to CHAT_PROVIDER_FALLBACK when Supabase is unconfigured, never throws', async () => {
  const result = await getProviderInfo();
  assert.deepEqual(result, CHAT_PROVIDER_FALLBACK);
});

test('4. all three fallback constants are non-empty — a silent empty list would make the assistant claim no insurance/services exist', () => {
  assert.ok(CHAT_INSURANCE_FALLBACK.length > 0);
  assert.ok(CHAT_SERVICES_FALLBACK.length > 0);
  assert.ok(CHAT_PROVIDER_FALLBACK.name.length > 0);
});
