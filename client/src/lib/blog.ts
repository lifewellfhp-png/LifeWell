/**
 * Premium /blog reorg: shared constants between the listing page, post
 * cards, and individual post pages, so the byline and filter-chip category
 * list each have exactly one source of truth.
 */

/** Every published article shows this byline — the practice has one clinician. */
export const BLOG_AUTHOR_BYLINE = 'Lourdie Chachoute, PMHNP-BC';

/** Filter chips on /blog, in display order. Keep in sync with admin/src/app/(app)/blog/page.tsx's CATEGORIES. */
export const BLOG_FILTER_CATEGORIES = ['Getting Started', 'Medication Management', 'Anxiety', 'ADHD'] as const;

export const BLOG_PAGE_SIZE = 9;
