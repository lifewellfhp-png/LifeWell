import Image from 'next/image';
import Link from 'next/link';
import type { ServiceSummary } from '@/types/content';
import { cn } from '@/lib/utils';

/**
 * Pastel content-box colours as they appear on the live Elementor cards
 * (cream, pale yellow, mint, peach), cycling across the grid.
 */
const CARD_TONES = ['#FBF7F4', '#F8F1DC', '#E8F4EC', '#F8EBE6'] as const;

/**
 * Service card — photo on top, overlapping pastel text box, matching
 * Elementor template 65 on lifewellfhp.com.
 */
export function ServiceCard({
  service,
  tone = CARD_TONES[0],
  className,
}: {
  service: ServiceSummary;
  tone?: string;
  className?: string;
}) {
  return (
    <article className={cn('group relative flex h-full flex-col', className)}>
      <div className="relative overflow-hidden rounded-[20px]">
        {service.image.src.startsWith('http') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={service.image.src}
            alt={service.image.alt}
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        ) : (
          <Image
            src={service.image.src}
            alt={service.image.alt}
            width={service.image.width}
            height={service.image.height}
            loading="lazy"
            sizes="(min-width: 1181px) 22vw, (min-width: 768px) 45vw, 92vw"
            className="aspect-[4/3] w-full object-cover transition-transform duration-300 group-hover:scale-110"
          />
        )}
      </div>

      <div
        className="relative z-10 -mt-10 flex flex-1 flex-col gap-4 rounded-[20px] px-5 py-6 sm:px-[30px] sm:py-7"
        style={{ backgroundColor: tone }}
      >
        <h3 className="text-[20px] font-medium italic leading-[1.3] tracking-[-1px] text-[var(--lw-accent)] sm:text-[24px] min-[1181px]:text-[26px]">
          <Link
            href={service.href}
            className="rounded-xs text-inherit no-underline transition-colors duration-300 after:absolute after:inset-0 after:content-[''] group-hover:text-[var(--lw-primary)]"
          >
            {service.title}
          </Link>
        </h3>

        <p className="line-clamp-2 text-[12px] leading-[1.5] text-[#374151] sm:text-[14px] min-[1181px]:text-[16px]">
          {service.description}
        </p>

        <span
          aria-hidden="true"
          className="mt-auto inline-flex items-center gap-[7px] text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] underline decoration-[var(--lw-accent)]/40 underline-offset-4 transition-colors duration-300 group-hover:text-[var(--lw-primary)] group-hover:decoration-[var(--lw-primary)] sm:text-[12px] min-[1181px]:text-[13px]"
        >
          Learn More
          <ArrowIcon className="transition-transform duration-300 group-hover:translate-x-[5px]" />
        </span>
      </div>
    </article>
  );
}

export function ServicesGrid({
  services,
  columns = 3,
  className,
}: {
  services: ServiceSummary[];
  columns?: 2 | 3 | 4;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid list-none gap-5 sm:grid-cols-2 sm:gap-[30px]',
        columns === 3 && 'lg:grid-cols-3',
        columns === 4 && 'lg:grid-cols-4',
        className
      )}
    >
      {services.map((service, index) => (
        <li key={service.slug} className="flex">
          <ServiceCard
            service={service}
            tone={CARD_TONES[index % CARD_TONES.length]}
            className="w-full"
          />
        </li>
      ))}
    </ul>
  );
}

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="11"
      height="11"
      viewBox="0 0 448 512"
      fill="currentColor"
      className={className}
    >
      <path d="M313.941 216H12c-6.627 0-12 5.373-12 12v56c0 6.627 5.373 12 12 12h301.941v46.059c0 21.382 25.851 32.09 40.971 16.971l86.059-86.059c9.373-9.373 9.373-24.569 0-33.941l-86.059-86.059c-15.119-15.119-40.971-4.411-40.971 16.971V216z" />
    </svg>
  );
}
