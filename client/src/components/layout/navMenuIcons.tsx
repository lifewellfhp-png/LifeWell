/**
 * Small line icons shown next to each column heading in the Services mega
 * menu (desktop) and its mobile accordion equivalent — in a module of its
 * own so NavBar.tsx and MobileMenu.tsx (which already import each other)
 * don't end up in a circular import over this shared lookup.
 */
function MentalHealthIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-7-4.35-9.5-8.5C.5 8.5 2 5 5.5 5c2 0 3.5 1.5 4.5 3 1-1.5 2.5-3 4.5-3C18 5 19.5 8.5 17.5 12.5 15 16.65 12 21 12 21Z" />
    </svg>
  );
}

function PrimaryCareIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="3.3" r="1.3" />
      <circle cx="14" cy="3.3" r="1.3" />
      <path d="M6 4.6v5.4a4 4 0 0 0 8 0V4.6" />
      <path d="M10 13v1.5a4.5 4.5 0 0 0 4.5 4.5h.5" />
      <circle cx="18" cy="19" r="2.5" />
    </svg>
  );
}

function ProfessionalEducationIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 2 8l10 5 10-5-10-5Z" />
      <path d="M6 10.5V16c0 1.5 2.5 3 6 3s6-1.5 6-3v-5.5" />
      <path d="M22 8v6" />
    </svg>
  );
}

const GROUP_HEADING_ICONS: Record<string, () => React.ReactNode> = {
  'Mental Health': MentalHealthIcon,
  'Primary Care': PrimaryCareIcon,
  'Professional Education': ProfessionalEducationIcon,
};

/** Returns the small line icon for a Services-menu column heading, or null for an unrecognized label. */
export function groupHeadingIcon(label: string): React.ReactNode {
  const Icon = GROUP_HEADING_ICONS[label];
  return Icon ? <Icon /> : null;
}
