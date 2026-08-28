import type { TelehealthState } from '@/data/telehealth-states';
import Link from 'next/link';
import { provider as staticProvider } from '@/data/provider';
import { site } from '@/data/site';
import { Container } from '@/components/ui/Section';

type Provider = {
  name: string;
  credentials: string;
} | null;

export function TrustStrip({
  provider = staticProvider,
  states,
}: {
  provider?: Provider;
  states: TelehealthState[];
}) {
  const providerName = provider?.name || staticProvider.name;
  const credentials = provider?.credentials || staticProvider.credentials;
  const credentialLabel = credentials.includes('PMHNP-BC') ? 'PMHNP-BC' : credentials;
  const stateCodes = states.map((state) => state.code).join(', ');
  return (
    <section aria-label="LifeWell care details" className="border-y border-[#DCE7E9] bg-[#F7FAFB]">
      <Container>
        <ul className="grid grid-cols-2 list-none divide-x divide-y divide-[#DCE7E9] py-2 lg:grid-cols-4 lg:divide-y-0 lg:py-0">
          <li className="flex items-center gap-3 px-1 py-4 sm:px-5 lg:py-5">
            <TrustIcon type="provider" />
            <Link href="/bio" className="min-w-0 rounded-sm text-left no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-primary)]">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">Your provider</span>
              <span className="mt-1 block truncate text-[14px] font-medium text-[var(--lw-primary)]">{providerName}, {credentialLabel}</span>
            </Link>
          </li>
          <li className="flex items-center gap-3 px-1 py-4 sm:px-5 lg:py-5">
            <TrustIcon type="telehealth" />
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">Secure telehealth</span>
              <span className="mt-1 block text-[14px] font-medium text-[var(--lw-primary)]">Available in {stateCodes}</span>
            </div>
          </li>
          <li className="flex items-center gap-3 px-1 py-4 sm:px-5 lg:py-5">
            <TrustIcon type="location" />
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">In-person care</span>
              <span className="mt-1 block text-[14px] font-medium text-[var(--lw-primary)]">Available in {site.address.city}, {site.address.regionName}</span>
            </div>
          </li>
          <li className="flex items-center gap-3 px-1 py-4 sm:px-5 lg:py-5">
            <TrustIcon type="pricing" />
            <Link href="/fees-insurance" className="min-w-0 rounded-sm text-left no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lw-primary)]">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">Insurance &amp; pricing</span>
              <span className="mt-1 block text-[14px] font-medium text-[var(--lw-primary)]">Explore payment options</span>
            </Link>
          </li>
        </ul>
      </Container>
    </section>
  );
}

function TrustIcon({ type }: { type: 'provider' | 'telehealth' | 'location' | 'pricing' }) {
  const paths = {
    provider: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5" /></>,
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
