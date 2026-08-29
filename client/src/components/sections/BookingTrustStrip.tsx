import Link from 'next/link';
import type { TelehealthState } from '@/data/telehealth-states';
import { provider as staticProvider } from '@/data/provider';
import { Container } from '@/components/ui/Section';

type Provider = {
  name: string;
  credentials: string;
} | null;

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} & ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} & ${items[items.length - 1]}`;
}

/**
 * Compact reassurance strip for the booking page, shown before the
 * booking-choice cards. Reuses the same provider/telehealth-state CMS data
 * as the homepage TrustStrip rather than introducing separate content.
 */
export function BookingTrustStrip({
  provider = staticProvider,
  states,
}: {
  provider?: Provider;
  states: TelehealthState[];
}) {
  const providerName = provider?.name || staticProvider.name;
  const credentials = provider?.credentials || staticProvider.credentials;
  const credentialLabel = credentials.includes('PMHNP-BC') ? 'PMHNP-BC' : credentials;

  const stateNames = states.map((state) => state.name);
  const existingStates = states.filter((state) => state.insuranceMode === 'existing').map((state) => state.name);
  const selfPayStates = states.filter((state) => state.insuranceMode === 'self_pay_only').map((state) => state.name);

  const insuranceLines = [
    existingStates.length ? `${formatList(existingStates)} insurance plans accepted.` : null,
    selfPayStates.length ? `${formatList(selfPayStates)} psychiatric visits are self-pay only.` : null,
  ].filter((line): line is string => Boolean(line));

  return (
    <Container>
      <div className="mx-auto max-w-[900px] rounded-[20px] border border-[#DCE7E9] bg-[#F7FAFB] px-5 py-6 sm:px-8 sm:py-7">
        <ul className="grid list-none grid-cols-1 divide-y divide-[#DCE7E9] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <li className="flex items-start gap-3 py-4 first:pt-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0">
            <TrustStripIcon type="provider" />
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">
                Your provider
              </span>
              <span className="mt-1 block text-[14px] font-medium leading-snug text-[var(--lw-primary)]">
                {providerName}, {credentialLabel}
              </span>
            </div>
          </li>
          <li className="flex items-start gap-3 py-4 sm:px-6 sm:py-0">
            <TrustStripIcon type="telehealth" />
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">
                Telehealth
              </span>
              <span className="mt-1 block text-[14px] font-medium leading-snug text-[var(--lw-primary)]">
                Available in {formatList(stateNames)}
              </span>
            </div>
          </li>
          <li className="flex items-start gap-3 py-4 last:pb-0 sm:px-6 sm:py-0 sm:first:pl-0 sm:last:pr-0">
            <TrustStripIcon type="insurance" />
            <div className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--lw-accent)]">
                Insurance &amp; self-pay
              </span>
              <span className="mt-1 block text-[14px] font-medium leading-snug text-[var(--lw-primary)]">
                {insuranceLines.map((line, i) => (
                  <span key={line} className={i > 0 ? 'mt-0.5 block' : 'block'}>
                    {line}
                  </span>
                ))}
              </span>
              <Link
                href="/fees-insurance"
                className="mt-1.5 inline-block text-[13px] font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline"
              >
                Insurance &amp; Pricing
              </Link>
            </div>
          </li>
        </ul>
      </div>
    </Container>
  );
}

function TrustStripIcon({ type }: { type: 'provider' | 'telehealth' | 'insurance' }) {
  const paths = {
    provider: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.7-3.2 3-5 7-5s6.3 1.8 7 5" />
      </>
    ),
    telehealth: (
      <>
        <path d="M4 5h16v11H4z" />
        <path d="M8 20h8M12 16v4" />
      </>
    ),
    insurance: (
      <>
        <path d="M5 4h14v16H5z" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lw-accent)]"
      fill="none"
      focusable="false"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      {paths[type]}
    </svg>
  );
}
