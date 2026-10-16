import { site } from '@/data/site';

/**
 * Site-wide crisis notice (Phase 24 homepage reorg) — slim, calm, light
 * green background, present on every page above the header. Replaces the
 * old "Are You in Danger?" frosted overlay card that used to live inside
 * the homepage's How It Works section (HowItWorks.tsx) — that one-section
 * placement is gone; this is its sitewide, always-visible replacement.
 *
 * Rendered in-flow (not fixed) so it pushes the header down naturally —
 * see Header.tsx's own --crisis-bar-height offset, which keeps the two in
 * sync without either hardcoding the other's height.
 */
export function CrisisBar() {
  return (
    <div
      role="note"
      aria-label="Crisis notice"
      className="relative z-[60] flex min-h-[var(--crisis-bar-height)] items-center justify-center bg-[var(--color-brand-accent-soft)] px-4 py-2 text-center"
    >
      <p className="text-[12.5px] font-medium leading-snug text-[var(--lw-primary)] sm:text-[13.5px]">
        In crisis? Call or text{' '}
        <a href={site.crisis.phoneHref} className="font-semibold underline underline-offset-2">
          988
        </a>
        , or call{' '}
        <a href="tel:911" className="font-semibold underline underline-offset-2">
          911
        </a>
        . LifeWell does not provide emergency services.
      </p>
    </div>
  );
}
