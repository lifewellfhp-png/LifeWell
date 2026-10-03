'use client';

/**
 * Site-wide chat widget.
 *
 * Deliberately menu/button-driven, not a free-text chat box: this codebase
 * already treats every public-facing form as administrative-only, with no
 * free-text Subject/Message field, specifically so a visitor cannot type
 * symptom/health information into an unmoderated input (see
 * ContactForm.tsx and test-contact-non-clinical-boundary.mjs). A typed chat
 * box would reopen exactly that risk and would need its own NLP
 * "I didn't understand that" fallback logic; a fixed decision tree needs
 * neither, and the "talk to a human" / crisis line are always one tap away
 * rather than only offered after a bot failure.
 *
 * All facts (pricing, service areas, booking link) are passed in as props
 * from the server-rendered root layout, which reads them from the same
 * CMS-resolved/static data every other page uses — nothing here is a second
 * copy of a number or fact that could drift from the real pages.
 */

import { useId, useState } from 'react';
import Link from 'next/link';
import { site } from '@/data/site';
import { pricingTiers } from '@/data/pricing';
import type { PsychiatricStatePricing } from '@/types/content';
import { formatPrice } from '@/lib/utils';
import { SwapButton } from '@/components/ui/SwapButton';
import { ContactForm } from '@/components/forms/ContactForm';

type Screen = 'menu' | 'pricing' | 'areas' | 'services' | 'callback';

const SERVICE_NAMES = [
  'Psychiatric Evaluations',
  'Medication Management',
  'Treatment for Depression, Anxiety, ADHD, Bipolar Disorder & PTSD',
  'Follow-Up Visits for Ongoing Mental Health Care',
  'Annual Physicals & Preventive Screenings',
  'Chronic Disease Management',
  'Sick Visits (Acute Primary Care)',
  'Weight Management',
];

/**
 * `careMode` (in-person vs. telehealth-only) is a structural fact tied to
 * state code, not CMS-editable anywhere in this codebase (see the note atop
 * telehealth-states.ts) — safe to state directly here. Whether a state is
 * self-pay only is NOT duplicated here; it's read off the same
 * psychiatricStatePricing prop the pricing screen uses, so this list can
 * never disagree with the pricing screen about which states are self-pay.
 */
const AREAS = [
  { name: 'Florida', slug: 'florida', careMode: 'Telehealth or in person at our Orlando office.' },
  { name: 'Massachusetts', slug: 'massachusetts', careMode: 'Telehealth only.' },
  { name: 'Arizona', slug: 'arizona', careMode: 'Telehealth only.' },
] as const;

function CrisisNote() {
  return (
    <p className="mt-4 border-t border-border-subtle pt-3 text-xs text-text-secondary">
      In crisis? Call or text{' '}
      <a href={site.crisis.phoneHref} className="font-semibold text-text-link">
        {site.crisis.phone}
      </a>
      . Prefer to talk now? Call{' '}
      <a href={site.contact.phoneHref} className="font-semibold text-text-link">
        {site.contact.phone}
      </a>
      .
    </p>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-semibold text-text-link hover:underline"
    >
      ← Back
    </button>
  );
}

export function ChatWidget({
  psychiatricStatePricing,
  bookingUrl,
}: {
  psychiatricStatePricing: PsychiatricStatePricing[];
  bookingUrl: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<Screen>('menu');

  const close = () => {
    setOpen(false);
    setScreen('menu');
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${uid}-heading`}
          className="mb-3 w-[min(360px,calc(100vw-2rem))] rounded-md border border-border-subtle bg-surface-raised p-5 shadow-lg"
        >
          <div className="flex items-center justify-between">
            <h2 id={`${uid}-heading`} className="text-base font-semibold text-text-primary">
              {site.shortName}
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="text-text-secondary hover:text-text-primary"
            >
              ✕
            </button>
          </div>

          {screen === 'menu' && (
            <nav className="mt-4 flex flex-col gap-2" aria-label="Chat options">
              <MenuButton onClick={() => setScreen('pricing')}>Pricing & Self-Pay Options</MenuButton>
              <MenuButton onClick={() => setScreen('areas')}>Service Areas & Hours</MenuButton>
              <MenuButton onClick={() => setScreen('services')}>Services We Offer</MenuButton>
              <SwapButton href={bookingUrl} trackAs="booking_click" size="sm" fullWidth>
                Book an Appointment
              </SwapButton>
              <MenuButton onClick={() => setScreen('callback')}>Request a Callback</MenuButton>
            </nav>
          )}

          {screen === 'pricing' && (
            <div className="mt-4">
              <BackButton onClick={() => setScreen('menu')} />
              <ul className="mt-3 space-y-3 text-sm text-text-secondary">
                {psychiatricStatePricing.map((p) => (
                  <li key={p.state}>
                    <p className="font-semibold text-text-primary">
                      {p.state}
                      {p.selfPayOnly ? ' — Self-Pay Only' : ''}
                    </p>
                    <p>
                      Initial evaluation {formatPrice(p.initialFee)} · Follow-up {formatPrice(p.followUpFee)}
                    </p>
                    {p.slidingScaleAvailable && (
                      <p>Sliding scale available — contact us to ask about eligibility.</p>
                    )}
                  </li>
                ))}
                {pricingTiers.map((tier) => (
                  <li key={tier.name}>
                    <p className="font-semibold text-text-primary">{tier.name}</p>
                    <p>
                      Initial {formatPrice(tier.initialFee)} ({tier.initialDuration}) · Follow-up{' '}
                      {formatPrice(tier.followUpFee)} ({tier.followUpDuration})
                    </p>
                  </li>
                ))}
              </ul>
              <Link
                href="/fees-insurance"
                className="mt-3 inline-block text-sm font-semibold text-text-link underline"
              >
                View full pricing & insurance details
              </Link>
            </div>
          )}

          {screen === 'areas' && (
            <div className="mt-4">
              <BackButton onClick={() => setScreen('menu')} />
              <ul className="mt-3 space-y-3 text-sm text-text-secondary">
                {AREAS.map((area) => {
                  const pricing = psychiatricStatePricing.find((p) => p.state === area.name);
                  return (
                    <li key={area.slug}>
                      <Link
                        href={`/telehealth/${area.slug}`}
                        className="font-semibold text-text-link underline"
                      >
                        {area.name}
                      </Link>
                      <p>
                        {area.careMode} {pricing?.selfPayOnly ? 'Self-pay only.' : 'Insurance accepted.'}
                      </p>
                    </li>
                  );
                })}
              </ul>
              <p className="mt-3 text-sm text-text-secondary">
                Hours: {site.hours.map((h) => `${h.days} ${h.display}`).join(' · ')}
              </p>
              <p className="text-sm text-text-secondary">Office: {site.address.full}</p>
            </div>
          )}

          {screen === 'services' && (
            <div className="mt-4">
              <BackButton onClick={() => setScreen('menu')} />
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {SERVICE_NAMES.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
              <Link
                href="/our-services"
                className="mt-3 inline-block text-sm font-semibold text-text-link underline"
              >
                View all services
              </Link>
            </div>
          )}

          {screen === 'callback' && (
            <div className="mt-4">
              <BackButton onClick={() => setScreen('menu')} />
              <div className="mt-3">
                <ContactForm variant="compact" />
              </div>
            </div>
          )}

          <CrisisNote />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-14 min-w-14 items-center justify-center rounded-full bg-[var(--lw-primary)] text-sm font-semibold text-white shadow-lg transition-colors duration-300 hover:bg-[var(--lw-accent)]"
      >
        {open ? 'Close' : 'Chat'}
      </button>
    </div>
  );
}

function MenuButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-sm border border-border-strong px-4 py-3 text-left text-sm font-semibold text-text-link hover:border-brand-primary hover:bg-brand-primary-soft"
    >
      {children}
    </button>
  );
}
