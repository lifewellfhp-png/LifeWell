import type { TelehealthState } from '@/data/telehealth-states';
import Link from 'next/link';
import { site } from '@/data/site';
import { Container } from '@/components/ui/Section';

/**
 * Four quick cards, overlapping the bottom of the Hero (Phase 24 homepage
 * reorg). Previously a plain bordered strip sitting below the Hero with a
 * "Your provider" item first — that item is gone entirely (no provider
 * information anywhere on the homepage, per the brief) and replaced with a
 * "Psychiatric care" card; the other three (telehealth/location/pricing)
 * are unchanged in content.
 */
export function TrustStrip({ states }: { states: TelehealthState[] }) {
  const stateCodes = states.map((state) => state.code).join(', ');
  const items = [
    {
      type: 'psychiatric' as const,
      label: 'Psychiatric care',
      value: 'Evaluations & medication management',
      href: '/our-services',
    },
    {
      type: 'telehealth' as const,
      label: 'Secure telehealth',
      value: `Available in ${stateCodes}`,
      href: undefined,
    },
    {
      type: 'location' as const,
      label: 'In-person care',
      value: `Available in ${site.address.city}, ${site.address.regionName}`,
      href: undefined,
    },
    {
      type: 'pricing' as const,
      label: 'Insurance & pricing',
      value: 'Explore payment options',
      href: '/fees-insurance',
    },
  ];

  return (
    <div className="relative z-10 -mt-12 sm:-mt-16 lg:-mt-20">
      <Container>
        <ul className="grid list-none grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.label}>
              <TrustCard item={item} />
            </li>
          ))}
        </ul>
      </Container>
    </div>
  );
}

function TrustCard({
  item,
}: {
  item: { type: 'psychiatric' | 'telehealth' | 'location' | 'pricing'; label: string; value: string; href?: string };
}) {
  const content = (
    <>
      <TrustIcon type={item.type} />
      <span className="mt-3 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)] sm:text-[12px]">
        {item.label}
      </span>
      <span className="mt-1 block text-[14px] font-medium leading-snug text-[var(--lw-primary)] sm:text-[15px]">
        {item.value}
      </span>
    </>
  );

  const className =
    'block h-full rounded-[20px] border-t-4 border-[var(--lw-accent)] bg-white px-5 py-6 shadow-[0_8px_24px_rgb(0_37_116_/_0.08)] no-underline transition-shadow duration-300 hover:shadow-[0_12px_32px_rgb(0_37_116_/_0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-primary)]';

  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

function TrustIcon({ type }: { type: 'psychiatric' | 'telehealth' | 'location' | 'pricing' }) {
  const paths = {
    psychiatric: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5" /></>,
    telehealth: <><path d="M4 5h16v11H4z" /><path d="M8 20h8M12 16v4" /></>,
    location: <><path d="M20 10c0 5-8 10-8 10S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    pricing: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  } as const;

  return (
    <svg aria-hidden="true" className="h-6 w-6 shrink-0 text-[var(--lw-accent)]" fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
      {paths[type]}
    </svg>
  );
}
