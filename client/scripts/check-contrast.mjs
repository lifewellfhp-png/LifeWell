/**
 * WCAG 2.2 contrast audit for the LifeWell design tokens.
 *
 * Parses the real token values out of src/styles/globals.css so this can never
 * drift from the shipped stylesheet, then asserts every foreground/background
 * pair the UI actually uses.
 *
 *   node scripts/check-contrast.mjs
 *
 * Exits non-zero on any failure so it can gate CI.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, '..', 'src', 'styles', 'globals.css'), 'utf8');

/**
 * Pull `--color-*: #rrggbb;` declarations out of the @theme block, resolving
 * one level of `var(--other-name)` indirection against every custom
 * property in the file (not just other --color-* ones — several tokens,
 * e.g. --color-brand-primary, alias root-level --lw-primary/--lw-accent
 * instead of repeating a literal hex, since the admin panel's Appearance
 * settings override those root variables). A token whose value can't be
 * resolved to a real hex color (missing, or itself an unresolved
 * reference) is left out of the map entirely — callers already treat an
 * absent key as MISSING rather than crashing on it.
 */
function readTokens(source) {
  const allVars = {};
  for (const m of source.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    allVars[m[1]] = m[2].toLowerCase();
  }
  const aliases = {};
  for (const m of source.matchAll(/--([a-z0-9-]+):\s*var\(--([a-z0-9-]+)\)\s*;/g)) {
    aliases[m[1]] = m[2];
  }

  const tokens = {};
  for (const [name, value] of Object.entries(allVars)) {
    if (name.startsWith('color-')) tokens[name.slice('color-'.length)] = value;
  }
  for (const [name, target] of Object.entries(aliases)) {
    if (!name.startsWith('color-')) continue;
    const resolved = allVars[target];
    if (resolved) tokens[name.slice('color-'.length)] = resolved;
  }
  return tokens;
}

const t = readTokens(css);

const channels = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const luminance = (h) => {
  const [r, g, b] = channels(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const WHITE = '#ffffff';

/** [description, foreground token, background token, required ratio] */
const PAIRS = [
  // Body copy — WCAG 1.4.3 normal text
  ['Body text on page background', 'text-primary', 'surface-base', 4.5],
  ['Body text on card', 'text-primary', 'surface-raised', 4.5],
  ['Body text on muted band', 'text-primary', 'surface-muted', 4.5],
  ['Secondary text on page background', 'text-secondary', 'surface-base', 4.5],
  ['Secondary text on card', 'text-secondary', 'surface-raised', 4.5],
  ['Secondary text on muted band', 'text-secondary', 'surface-muted', 4.5],
  ['Inline link on page background', 'text-link', 'surface-base', 4.5],
  ['Inline link on card', 'text-link', 'surface-raised', 4.5],

  // Controls — label text on solid fills
  ['Button label on primary fill', 'text-inverse', 'brand-primary-solid', 4.5],
  ['Button label on primary hover', 'text-inverse', 'brand-primary-hover', 4.5],
  ['Button label on accent CTA fill', 'text-inverse', 'brand-accent-strong', 4.5],
  ['Button label on accent CTA hover', 'text-inverse', 'brand-accent-hover', 4.5],
  ['Text on inverse surface', 'text-inverse', 'surface-inverse', 4.5],

  // Eyebrows / small brand text on tinted surfaces
  ['Eyebrow on soft blue', 'brand-primary-solid', 'brand-primary-soft', 4.5],
  ['Eyebrow on soft green', 'brand-accent-strong', 'brand-accent-soft', 4.5],

  // Status messaging
  ['Error text on card', 'error', 'surface-raised', 4.5],
  ['Crisis text on crisis surface', 'crisis', 'crisis-soft', 4.5],
  ['Warning text on card', 'warning', 'surface-raised', 4.5],

  // WCAG 1.4.11 non-text contrast (3:1) — UI boundaries and large display text
  ['Display heading in brand blue on card', 'brand-primary', 'surface-raised', 3.0],
  ['Focus ring against page background', 'border-focus', 'surface-base', 3.0],
  ['Focus ring against card', 'border-focus', 'surface-raised', 3.0],
  ['Focus ring against muted band', 'border-focus', 'surface-muted', 3.0],
  ['Input border on card', 'border-input', 'surface-raised', 3.0],
  ['Input border on page background', 'border-input', 'surface-base', 3.0],
  ['Input border on muted band', 'border-input', 'surface-muted', 3.0],
  ['Accent icon fill on card', 'brand-accent-strong', 'surface-raised', 3.0],
];

let failures = 0;
let missing = 0;

console.log('\nWCAG 2.2 contrast audit — tokens read from src/styles/globals.css\n');
console.log('   RATIO   MIN   RESULT   PAIR');
console.log('   ─────   ───   ──────   ───────────────────────────────────────────');

for (const [label, fgKey, bgKey, min] of PAIRS) {
  const fg = fgKey === 'text-inverse' ? WHITE : t[fgKey];
  const bg = t[bgKey];
  if (!fg || !bg) {
    missing++;
    console.log(`   ${'—'.padStart(5)}   ${min.toFixed(1)}   MISSING  ${label} (${fgKey} / ${bgKey})`);
    continue;
  }
  const r = contrast(fg, bg);
  const ok = r >= min;
  if (!ok) failures++;
  console.log(
    `   ${r.toFixed(2).padStart(5)}   ${min.toFixed(1)}   ${ok ? ' PASS ' : ' FAIL '}   ${label}`
  );
}

// Guard rails: these must never be used behind text, so assert they stay unused there.
const decorativeOnly = ['brand-accent'];
console.log('\n   Decorative-only tokens (must never sit behind small text):');
for (const key of decorativeOnly) {
  if (!t[key]) {
    missing++;
    console.log(`     --color-${key}  MISSING — could not resolve to a hex value`);
    continue;
  }
  const r = contrast(WHITE, t[key]);
  console.log(`     --color-${key} ${t[key]}  white-on-fill ${r.toFixed(2)}:1  → fills/icons only`);
}

console.log(
  `\n${failures === 0 && missing === 0 ? '✓ ALL PASS' : `✗ ${failures} failure(s), ${missing} missing`} — ${PAIRS.length} pairs checked\n`
);

process.exit(failures === 0 && missing === 0 ? 0 : 1);
