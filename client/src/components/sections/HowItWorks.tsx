import Image from 'next/image';
import type { Step } from '@/types/content';
import { Container, Section } from '@/components/ui/Section';
import { SwapButton, LongArrow } from '@/components/ui/SwapButton';
import { howItWorks, steps as defaultSteps } from '@/data/marketing';
import { site } from '@/data/site';

/**
 * Homepage “How It Works” — centered Lora heading, photo with the live
 * frosted “Are You in Danger?” card, numbered step tiles, then CTA.
 */
export function HowItWorks({
  steps = defaultSteps,
  heading = howItWorks.heading,
  eyebrow = howItWorks.eyebrow,
  body = howItWorks.body,
  tone = 'transparent',
  showCta = true,
  bookingUrl,
}: {
  steps?: Step[];
  heading?: string;
  eyebrow?: string;
  body?: string;
  tone?: 'base' | 'muted' | 'raised' | 'transparent';
  showCta?: boolean;
  bookingUrl?: string;
}) {
  const lead = heading.replace(/ Process Works$/, '');
  const accent = heading.endsWith('Process Works') ? 'Process Works' : undefined;
  const bookHref = bookingUrl ?? site.booking.page;

  return (
    <Section
      tone={tone}
      aria-labelledby="how-it-works-heading"
      className="bg-[radial-gradient(ellipse_at_50%_30%,#E8F4F1_0%,#F7FAFB_45%,#FFFFFF_100%)]"
    >
      <Container>
        <div className="flex flex-col items-center text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[12px] min-[1181px]:text-[13px]">
            {eyebrow}
          </p>
          <h2
            id="how-it-works-heading"
            className="max-w-[16ch] font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:max-w-[22ch] sm:text-[48px] min-[1181px]:max-w-none min-[1181px]:text-[56px]"
          >
            {accent ? (
              <>
                <span className="font-heading not-italic text-[var(--lw-primary)]">{lead} </span>
                <span className="font-heading italic text-[var(--lw-accent)]">{accent}</span>
              </>
            ) : (
              <span className="font-heading">{heading}</span>
            )}
          </h2>
          <p className="mt-6 max-w-[46ch] font-body text-[16px] leading-[1.45] text-text-primary sm:max-w-none sm:text-[18px] min-[1181px]:text-[22px] min-[1181px]:leading-[1.35]">
            {body}
          </p>
        </div>

        <div className="mt-10 grid items-center gap-8 lg:mt-16 lg:grid-cols-2 lg:gap-x-[60px] min-[1181px]:gap-x-20">
          <div className="relative h-[280px] overflow-hidden rounded-[30px] sm:h-auto">
            <Image
              src={howItWorks.image.src}
              alt=""
              width={howItWorks.image.width}
              height={howItWorks.image.height}
              loading="lazy"
              sizes="(min-width: 1024px) 44vw, 92vw"
              className="h-full w-full object-cover sm:h-auto"
            />
            <div className="absolute left-4 top-4 z-10 max-w-[min(100%-2rem,280px)] rounded-[20px] bg-white/20 p-4 shadow-[0_8px_32px_rgb(0_0_0_/_0.18)] ring-1 ring-white/35 backdrop-blur-[18px] sm:left-6 sm:top-6 sm:max-w-[300px] sm:p-5">
              <p className="font-heading text-[20px] font-normal leading-snug text-white sm:text-[24px]">
                {site.crisis.heading}
              </p>
              <p className="mt-2 font-body text-[13px] leading-[1.45] text-white/95 sm:text-[15px]">
                {site.crisis.body}
              </p>
              <div className="mt-4">
                <SwapButton href={site.crisis.phoneHref} size="sm">
                  Call or Text 988
                </SwapButton>
              </div>
            </div>
          </div>

          <ol className="flex list-none flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.title}>
                <article className="flex items-start gap-5 rounded-[20px] bg-white px-5 py-5 shadow-[0_4px_24px_rgb(62_127_177_/_0.08)] sm:items-center sm:gap-6 sm:px-7 sm:py-7">
                  <span
                    aria-hidden="true"
                    className="w-10 shrink-0 text-center font-heading text-[36px] font-normal leading-none text-[var(--lw-accent)] sm:w-12 sm:text-[42px] min-[1181px]:text-[48px]"
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="flex flex-wrap items-center gap-2 font-heading text-[20px] font-normal leading-snug tracking-[-1px] text-[var(--lw-primary)] sm:text-[24px] min-[1181px]:text-[26px]">
                      <span className="sr-only">Step {i + 1}: </span>
                      {step.title}
                      <LongArrow />
                    </h3>
                    <p className="mt-2 text-[14px] leading-[1.45] text-text-primary sm:text-[16px]">
                      {step.description}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>

        {showCta && (
          <div className="mt-10 flex justify-center min-[1181px]:mt-16">
            <SwapButton href={bookHref} trackAs="booking_click">{howItWorks.cta.label}</SwapButton>
          </div>
        )}
      </Container>
    </Section>
  );
}

/**
 * Crisis callout — used on the contact page, not on this homepage section.
 */
export function CrisisCallout({ className }: { className?: string }) {
  return (
    <aside
      aria-labelledby="crisis-heading"
      className={`rounded-md border-2 border-crisis/30 bg-crisis-soft p-5 sm:p-6 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-4 xs:flex-row">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-crisis text-text-inverse"
        >
          <AlertIcon />
        </span>
        <div>
          <h3 id="crisis-heading" className="text-h5 text-crisis">
            {site.crisis.heading}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-text-primary">
            {site.crisis.body} If you are in immediate danger, call 911.
          </p>
          <p className="mt-4 flex flex-wrap gap-3">
            <a
              href={site.crisis.phoneHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm bg-crisis px-5 text-sm font-semibold text-text-inverse no-underline transition-opacity duration-quick hover:opacity-90"
            >
              Call or text 988
            </a>
            <a
              href={site.crisis.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-crisis/40 px-5 text-sm font-semibold text-crisis no-underline transition-colors duration-quick hover:bg-crisis/5"
            >
              988lifeline.org
            </a>
          </p>
        </div>
      </div>
    </aside>
  );
}

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 2.5 20h19L12 3Z" />
      <path d="M12 9.5v4.2" />
      <circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}
