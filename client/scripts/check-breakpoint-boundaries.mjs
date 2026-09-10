/**
 * Regression coverage for Phase 18/19: Tailwind v4 always emits custom
 * `--breakpoint-*` variants (desktop: 1181px) and arbitrary `min-[Npx]:`
 * variants ahead of the built-in sm/md/lg/xl/2xl group in the compiled
 * stylesheet, regardless of pixel value or source order (see the comment
 * in src/styles/globals.css). Wherever a smaller sm:/md:/lg:/xl: utility
 * shared a CSS property with desktop:/min-[1440px]:/min-[1601px]:, the
 * smaller breakpoint silently won at all wider viewports. Both phases
 * fixed every genuine collision with bounded, non-overlapping ranges
 * (e.g. sm:max-desktop:X desktop:Y). This script asserts the crossover
 * actually lands on the right side of each boundary, one pixel either way.
 *
 *   npm run build && npm start          (in one terminal)
 *   node scripts/check-breakpoint-boundaries.mjs   (in another)
 *
 * Boundaries covered: 1181 (desktop:, Phase 18), 1601 (min-[1601px]:,
 * Phase 19), and 1280 (compact <-> desktop nav switch, now the built-in
 * `xl:` breakpoint — Phase 22 replaced the JS ResizeObserver measurement
 * that previously gated this with a deterministic CSS media query), each
 * checked one pixel below, at, and one pixel above.
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync } from 'node:fs';

const BASE = process.env.SITE_BASE ?? 'http://localhost:3000';
const problems = [];
const note = (detail) => problems.push(detail);

const browser = await chromium.launch();
const page = await browser.newPage();

/** Read computed style of `selector` on `path` at viewport width `w`. */
async function styleAt(path, w, selector, props) {
  await page.setViewportSize({ width: w, height: 1000 });
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(150);
  return page.evaluate(
    ({ selector, props }) => {
      const el = document.querySelector(selector);
      if (!el) return null;
      const s = getComputedStyle(el);
      const out = {};
      for (const p of props) out[p] = s[p];
      return out;
    },
    { selector, props }
  );
}

function assertBoundary(label, results, belowExpected, aboveExpected) {
  const [below, at, above] = results;
  console.log(`  ${label.padEnd(58)}${JSON.stringify(below)} | ${JSON.stringify(at)} | ${JSON.stringify(above)}`);
  if (JSON.stringify(below) !== JSON.stringify(belowExpected)) {
    note(`${label}: one px below boundary expected ${JSON.stringify(belowExpected)}, got ${JSON.stringify(below)}`);
  }
  if (JSON.stringify(at) !== JSON.stringify(aboveExpected)) {
    note(`${label}: at boundary expected the "above" value ${JSON.stringify(aboveExpected)}, got ${JSON.stringify(at)}`);
  }
  if (JSON.stringify(above) !== JSON.stringify(aboveExpected)) {
    note(`${label}: one px above boundary expected ${JSON.stringify(aboveExpected)}, got ${JSON.stringify(above)}`);
  }
}

console.log('\n1181px boundary — desktop: (Phase 18)\n');
{
  const sel = '#insurance-heading';
  const results = [];
  for (const w of [1180, 1181, 1182]) {
    results.push(await styleAt('/', w, sel, ['fontSize']));
  }
  assertBoundary('/ #insurance-heading font-size', results, { fontSize: '48px' }, { fontSize: '56px' });
}

console.log('\n1280px boundary — compact/desktop nav switch (Phase 22)\n');
{
  // Phase 22 replaced the ResizeObserver-based compact/desktop switch
  // (Phase 20/21 — genuinely unstable, a few px of margin that varied
  // across page loads) with a plain `xl:` (1280px) CSS breakpoint: correct
  // on first paint, no JS measurement, can't oscillate. This is now a real,
  // deterministic assertion (not "informational" like the old JS-timing
  // check it replaces) — display is a pure function of viewport width.
  const sel = 'nav[aria-label="Main"]';
  const results = [];
  for (const w of [1279, 1280, 1281]) {
    results.push(await styleAt('/', w, sel, ['display']));
  }
  assertBoundary('/ nav[aria-label="Main"] display', results, { display: 'none' }, { display: 'flex' });
}

console.log('\n1601px boundary — min-[1601px]: (Phase 19)\n');
{
  const sel = 'section';
  const results = [];
  for (const w of [1600, 1601, 1602]) {
    results.push(await styleAt('/faqs', w, sel, ['paddingLeft', 'paddingRight']));
  }
  assertBoundary(
    '/faqs first <section> padding-x',
    results,
    { paddingLeft: '40px', paddingRight: '40px' },
    { paddingLeft: '80px', paddingRight: '80px' }
  );
}
{
  const sel = 'header';
  const results = [];
  for (const w of [1600, 1601, 1602]) {
    results.push(await styleAt('/', w, sel + ' > div', ['columnGap', 'paddingLeft', 'paddingTop']));
  }
  assertBoundary(
    '/ header inner row gap/padding',
    results,
    { columnGap: '20px', paddingLeft: '40px', paddingTop: '22px' },
    { columnGap: '30px', paddingLeft: '70px', paddingTop: '30px' }
  );
}
{
  const results = [];
  for (const w of [1600, 1601, 1602]) {
    results.push(await styleAt('/bio', w, 'h1', ['fontSize']));
  }
  assertBoundary('/bio h1 font-size', results, { fontSize: '56px' }, { fontSize: '62px' });
}

/* --------------------------------------------- compiled-CSS source check --- */

console.log('\n1280px boundary — nav/CTA/trigger pairs use only the built-in xl breakpoint (source check)\n');
{
  // Confirms NavBar's compact <-> desktop switch (nav, full CTA, compact
  // CTA, trigger label) uses only Tailwind's built-in `xl` breakpoint —
  // not a custom one — so it can't hit the Tailwind v4 custom-breakpoint
  // cascade-order issue fixed in Phases 18-19 (custom breakpoints sort
  // ahead of the built-in sm/md/lg/xl/2xl group regardless of pixel value;
  // built-in breakpoints don't have that problem against each other).
  const cssPath = process.env.BUILT_CSS_PATH;
  if (cssPath && existsSync(cssPath)) {
    const css = readFileSync(cssPath, 'utf-8');
    const checks = [
      { sel: '.xl\\:flex', mustContain: 'width >= 1280px' },
      { sel: '.xl\\:hidden', mustContain: 'width >= 1280px' },
    ];
    for (const c of checks) {
      const idx = css.indexOf(c.sel);
      const found = idx !== -1;
      console.log(`  ${c.sel.padEnd(40)}${found ? 'present' : 'MISSING'}`);
      if (!found) note(`compiled CSS missing selector ${c.sel}`);
    }
    // No custom --breakpoint-* or arbitrary min-[Npx]:/max-[Npx]: variant
    // should gate nav/CTA/trigger visibility anymore — only xl:.
    const staleSelectors = ['min-\\[1440px\\]', 'min-\\[1439px\\]', 'max-\\[1439px\\]', 'max-\\[1440px\\]'];
    for (const s of staleSelectors) {
      if (css.includes(s.replace(/\\\\/g, '\\'))) {
        note(`compiled CSS still contains a stale nav-switch selector fragment: ${s}`);
      }
    }
  } else {
    console.log('  BUILT_CSS_PATH not set — skipped (pass the path to the compiled layout.css to enable)');
  }
}

await browser.close();

console.log('');
if (problems.length === 0) {
  console.log('✓ ALL PASS — every checked boundary crosses on the correct pixel\n');
  process.exit(0);
}
console.log(`${problems.length} issue(s)`);
problems.forEach((p) => console.log(`   ${p}`));
console.log('');
process.exit(1);
