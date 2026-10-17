/** Joins class names, dropping falsy values. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** True for links that leave the site. */
export function isExternal(href: string): boolean {
  return /^(https?:)?\/\//.test(href) || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('sms:');
}

/** Formats an ISO date for display, e.g. "12 April 2025". */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Machine-readable date for <time dateTime>. */
export function isoDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

/** Estimated reading time in whole minutes, ~200 words/minute, minimum 1. */
export function estimateReadingTime(body: string | null | undefined): number {
  if (!body) return 1;
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Formats a whole-dollar amount without trailing zeros. */
export function formatPrice(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Groups an array of numbers into a readable count string. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}
