/**
 * Unit tests for pingIndexNow() (src/lib/indexNow.ts) — must no-op
 * (never throw, never fetch) until INDEXNOW_API_KEY is configured, and
 * must never block/fail the caller even if the ping itself fails.
 *
 * env.ts validates process.env and freezes indexNowConfigured at module
 * load time, so "configured" vs. "not configured" can't be toggled
 * within one process after the first import — the configured-path test
 * below spawns a fresh child process with the env var set from the
 * start, same technique already used by test-admin-jwt-secret.mjs.
 *
 *   npx tsx --test scripts/test-indexnow.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

/** Writes `script` to a scratch .mjs file and runs it with tsx in a fresh
 * process — avoids Windows shell-escaping issues with multi-line `-e`
 * scripts passed through spawnSync's shell:true. */
function runInFreshProcess(script, env) {
  const scratchPath = join(__dirname, `_scratch-indexnow-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  writeFileSync(scratchPath, script, 'utf8');
  try {
    return spawnSync('npx', ['tsx', scratchPath], { cwd: root, env, encoding: 'utf8', shell: true });
  } finally {
    rmSync(scratchPath, { force: true });
  }
}

test('1. pingIndexNow never throws when not configured (no INDEXNOW_API_KEY in this test env)', async () => {
  const { pingIndexNow } = await import('../src/lib/indexNow.ts');
  await assert.doesNotReject(() => pingIndexNow(['/']));
});

test('2. pingIndexNow is a no-op (no fetch call) when not configured', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}');
  };
  try {
    const { pingIndexNow } = await import('../src/lib/indexNow.ts');
    await pingIndexNow(['/']);
    assert.equal(called, false, 'expected no fetch call when INDEXNOW_API_KEY is unset');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('3. an empty url list never calls fetch, even if otherwise configured', async () => {
  const originalFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response('{}');
  };
  try {
    const { pingIndexNow } = await import('../src/lib/indexNow.ts');
    await pingIndexNow([]);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('4. when configured (fresh process), pingIndexNow POSTs host/key/keyLocation/urlList to the real IndexNow endpoint', () => {
  const script = `
globalThis.fetch = async (url, init) => {
  console.log('CALLED', url, init.method, init.body);
  return new Response('{}');
};
const { pingIndexNow } = await import('../src/lib/indexNow.ts');
await pingIndexNow(['/fees-insurance']);
`;
  const result = runInFreshProcess(script, { ...process.env, INDEXNOW_API_KEY: 'test-only-indexnow-key-000000' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CALLED https:\/\/api\.indexnow\.org\/indexnow POST/);
  const body = JSON.parse(result.stdout.match(/CALLED \S+ POST (\{.*\})/)[1]);
  assert.equal(body.host, 'www.lifewellfhp.com');
  assert.equal(body.key, 'test-only-indexnow-key-000000');
  assert.equal(body.keyLocation, 'https://www.lifewellfhp.com/test-only-indexnow-key-000000.txt');
  assert.deepEqual(body.urlList, ['https://www.lifewellfhp.com/fees-insurance']);
});

test('5. never leaks the configured key into a thrown error or log on fetch failure', () => {
  const script = `
globalThis.fetch = async () => { throw new Error('network down'); };
const { pingIndexNow } = await import('../src/lib/indexNow.ts');
await pingIndexNow(['/']);
console.log('DONE_NO_THROW');
`;
  const result = runInFreshProcess(script, { ...process.env, INDEXNOW_API_KEY: 'test-only-indexnow-key-000000' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /DONE_NO_THROW/);
  assert.doesNotMatch(result.stdout + result.stderr, /test-only-indexnow-key-000000/);
});
