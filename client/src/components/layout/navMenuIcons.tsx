/**
 * Small line icons used next to each Mental Health link in the Services
 * mega menu (desktop) and its mobile accordion equivalent — in a module of
 * its own so NavBar.tsx and MobileMenu.tsx (which already import each
 * other) don't end up in a circular import over this shared array.
 * Order matches navigation.ts's mentalHealthMenuLinks exactly.
 */
export const MENTAL_HEALTH_ICONS: Array<() => React.ReactNode> = [
  () => (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2h6a1 1 0 0 1 1 1v1h1a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h1V3a1 1 0 0 1 1-1Z" />
      <path d="m9 13 2 2 4-4" />
    </svg>
  ),
  () => (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="m8.5 15.5 7-7" />
    </svg>
  ),
  () => (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
      <path d="M8 12h2l1.5-3L13 15l1.5-3H16" />
    </svg>
  ),
  () => (
    <svg aria-hidden="true" focusable="false" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="m8.5 15 2 2 4-4" />
    </svg>
  ),
];
