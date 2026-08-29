'use client';

import { useState } from 'react';
import { Container, Section } from '@/components/ui/Section';
import { site } from '@/data/site';

/**
 * CharmHealth Web Embed. Do not bounce visitors to the apex domain — its TLS
 * certificate is not valid, and www/apex Vercel domain redirects currently loop.
 */
export function BookingCalendar({ src = site.booking.url }: { src?: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <Section
      id="charm-calendar"
      tone="muted"
      aria-labelledby="booking-calendar-heading"
      className="scroll-mt-28"
    >
      <Container>
        <div className="mx-auto max-w-[52rem] text-center">
          <p className="mb-2.5 inline-flex rounded-[7px] bg-[#EEF3F7] px-[15px] pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[12px]">
            CharmHealth scheduling
          </p>
          <h2
            id="booking-calendar-heading"
            className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-2px] sm:text-[48px] min-[1181px]:text-[56px]"
          >
            <span className="text-[var(--lw-accent)]">Choose a time </span>
            <span className="italic tracking-normal text-[var(--lw-primary)]">that works for you</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[46ch] text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
            Book a secure telehealth visit in the same CharmHealth calendar used on the previous LifeWell site.
          </p>
        </div>

        <div className="mx-auto mt-8 flex max-w-[46rem] items-start gap-3 rounded-[16px] border border-[#DCE7E9] bg-white px-5 py-4 text-left sm:mt-10">
          <CalendarGuidanceIcon />
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--lw-accent)]">
              Choose Your Appointment Time
            </p>
            <p className="mt-1 text-[14px] leading-[1.5] text-[#374151]">
              Availability varies by date. If no times appear for the selected day, use the calendar arrows to
              check another date.
            </p>
          </div>
        </div>

        <div className="relative mx-auto mt-6 max-w-[1100px] overflow-hidden rounded-[30px] border border-[#e1e8ee] bg-white shadow-[0_10px_28px_rgba(62,127,177,0.12)]">
          {!loaded && (
            <div
              aria-hidden="true"
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white"
            >
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#E1E8EE] border-t-[var(--lw-primary)] motion-reduce:animate-none" />
              <span className="text-[14px] text-[#6b7280]">Loading appointment calendar…</span>
            </div>
          )}
          <iframe
            width="100%"
            height="1000"
            src={src}
            title="CharmHealth appointment calendar"
            style={{ overflow: 'hidden' }}
            frameBorder={0}
            className="relative block w-full max-w-none border-0 bg-white"
            onLoad={() => setLoaded(true)}
          />
        </div>

        <p className="mx-auto mt-6 max-w-[46rem] text-center text-[13px] text-[#6b7280]">
          Prefer a separate window?{' '}
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[var(--lw-primary)] underline-offset-4 hover:underline"
          >
            Open Scheduling in a New Tab
          </a>
        </p>
      </Container>
    </Section>
  );
}

function CalendarGuidanceIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--lw-accent)]"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
      <path d="M3.5 9.5h17" />
      <path d="M8 3v3.2M16 3v3.2" />
      <path d="M8.2 13.3h2M11.5 13.3h2M14.8 13.3h2M8.2 16.3h2M11.5 16.3h2" />
    </svg>
  );
}
