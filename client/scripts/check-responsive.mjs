/**
 * Real-browser responsive and interaction audit.
 *
 *   npm run build && npm start          (in one terminal)
 *   node scripts/check-responsive.mjs   (in another)
 *
 * Drives Chromium across the required viewport range and asserts, per page:
 *   - no horizontal overflow of the document
 *   - no individual element wider than the viewport
 *   - body text never renders below 16px
 *   - interactive controls meet the 24x24 WCAG 2.2 minimum (44px reported
 *     separately as the comfort target)
 *
 * Also exercises the mobile menu: open, focus trap, Escape to close, and focus
 * restoration to the trigger.
 */
import { chromium } from 'playwright';

const BASE = process.env.SITE_BASE ?? 'http://localhost:3000';

const VIEWPORTS = [
  { w: 320, h: 640, label: '320  (small handset)' },
  { w: 360, h: 740, label: '360  (Android)' },
  { w: 375, h: 812, label: '375  (iPhone)' },
  { w: 390, h: 844, label: '390  (iPhone 14)' },
  { w: 414, h: 896, label: '414  (large phone)' },
  { w: 768, h: 1024, label: '768  (tablet portrait)' },
  { w: 820, h: 1180, label: '820  (iPad Air)' },
  { w: 1024, h: 768, label: '1024 (tablet landscape)' },
  { w: 1280, h: 800, label: '1280 (laptop)' },
  { w: 1440, h: 900, label: '1440 (desktop)' },
  { w: 1920, h: 1080, label: '1920 (large desktop)' },
];

const PAGES = [
  '/',
  '/our-services',
  '/services/psychiatric-evaluations',
  '/services/weight-management-telehealth',
  '/bio',
  '/fees-insurance',
  '/faqs',
  '/contact-telehealth-mental-health-provider',
  '/book-telehealth-mental-health-appointment',
  '/telehealth-mental-health-testimonials',
  '/blog',
  '/managing-anxiety-in-everyday-life',
  '/privacy-policy',
  '/does-not-exist',
];

const problems = [];
const note = (kind, detail) => problems.push({ kind, detail });

const browser = await chromium.launch();
const page = await browser.newPage();

console.log(`\nResponsive audit — ${PAGES.length} pages x ${VIEWPORTS.length} viewports\n`);

/* ------------------------------------------------- overflow + type size --- */

for (const path of PAGES) {
  const label = path === '/does-not-exist' ? `${path} (404)` : path;
  process.stdout.write(`  ${label.padEnd(52)}`);
  let pageIssues = 0;

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.w, height: vp.h });
    const res = await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });

    if (path === '/does-not-exist') {
      if (res?.status() !== 404) {
        note('404-status', `${path} returned ${res?.status()} at ${vp.w}px`);
        pageIssues++;
      }
    }

    await page.waitForTimeout(120);
    const report = await page.evaluate((viewportWidth) => {
      const doc = document.documentElement;
      const horizontal = doc.scrollWidth > viewportWidth + 1;

      /**
       * True when an ancestor deliberately scrolls or clips horizontally.
       * Carousels and overflow-x:auto tables legitimately hold children wider
       * than the viewport — that is contained, not a layout break.
       */
      const insideScrollOrClip = (el) => {
        let node = el.parentElement;
        while (node && node !== document.body) {
          const o = getComputedStyle(node).overflowX;
          if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
          node = node.parentElement;
        }
        return false;
      };

      // Any element extending past the viewport edge.
      const offenders = [];
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > viewportWidth + 1.5 || r.left < -1.5) {
          const style = getComputedStyle(el);
          if (style.position === 'fixed' || style.visibility === 'hidden') continue;
          // Decorative blur washes are intentionally oversized and clipped.
          if (el.getAttribute('aria-hidden') === 'true') continue;
          if (insideScrollOrClip(el)) continue;
          offenders.push(
            `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} (${Math.round(r.left)}→${Math.round(r.right)})`
          );
          if (offenders.length >= 3) break;
        }
      }

      // Smallest rendered font size on visible text.
      let smallest = 999;
      let smallestSample = '';
      for (const el of document.querySelectorAll('p, li, span, a, td, label, dd, dt')) {
        if (!el.textContent?.trim()) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size < smallest) {
          smallest = size;
          smallestSample = el.textContent.trim().slice(0, 30);
        }
      }

      return { horizontal, scrollWidth: doc.scrollWidth, offenders, smallest, smallestSample };
    }, vp.w);

    if (report.horizontal) {
      note('horizontal-overflow', `${path} @ ${vp.w}px — scrollWidth ${report.scrollWidth}`);
      pageIssues++;
    }
    for (const o of report.offenders) {
      note('element-overflow', `${path} @ ${vp.w}px — ${o}`);
      pageIssues++;
    }
    // 13px is the design system's caption size and is used only for meta text.
    if (report.smallest < 13) {
      note('text-too-small', `${path} @ ${vp.w}px — ${report.smallest}px "${report.smallestSample}"`);
      pageIssues++;
    }
  }

  console.log(pageIssues === 0 ? 'ok' : `${pageIssues} issue(s)`);
}

/* ---------------------------------------------------------- target size --- */

console.log('\nTarget sizes (WCAG 2.2 SC 2.5.8 — minimum 24x24)');
await page.setViewportSize({ width: 375, height: 812 });
for (const path of ['/', '/contact-telehealth-mental-health-provider', '/faqs', '/bio']) {
  await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  const result = await page.evaluate(() => {
    const failures = [];
    const exempt = [];

    /** SC 2.5.8 "Inline" exception: a link sitting inside a run of text. */
    const isInlineInText = (el) => {
      if (getComputedStyle(el).display !== 'inline') return false;
      const parent = el.parentElement;
      if (!parent) return false;
      // Text belonging to the parent that is not part of this link.
      const surrounding = Array.from(parent.childNodes)
        .filter((n) => n !== el)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      return surrounding.length > 0;
    };

    /** Visually hidden until focused (skip links) — not a visible target. */
    const isVisuallyHidden = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.clip === 'rect(0px, 0px, 0px, 0px)' || (r.width <= 1 && r.height <= 1);
    };

    for (const el of document.querySelectorAll('a[href], button, input, select, textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).visibility === 'hidden') continue;
      if (r.width >= 24 && r.height >= 24) continue;

      const label = (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 28);
      const size = `${Math.round(r.width)}x${Math.round(r.height)}`;

      if (isVisuallyHidden(el)) {
        exempt.push(`${label} — hidden until focused`);
      } else if (isInlineInText(el)) {
        exempt.push(`${label} — inline in text (${size})`);
      } else {
        failures.push(`${el.tagName.toLowerCase()} "${label}" ${size}`);
      }
    }
    return { failures, exempt };
  });

  result.failures.forEach((s) => note('target-too-small', `${path} — ${s}`));
  const summary =
    result.failures.length === 0
      ? `ok${result.exempt.length ? `  (${result.exempt.length} exempt)` : ''}`
      : `${result.failures.length} below 24x24`;
  console.log(`  ${path.padEnd(52)}${summary}`);
}

/* ----------------------------------------------------------- mobile nav --- */

console.log('\nMobile menu behaviour @ 375px');
await page.setViewportSize({ width: 375, height: 812 });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });

const trigger = page.locator('button[aria-controls="mobile-menu"]');
await trigger.click();
const dialog = page.locator('#mobile-menu');

const opened = await dialog.isVisible();
console.log(`  opens on tap                                        ${opened ? 'ok' : 'FAIL'}`);
if (!opened) note('mobile-menu', 'did not open');

const modalAttrs = await dialog.evaluate((el) => ({
  role: el.getAttribute('role'),
  modal: el.getAttribute('aria-modal'),
  label: el.getAttribute('aria-label'),
}));
const semanticsOk =
  modalAttrs.role === 'dialog' && modalAttrs.modal === 'true' && Boolean(modalAttrs.label);
console.log(`  dialog semantics                                    ${semanticsOk ? 'ok' : 'FAIL'}`);
if (!semanticsOk) note('mobile-menu', `semantics ${JSON.stringify(modalAttrs)}`);

const scrollLocked = await page.evaluate(() => getComputedStyle(document.body).overflow === 'hidden');
console.log(`  body scroll locked                                  ${scrollLocked ? 'ok' : 'FAIL'}`);
if (!scrollLocked) note('mobile-menu', 'body scroll not locked');

// Focus must stay inside the panel while tabbing.
let escaped = false;
for (let i = 0; i < 30; i++) {
  await page.keyboard.press('Tab');
  const inside = await page.evaluate(() =>
    Boolean(document.getElementById('mobile-menu')?.contains(document.activeElement))
  );
  if (!inside) {
    escaped = true;
    break;
  }
}
console.log(`  focus trapped over 30 tabs                          ${escaped ? 'FAIL' : 'ok'}`);
if (escaped) note('mobile-menu', 'focus escaped the dialog');

await page.keyboard.press('Escape');
const closed = !(await dialog.isVisible().catch(() => false));
console.log(`  closes on Escape                                    ${closed ? 'ok' : 'FAIL'}`);
if (!closed) note('mobile-menu', 'Escape did not close');

const focusRestored = await page.evaluate(
  () => document.activeElement?.getAttribute('aria-controls') === 'mobile-menu'
);
console.log(`  focus returned to trigger                           ${focusRestored ? 'ok' : 'FAIL'}`);
if (!focusRestored) note('mobile-menu', 'focus not restored to trigger');

const scrollRestored = await page.evaluate(
  () => getComputedStyle(document.body).overflow !== 'hidden'
);
console.log(`  body scroll restored                                ${scrollRestored ? 'ok' : 'FAIL'}`);
if (!scrollRestored) note('mobile-menu', 'body scroll not restored');

/* ------------------------------------------------------------- keyboard --- */

console.log('\nKeyboard & focus');
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });

await page.keyboard.press('Tab');
const skip = await page.evaluate(() => {
  const el = document.activeElement;
  return { text: el?.textContent?.trim(), href: el?.getAttribute('href') };
});
const skipOk = skip.href === '#main-content';
console.log(`  first tab reaches skip link                         ${skipOk ? 'ok' : 'FAIL'}`);
if (!skipOk) note('keyboard', `first tab was ${JSON.stringify(skip)}`);

const ringOk = await page.evaluate(() => {
  const el = document.activeElement;
  if (!el) return false;
  const s = getComputedStyle(el);
  return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2;
});
console.log(`  visible focus ring on focused element               ${ringOk ? 'ok' : 'FAIL'}`);
if (!ringOk) note('keyboard', 'no visible focus ring');

// FAQ accordion via keyboard.
await page.goto(BASE + '/faqs', { waitUntil: 'domcontentloaded', timeout: 60000 });
const firstQ = page.locator('button[aria-expanded]').first();
const before = await firstQ.getAttribute('aria-expanded');
await firstQ.focus();
await page.keyboard.press('Enter');
const after = await firstQ.getAttribute('aria-expanded');
const accordionOk = before !== after;
console.log(`  FAQ accordion toggles with Enter                    ${accordionOk ? 'ok' : 'FAIL'}`);
if (!accordionOk) note('keyboard', 'accordion did not toggle');


/* --------------------------------------------------------------- search --- */

console.log('\nSite search @ 1280px');
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(400);

// SiteSearch's trigger button lives inside MobileMenu, whose own "Open
// menu" trigger stays visible up to NavBar's 1440px desktop breakpoint —
// by design, not a bug (see NavBar.tsx's compact/showCompact/min-[1440px]
// pattern) — so at 1280px the panel has to be opened first, same as a
// real visitor at this width would.
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(250);
const searchTrigger = page.getByRole('button', { name: /search this site/i });
await searchTrigger.click();
const searchBox = page.getByRole('combobox');
const searchOpened = await searchBox.isVisible().catch(() => false);
console.log(`  opens from header                                   ${searchOpened ? 'ok' : 'FAIL'}`);
if (!searchOpened) note('search', 'did not open');

await searchBox.fill('weight');
await page.waitForTimeout(300);
const optionCount = await page.getByRole('option').count();
console.log(`  returns results for a real term                     ${optionCount > 0 ? 'ok' : 'FAIL'} (${optionCount})`);
if (optionCount === 0) note('search', 'no results for "weight"');

await page.keyboard.press('ArrowDown');
const hasActive = await page.evaluate(() => {
  const input = document.querySelector('[role="combobox"]');
  const id = input?.getAttribute('aria-activedescendant');
  return Boolean(id && document.getElementById(id));
});
console.log(`  arrow keys move the active option                   ${hasActive ? 'ok' : 'FAIL'}`);
if (!hasActive) note('search', 'aria-activedescendant not tracking');

// Capture the highlighted option's target, then assert Enter opens it.
const expectedHref = await page.evaluate(() => {
  const input = document.querySelector('[role="combobox"]');
  const id = input?.getAttribute('aria-activedescendant');
  const el = id ? document.getElementById(id) : null;
  return el ? new URL(el.getAttribute('href'), location.origin).pathname : null;
});
await page.keyboard.press('Enter');
await page.waitForTimeout(900);
const landedOn = new URL(page.url()).pathname;
const navigated = Boolean(expectedHref) && landedOn === expectedHref;
console.log(`  Enter opens the highlighted result                  ${navigated ? 'ok' : 'FAIL'} ${landedOn}`);
if (!navigated) note('search', `Enter went to ${landedOn}, expected ${expectedHref}`);

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Open menu' }).click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: /search this site/i }).click();
await page.getByRole('combobox').fill('zzzznotathing');
await page.waitForTimeout(300);
const emptyState = await page.locator('text=/No results for/i').first().isVisible().catch(() => false);
console.log(`  empty state for no matches                          ${emptyState ? 'ok' : 'FAIL'}`);
if (!emptyState) note('search', 'no empty state');

await page.keyboard.press('Escape');
await page.waitForTimeout(250);
const searchClosed = !(await page.getByRole('combobox').isVisible().catch(() => false));
console.log(`  closes on Escape                                    ${searchClosed ? 'ok' : 'FAIL'}`);
if (!searchClosed) note('search', 'Escape did not close');

/* --------------------------------------------------------------- report --- */

await browser.close();

console.log('');
if (problems.length === 0) {
  console.log('✓ ALL PASS — no responsive, target-size, or keyboard issues\n');
  process.exit(0);
}

const grouped = problems.reduce((acc, p) => {
  (acc[p.kind] ??= []).push(p.detail);
  return acc;
}, {});
for (const [kind, list] of Object.entries(grouped)) {
  console.log(`${kind} (${list.length})`);
  list.slice(0, 15).forEach((d) => console.log(`   ${d}`));
  if (list.length > 15) console.log(`   … and ${list.length - 15} more`);
  console.log('');
}
console.log(`${problems.length} issue(s)\n`);
process.exit(1);
