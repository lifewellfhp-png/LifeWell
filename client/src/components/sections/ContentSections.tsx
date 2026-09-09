import type { ContentSection } from '@/types/content';
import { cn } from '@/lib/utils';

/**
 * Renders the normalised section tree from source content.
 *
 * Headings descend correctly from the page H1 (H2 for sections, H3 where
 * nested). The source pages inverted this — H2 content sub-sections sat beneath
 * H3 major sections, and H6 was used purely as a visual eyebrow.
 */
export function ContentSections({
  sections,
  headingLevel = 2,
  className,
  variant = 'default',
}: {
  sections: ContentSection[];
  headingLevel?: 2 | 3;
  className?: string;
  variant?: 'default' | 'live';
}) {
  const Heading = (headingLevel === 2 ? 'h2' : 'h3') as 'h2' | 'h3';
  const live = variant === 'live';

  return (
    <div className={cn(live ? 'space-y-10' : 'space-y-12', className)}>
      {sections.map((section) => (
        <section key={section.heading} className="scroll-mt-28">
          <Heading
            className={
              live
                ? 'font-heading text-[22px] font-normal leading-[1.25] tracking-[-1px] text-[var(--lw-accent)] sm:max-desktop:text-[28px] desktop:text-[32px]'
                : headingLevel === 2
                  ? 'text-h3'
                  : 'text-h4'
            }
          >
            {section.heading}
          </Heading>

          <div className="mt-5 space-y-5">
            {section.blocks.map((block, i) =>
              block.type === 'list' ? (
                <ul key={i} className="space-y-2.5">
                  {block.items.map((item, j) => (
                    <li
                      key={j}
                      className={
                        live
                          ? 'flex gap-3 text-[16px] leading-[1.45] text-[#374151] desktop:text-[18px]'
                          : 'flex gap-3 text-md leading-relaxed text-text-secondary'
                      }
                    >
                      <CheckIcon />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p
                  key={i}
                  className={
                    live
                      ? 'text-[16px] leading-[1.45] text-[#374151] desktop:text-[18px]'
                      : 'text-md leading-relaxed text-text-secondary'
                  }
                >
                  {block.text}
                </p>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** Plain prose renderer for legal pages — no decorative list markers. */
export function LegalSections({ sections }: { sections: ContentSection[] }) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section key={section.heading}>
          <h2 className="text-h4">{section.heading}</h2>
          <div className="mt-4 space-y-4">
            {section.blocks.map((block, i) =>
              block.type === 'list' ? (
                <ul key={i} className="list-disc space-y-2 pl-6">
                  {block.items.map((item, j) => (
                    <li key={j} className="text-md leading-relaxed text-text-secondary">
                      {item}
                    </li>
                  ))}
                </ul>
              ) : (
                <p key={i} className="text-md leading-relaxed text-text-secondary">
                  {block.text}
                </p>
              )
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      className="mt-1 shrink-0"
    >
      <circle cx="10" cy="10" r="9" className="fill-brand-accent-soft" />
      <path
        d="m6 10.2 2.6 2.6L14 7.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand-accent-strong"
      />
    </svg>
  );
}
