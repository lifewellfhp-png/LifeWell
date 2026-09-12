/**
 * Generated-content drift check.
 *
 * `src/data/generated/*.ts` is supposed to be reproducible output of
 * `node scripts/generate-content.mjs` run against `_source/*.json` — but
 * nothing enforced that until now. A prior hand-edit to the generated
 * output (a sitewide "we/our" voice conversion) was never back-ported to
 * source, so a later, unrelated regeneration would have silently reverted
 * approved public copy (see Phase 29's services.ts reconciliation).
 *
 * This regenerates into a scratch directory — never touching the real
 * `src/data/generated/` — and fails if that output doesn't byte-for-byte
 * match what's committed. Run it after any edit to `_source/*.json` or to
 * `generate-content.mjs` itself, and ideally in CI on every PR.
 *
 *   npm run check:drift
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REAL_OUT = join(here, '..', 'src', 'data', 'generated');
const scratchDir = mkdtempSync(join(tmpdir(), 'content-drift-'));

const FILES = ['services.ts', 'posts.ts', 'legal.ts'];

console.log('Generated-content drift check\n');
console.log(`  regenerating into: ${scratchDir}`);

const result = spawnSync(process.execPath, [join(here, 'generate-content.mjs')], {
  env: { ...process.env, GENERATED_OUT_DIR: scratchDir },
  encoding: 'utf-8',
});

if (result.status !== 0) {
  console.error('\nENVIRONMENT: generate-content.mjs failed to run.\n');
  console.error(result.stdout);
  console.error(result.stderr);
  rmSync(scratchDir, { recursive: true, force: true });
  process.exit(2);
}

// Windows checkouts with core.autocrlf=true re-materialize tracked LF blobs
// as CRLF on disk; git itself treats that as no change. Comparing raw bytes
// here would otherwise report false drift on every such file. The generator
// always writes LF, so normalize both sides before comparing content.
const normalize = (s) => s.replace(/\r\n/g, '\n');

let drifted = 0;
for (const file of FILES) {
  const committed = normalize(readFileSync(join(REAL_OUT, file), 'utf-8'));
  const fresh = normalize(readFileSync(join(scratchDir, file), 'utf-8'));
  if (committed === fresh) {
    console.log(`  PASS  ${file.padEnd(16)} matches a fresh regeneration from _source/`);
  } else {
    drifted++;
    console.log(`  FAIL  ${file.padEnd(16)} does NOT match a fresh regeneration from _source/`);
    console.log(
      `        Either _source/*.json needs the current approved copy back-ported into it,\n` +
        `        or src/data/generated/${file} has an undocumented hand-edit.\n` +
        `        Run \`node scripts/generate-content.mjs\` and inspect the diff to decide which.`
    );
  }
}

rmSync(scratchDir, { recursive: true, force: true });

console.log(
  `\n${drifted === 0 ? '✓ ALL PASS — committed generated output matches source' : `✗ ${drifted} file(s) drifted`}\n`
);
process.exit(drifted === 0 ? 0 : 1);
