import type { ElementType, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* --------------------------------------------------------- Container --- */

export function Container({
  children,
  className,
  size = 'page',
}: {
  children: ReactNode;
  className?: string;
  size?: 'page' | 'prose' | 'narrow';
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0 px-4 sm:max-[1601px]:px-[30px] lg:max-[1601px]:px-10 min-[1601px]:px-[80px]',
        size === 'page' && 'max-w-page',
        size === 'narrow' && 'max-w-narrow',
        size === 'prose' && 'max-w-prose',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------- Section --- */

type Tone = 'base' | 'raised' | 'muted' | 'inverse' | 'transparent';

const TONES: Record<Tone, string> = {
  base: 'bg-surface-base',
  raised: 'bg-surface-raised',
  muted: 'bg-surface-muted',
  inverse: 'bg-surface-inverse text-text-inverse on-inverse',
  transparent: '',
};

/* Vertical rhythm: 56-80px on mobile scaling to 96-128px on desktop. */
const SPACING = {
  sm: 'py-14 md:py-20',
  md: 'py-14 md:py-24',
  lg: 'py-20 md:py-32',
} as const;

export function Section({
  children,
  tone = 'base',
  spacing = 'md',
  className,
  as: Tag = 'section',
  id,
  'aria-labelledby': labelledBy,
  'aria-label': label,
}: {
  children: ReactNode;
  tone?: Tone;
  spacing?: keyof typeof SPACING;
  className?: string;
  as?: ElementType;
  id?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  return (
    <Tag
      id={id}
      aria-labelledby={labelledBy}
      aria-label={label}
      className={cn(TONES[tone], SPACING[spacing], className)}
    >
      {children}
    </Tag>
  );
}

/* ----------------------------------------------------------- Eyebrow --- */

/**
 * The small uppercase kicker above section headings.
 *
 * The source site marked these up as <h6>, which injected phantom levels into
 * every document outline. Here it is a styled <p> — appearance only.
 */
export function Eyebrow({
  children,
  tone = 'primary',
  variant = 'line',
  className,
}: {
  children: ReactNode;
  tone?: 'primary' | 'accent' | 'inverse';
  variant?: 'line' | 'badge';
  className?: string;
}) {
  if (variant === 'badge') {
    return (
      <p
        className={cn(
          'mb-2.5 w-fit rounded-[7px] bg-[#EEF3F7] px-[15px] pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:max-desktop:text-[12px] desktop:text-[13px]',
          className
        )}
      >
        {children}
      </p>
    );
  }

  return (
    <p
      className={cn(
        'mb-6 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em]',
        tone === 'primary' && 'text-brand-primary-solid',
        tone === 'accent' && 'text-brand-accent-strong',
        tone === 'inverse' && 'text-text-inverse/85',
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'h-px w-8',
          tone === 'primary' && 'bg-brand-primary',
          tone === 'accent' && 'bg-brand-accent-strong',
          tone === 'inverse' && 'bg-text-inverse/50'
        )}
      />
      {children}
    </p>
  );
}

/* ---------------------------------------------------- SectionHeading --- */

export function SectionHeading({
  eyebrow,
  eyebrowVariant = 'line',
  title,
  accent,
  description,
  descriptionClassName,
  align = 'center',
  tone = 'default',
  as = 'h2',
  id,
  className,
  children,
}: {
  eyebrow?: string;
  eyebrowVariant?: 'line' | 'badge';
  title: string;
  /** Second half of the live split heading — Lora italic in primary blue. */
  accent?: string;
  description?: string;
  descriptionClassName?: string;
  align?: 'left' | 'center';
  tone?: 'default' | 'inverse';
  as?: 'h1' | 'h2' | 'h3';
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  const Tag = as;
  return (
    <div
      className={cn(
        'flex flex-col',
        align === 'center' && 'items-center text-center',
        align === 'left' && 'items-start text-left',
        className
      )}
    >
      {eyebrow && (
        <Eyebrow
          tone={tone === 'inverse' ? 'inverse' : 'primary'}
          variant={eyebrowVariant}
        >
          {eyebrow}
        </Eyebrow>
      )}
      <Tag
        id={id}
        className={cn(
          'max-w-[36ch] text-[30px] font-normal leading-[1.15] tracking-[-3px] [text-wrap:wrap] sm:max-desktop:text-[48px] desktop:text-[56px]',
          tone === 'inverse' && 'text-text-inverse'
        )}
      >
        {accent ? (
          <>
            <span className={cn('not-italic', tone === 'inverse' ? 'text-white' : 'text-[var(--lw-accent)]')}>
              {title}{' '}
            </span>
            <span
              className={cn(
                'italic tracking-normal sm:max-desktop:text-[38px] desktop:text-[56px]',
                tone === 'inverse' ? 'text-white' : 'text-[var(--lw-primary)]'
              )}
            >
              {accent}
            </span>
          </>
        ) : (
          title
        )}
      </Tag>
      {description && (
        <p
          className={
            descriptionClassName ??
            cn(
              'mt-6 max-w-[62ch] text-[16px] leading-[1.45] desktop:text-[18px]',
              tone === 'inverse' ? 'text-text-inverse/85' : 'text-text-secondary'
            )
          }
        >
          {description}
        </p>
      )}
      {children}
    </div>
  );
}
