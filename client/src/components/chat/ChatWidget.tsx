'use client';

/**
 * Site-wide chat widget — conversational message-transcript UI.
 *
 * Deliberately button-driven, not a free-text chat box: this codebase
 * already treats every public-facing form as administrative-only, with no
 * free-text Subject/Message field, specifically so a visitor cannot type
 * symptom/health information into an unmoderated input (see
 * ContactForm.tsx and test-contact-non-clinical-boundary.mjs). A typed chat
 * box would reopen exactly that risk and would need its own NLP
 * "I didn't understand that" fallback logic; a fixed set of option buttons
 * needs neither, and the "talk to a human" / crisis line are shown as a
 * persistent footer rather than only offered after a bot failure.
 *
 * All facts (pricing, service areas, booking link) are passed in as props
 * from the server-rendered root layout, which reads them from the same
 * CMS-resolved/static data every other page uses — nothing here is a second
 * copy of a number or fact that could drift from the real pages.
 */

import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { site } from '@/data/site';
import { pricingTiers } from '@/data/pricing';
import type { PsychiatricStatePricing } from '@/types/content';
import { formatPrice } from '@/lib/utils';
import { SwapButton } from '@/components/ui/SwapButton';
import { ContactForm } from '@/components/forms/ContactForm';

type Action = 'MENU' | 'PRICING' | 'AREAS' | 'SERVICES' | 'BOOK' | 'CALLBACK';

type Message = {
  sender: 'bot' | 'user';
  content: ReactNode;
  options?: { label: string; action: Action }[];
};

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
 * psychiatricStatePricing prop the pricing reply uses, so this list can
 * never disagree about which states are self-pay.
 */
const AREAS = [
  { name: 'Florida', slug: 'florida', careMode: 'Telehealth or in person at our Orlando office.' },
  { name: 'Massachusetts', slug: 'massachusetts', careMode: 'Telehealth only.' },
  { name: 'Arizona', slug: 'arizona', careMode: 'Telehealth only.' },
] as const;

const MENU_OPTIONS: Message['options'] = [
  { label: 'Pricing & Self-Pay Options', action: 'PRICING' },
  { label: 'Service Areas & Hours', action: 'AREAS' },
  { label: 'Services We Offer', action: 'SERVICES' },
  { label: 'Book an Appointment', action: 'BOOK' },
  { label: 'Request a Callback', action: 'CALLBACK' },
];

const GREETING: Message = {
  sender: 'bot',
  content: "Hello! Welcome to LifeWell Family Health & Psychiatry. How can we assist you today?",
  options: MENU_OPTIONS,
};

const MENU_AGAIN: Message = {
  sender: 'bot',
  content: 'Anything else I can help with?',
  options: MENU_OPTIONS,
};

function CrisisFooter() {
  return (
    <div className="border-t border-border-subtle p-2.5 text-center text-[11px] text-text-secondary">
      In crisis? Call or text{' '}
      <a href={site.crisis.phoneHref} className="font-semibold text-text-link">
        {site.crisis.phone}
      </a>
      . Prefer to talk now? Call{' '}
      <a href={site.contact.phoneHref} className="font-semibold text-text-link">
        {site.contact.phone}
      </a>
      . No medical advice is given via chat.
    </div>
  );
}

function reply(
  action: Action,
  psychiatricStatePricing: PsychiatricStatePricing[],
  bookingUrl: string
): Message {
  switch (action) {
    case 'PRICING':
      return {
        sender: 'bot',
        content: (
          <div className="space-y-3">
            {psychiatricStatePricing.map((p) => (
              <div key={p.state}>
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
              </div>
            ))}
            {pricingTiers.map((tier) => (
              <div key={tier.name}>
                <p className="font-semibold text-text-primary">{tier.name}</p>
                <p>
                  Initial {formatPrice(tier.initialFee)} ({tier.initialDuration}) · Follow-up{' '}
                  {formatPrice(tier.followUpFee)} ({tier.followUpDuration})
                </p>
              </div>
            ))}
            <Link href="/fees-insurance" className="inline-block font-semibold text-text-link underline">
              View full pricing & insurance details
            </Link>
          </div>
        ),
        options: [{ label: '← Back to Main Menu', action: 'MENU' }],
      };

    case 'AREAS':
      return {
        sender: 'bot',
        content: (
          <div className="space-y-3">
            {AREAS.map((area) => {
              const pricing = psychiatricStatePricing.find((p) => p.state === area.name);
              return (
                <div key={area.slug}>
                  <Link href={`/telehealth/${area.slug}`} className="font-semibold text-text-link underline">
                    {area.name}
                  </Link>
                  <p>
                    {area.careMode} {pricing?.selfPayOnly ? 'Self-pay only.' : 'Insurance accepted.'}
                  </p>
                </div>
              );
            })}
            <p>Hours: {site.hours.map((h) => `${h.days} ${h.display}`).join(' · ')}</p>
            <p>Office: {site.address.full}</p>
          </div>
        ),
        options: [{ label: '← Back to Main Menu', action: 'MENU' }],
      };

    case 'SERVICES':
      return {
        sender: 'bot',
        content: (
          <div className="space-y-2">
            <ul className="list-disc space-y-1 pl-5">
              {SERVICE_NAMES.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
            <Link href="/our-services" className="inline-block font-semibold text-text-link underline">
              View all services
            </Link>
          </div>
        ),
        options: [{ label: '← Back to Main Menu', action: 'MENU' }],
      };

    case 'BOOK':
      return {
        sender: 'bot',
        content: (
          <div className="space-y-3">
            <p>Great — you can book directly online:</p>
            <SwapButton href={bookingUrl} trackAs="booking_click" size="sm">
              Book an Appointment
            </SwapButton>
          </div>
        ),
        options: [{ label: '← Back to Main Menu', action: 'MENU' }],
      };

    case 'CALLBACK':
      return {
        sender: 'bot',
        content: (
          <div className="w-full max-w-none">
            <p className="mb-3">Sure — leave your details and we&apos;ll call you back:</p>
            <ContactForm variant="compact" />
          </div>
        ),
        options: [{ label: '← Back to Main Menu', action: 'MENU' }],
      };

    case 'MENU':
    default:
      return MENU_AGAIN;
  }
}

const OPTION_LABELS: Record<Action, string> = {
  MENU: 'Anything else I can help with?',
  PRICING: 'Pricing & Self-Pay Options',
  AREAS: 'Service Areas & Hours',
  SERVICES: 'Services We Offer',
  BOOK: 'Book an Appointment',
  CALLBACK: 'Request a Callback',
};

export function ChatWidget({
  psychiatricStatePricing,
  bookingUrl,
}: {
  psychiatricStatePricing: PsychiatricStatePricing[];
  bookingUrl: string;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);

  const close = () => {
    setOpen(false);
    setMessages([GREETING]);
  };

  const handleOptionClick = (action: Action) => {
    setMessages((prev) => [
      ...prev,
      { sender: 'user', content: OPTION_LABELS[action] },
      reply(action, psychiatricStatePricing, bookingUrl),
    ]);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${uid}-heading`}
          className="flex h-[28rem] w-[min(360px,calc(100vw-2rem))] flex-col rounded-md border border-border-subtle bg-surface-raised shadow-lg"
        >
          <div className="flex items-center justify-between rounded-t-md bg-[var(--lw-primary)] p-3">
            <h2 id={`${uid}-heading`} className="text-sm font-semibold text-white">
              {site.shortName} Assistant
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="font-bold text-white"
            >
              &times;
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-lg p-2.5 text-text-primary ${
                    m.sender === 'user'
                      ? 'max-w-[85%] bg-[var(--lw-primary)] text-white'
                      : 'w-full max-w-full bg-surface-muted'
                  }`}
                >
                  {m.content}
                </div>
                {m.options && (
                  <nav className="mt-2 w-full space-y-1.5" aria-label="Chat options">
                    {m.options.map((opt) => (
                      <button
                        key={opt.action}
                        type="button"
                        onClick={() => handleOptionClick(opt.action)}
                        className="w-full rounded-sm border border-border-strong p-2 text-left text-xs font-semibold text-text-link hover:border-brand-primary hover:bg-brand-primary-soft"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </nav>
                )}
              </div>
            ))}
          </div>

          <CrisisFooter />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--lw-primary)] px-5 text-sm font-semibold text-white shadow-lg transition-colors duration-300 hover:bg-[var(--lw-accent)]"
      >
        {open ? 'Close' : 'Chat with Us'}
      </button>
    </div>
  );
}
