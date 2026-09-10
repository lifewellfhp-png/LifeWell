/**
 * Header navigation regression suite (Phase 22).
 *
 * Phase 20/21 gated compact-vs-desktop nav on a client-side ResizeObserver
 * measurement; both phases found it genuinely unstable (a few px of margin
 * that varied across page loads, not a deterministic function of viewport).
 * Phase 22 replaced it with a plain `xl:` (1280px) CSS breakpoint — correct
 * on first paint, immune to hydration timing, can't oscillate — made safe
 * by removing the redundant "Home" nav entry and widening the header's own
 * container (--container-header, decoupled from the sitewide
 * --container-page). This script proves the specific properties that
 * matter for that redesign:
 *
 *   - compact nav below 1280px, full desktop nav at and above it
 *   - exactly one nav system exposed to assistive technology at a time
 *   - no overlap between logo / nav / search trigger / CTA, at any tested
 *     width (not just the boundary)
 *   - dropdowns (Services mega menu, Resources flat menu) work by both
 *     pointer and keyboard, with correct aria-expanded and focus return
 *   - the layout is stable across repeated reloads at a fixed width — no
 *     jitter between two consecutive loads
 *
 * Site-search first-attempt reliability is measured separately by
 * search-reliability-trials.mjs (large sample sizes needed for a
 * meaningful reliability number don't belong interleaved with this
 * script's structural assertions).
 *
 *   npm run build && npm start          (in one terminal)
 *   node scripts/check-nav-regression.mjs   (in another)
 */
import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE ?? 'http://localhost:3000';
const problems = [];
const note = (detail) => problems.push(detail);
const ok = (label) => console.log(`  ${label.padEnd(64)}ok`);
const fail = (label, detail) => {
  console.log(`  ${label.padEnd(64)}FAIL — ${detail}`);
  note(`${label}: ${detail}`);
};

const browser = await chromium.launch();
const page = await browser.newPage();

async function measure(w) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(250);
  return page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Main"]');
    const navVisible = nav && getComputedStyle(nav).display !== 'none';
    const trigger = document.querySelector('[aria-label="Open menu"]');
    const interactive = Array.from(document.querySelectorAll('header a[href], header button'))
      .map((el) => ({ el, fragments: Array.from(el.getClientRects()) }))
      .filter(({ fragments }) => fragments.length > 0);
    const overlapFn = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const overlaps = [];
    for (let i = 0; i < interactive.length; i++) {
      for (let j = i + 1; j < interactive.length; j++) {
        const A = interactive[i], B = interactive[j];
        if (A.el.contains(B.el) || B.el.contains(A.el)) continue;
        if (A.fragments.some((fa) => B.fragments.some((fb) => overlapFn(fa, fb)))) {
          overlaps.push(
            `${(A.el.textContent || A.el.getAttribute('aria-label') || '').trim().slice(0, 24)} x ${(B.el.textContent || B.el.getAttribute('aria-label') || '').trim().slice(0, 24)}`
          );
        }
      }
    }
    const headerNavLandmarks = Array.from(document.querySelectorAll('header nav[aria-label], [id="mobile-menu"] nav[aria-label]')).map(
      (n) => ({ label: n.getAttribute('aria-label'), exposedToAT: getComputedStyle(n).display !== 'none' })
    );
    return {
      navDisplay: navVisible ? 'desktop' : 'compact',
      triggerVisible: trigger ? getComputedStyle(trigger).display !== 'none' : false,
      overlaps,
      headerNavLandmarks,
    };
  });
}

/* ---------------------------------------- boundary + exactly-one-nav --- */

console.log('\nCompact below 1280px, full desktop nav at and above it\n');
{
  const below = await measure(1279);
  const at = await measure(1280);
  if (below.navDisplay !== 'compact') fail('1279px shows compact nav', `got ${below.navDisplay}`);
  else ok('1279px shows compact nav');
  if (at.navDisplay !== 'desktop') fail('1280px shows full desktop nav', `got ${at.navDisplay}`);
  else ok('1280px shows full desktop nav');
}

console.log('\nExactly one nav system exposed to assistive technology\n');
{
  // Desktop widths: the real <nav aria-label="Main"> is the one and only
  // header-level nav landmark, with no drawer needed.
  for (const w of [1280, 1920]) {
    const m = await measure(w);
    const exposed = m.headerNavLandmarks.filter((n) => n.exposedToAT);
    const label = `${w}px — exactly one header-level nav exposed to AT`;
    if (exposed.length === 1 && exposed[0].label === 'Main') ok(label);
    else fail(label, `${JSON.stringify(m.headerNavLandmarks)}`);
  }
  // Compact widths: with the drawer closed, MobileMenu renders null (no
  // nav landmark exists at all yet — not "hidden", genuinely absent, since
  // nothing is reachable until the trigger is activated) and the real
  // desktop <nav> is display:none. Zero exposed is the correct state here,
  // not a defect. Opening the drawer must then expose exactly the Mobile
  // landmark, with Main still correctly hidden.
  for (const w of [375, 1279]) {
    const closed = await measure(w);
    const exposedClosed = closed.headerNavLandmarks.filter((n) => n.exposedToAT);
    const closedLabel = `${w}px, drawer closed — zero header-level nav exposed (nothing reachable yet)`;
    if (exposedClosed.length === 0) ok(closedLabel);
    else fail(closedLabel, JSON.stringify(closed.headerNavLandmarks));

    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.locator('#mobile-menu').waitFor({ state: 'visible', timeout: 5000 });
    const open = await page.evaluate(() =>
      Array.from(document.querySelectorAll('header nav[aria-label], [id="mobile-menu"] nav[aria-label]')).map((n) => ({
        label: n.getAttribute('aria-label'),
        exposedToAT: getComputedStyle(n).display !== 'none',
      }))
    );
    const exposedOpen = open.filter((n) => n.exposedToAT);
    const openLabel = `${w}px, drawer open — exactly one nav exposed (Mobile)`;
    if (exposedOpen.length === 1 && exposedOpen[0].label === 'Mobile') ok(openLabel);
    else fail(openLabel, JSON.stringify(open));
  }
}

console.log('\nSearch trigger remains visible at every tested width\n');
for (const w of [375, 768, 1024, 1279, 1280, 1440, 1920, 2560, 3840]) {
  const m = await measure(w);
  const label = `${w}px — search/menu trigger visible`;
  if (m.triggerVisible) ok(label);
  else fail(label, 'trigger not visible');
}

console.log('\nNo overlap between logo, nav, search, or CTA at any tested width\n');
for (const w of [1024, 1180, 1181, 1182, 1279, 1280, 1281, 1439, 1440, 1441, 1535, 1536, 1537, 1600, 1601, 1602, 1920, 2560, 3840]) {
  const m = await measure(w);
  const label = `${w}px — no overlap`;
  if (m.overlaps.length === 0) ok(label);
  else fail(label, m.overlaps.join('; '));
}

/* --------------------------------------------------------- dropdowns --- */

console.log('\nDropdowns: pointer activation\n');
{
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(300);

  const servicesTrigger = page.getByRole('button', { name: /Services/i });
  await servicesTrigger.click();
  await page.waitForTimeout(200);
  const expandedAfterClick = await servicesTrigger.getAttribute('aria-expanded');
  const panelVisibleClick = await page.evaluate(() => {
    const p = document.querySelector('.services-mega');
    return p ? getComputedStyle(p).display !== 'none' : false;
  });
  if (expandedAfterClick === 'true' && panelVisibleClick) ok('Services mega menu opens on click');
  else fail('Services mega menu opens on click', `aria-expanded=${expandedAfterClick} panelVisible=${panelVisibleClick}`);

  // Click a link inside the panel — it should be reachable and navigable.
  const firstLink = page.locator('.services-mega a').first();
  const firstLinkVisible = await firstLink.isVisible().catch(() => false);
  if (firstLinkVisible) ok('Services mega menu panel links are visible/reachable by pointer');
  else fail('Services mega menu panel links are visible/reachable by pointer', 'no visible link found');

  // Click outside closes it.
  await page.mouse.click(10, 10);
  await page.waitForTimeout(200);
  const expandedAfterOutsideClick = await servicesTrigger.getAttribute('aria-expanded');
  if (expandedAfterOutsideClick === 'false') ok('Services mega menu closes on outside click');
  else fail('Services mega menu closes on outside click', `aria-expanded=${expandedAfterOutsideClick}`);
}

console.log('\nDropdowns: keyboard activation\n');
{
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(300);

  const resourcesTrigger = page.getByRole('button', { name: /Resources/i });
  await resourcesTrigger.focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const expandedAfterEnter = await resourcesTrigger.getAttribute('aria-expanded');
  const panelVisibleEnter = await page.evaluate(() => {
    const p = document.querySelector('.resources-dropdown');
    return p ? getComputedStyle(p).display !== 'none' : false;
  });
  if (expandedAfterEnter === 'true' && panelVisibleEnter) ok('Resources dropdown opens on Enter');
  else fail('Resources dropdown opens on Enter', `aria-expanded=${expandedAfterEnter} panelVisible=${panelVisibleEnter}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  const expandedAfterEscape = await resourcesTrigger.getAttribute('aria-expanded');
  const focusedAfterEscape = await page.evaluate(() =>
    /Resources/i.test(document.activeElement?.textContent || '')
  );
  if (expandedAfterEscape === 'false') ok('Resources dropdown closes on Escape');
  else fail('Resources dropdown closes on Escape', `aria-expanded=${expandedAfterEscape}`);
  if (focusedAfterEscape) ok('Focus returns to trigger after Escape');
  else fail('Focus returns to trigger after Escape', 'focus did not return to the Resources trigger');

  // Space also activates a native <button>.
  await resourcesTrigger.focus();
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);
  const expandedAfterSpace = await resourcesTrigger.getAttribute('aria-expanded');
  if (expandedAfterSpace === 'true') ok('Resources dropdown opens on Space');
  else fail('Resources dropdown opens on Space', `aria-expanded=${expandedAfterSpace}`);
  await page.keyboard.press('Escape');
}

/* ------------------------------------------------------- reload stability --- */

console.log('\nLayout stability across repeated reloads (1440px)\n');
{
  await page.setViewportSize({ width: 1440, height: 900 });
  const snapshots = [];
  for (let i = 0; i < 4; i++) {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(250);
    const snap = await page.evaluate(() => {
      const nav = document.querySelector('nav[aria-label="Main"]');
      const logo = document.querySelector('header a[aria-label*="LifeWell"]');
      const cta = document.querySelector('header a[href*="book-telehealth"]');
      return {
        navDisplay: nav ? getComputedStyle(nav).display : null,
        navRect: nav ? (() => { const r = nav.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })() : null,
        logoRect: logo ? (() => { const r = logo.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; })() : null,
        ctaVisible: cta ? getComputedStyle(cta).display !== 'none' : false,
      };
    });
    snapshots.push(snap);
  }
  const allIdentical = snapshots.every((s) => JSON.stringify(s) === JSON.stringify(snapshots[0]));
  if (allIdentical) ok('4 consecutive reloads produce identical nav/logo/CTA layout');
  else fail('4 consecutive reloads produce identical nav/logo/CTA layout', JSON.stringify(snapshots));
}

await browser.close();

console.log('');
if (problems.length === 0) {
  console.log('✓ ALL PASS — nav regression suite clean\n');
  process.exit(0);
}
console.log(`${problems.length} issue(s)`);
problems.forEach((p) => console.log(`   ${p}`));
console.log('');
process.exit(1);
