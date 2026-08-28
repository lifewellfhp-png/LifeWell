import Image from 'next/image';
import { Container, Section } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { ContactForm } from '@/components/forms/ContactForm';
import { primaryCta, contactCta } from '@/data/marketing';
import { site } from '@/data/site';

/** Full-width closing CTA band used at the foot of most pages. */
export function CTASection({
  heading = primaryCta.heading,
  body = primaryCta.body,
  primaryLabel = site.booking.label,
  primaryHref = site.booking.page,
  secondaryLabel = 'Contact us',
  secondaryHref = '/contact-telehealth-mental-health-provider',
}: {
  heading?: string;
  body?: string;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  return (
    <Section tone="inverse" aria-labelledby="cta-heading">
      <Container size="narrow">
        <div className="text-center">
          <h2
            id="cta-heading"
            className="mx-auto max-w-[22ch] text-[30px] font-normal leading-[1.15] tracking-normal text-text-inverse sm:text-[48px] min-[1181px]:text-[56px]"
          >
            {heading}
          </h2>
          {body && (
            <p className="mx-auto mt-6 max-w-[56ch] text-[16px] leading-[1.45] text-text-inverse/85 min-[1181px]:text-[18px]">
              {body}
            </p>
          )}

          <div className="mt-9 flex flex-col items-stretch justify-center gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            <SwapButton href={primaryHref}>{primaryLabel}</SwapButton>
            <a
              href={secondaryHref}
              className="inline-flex min-h-[51px] items-center justify-center rounded-[30px] border border-white px-[30px] py-[14px] text-[16px] font-semibold text-white no-underline transition-colors duration-300 hover:bg-white hover:text-[var(--lw-primary)] min-[1181px]:text-[18px]"
            >
              {secondaryLabel}
            </a>
          </div>
        </div>
      </Container>
    </Section>
  );
}

/** Split "reach out" band with imagery + form, matching the live homepage. */
export function ContactCTA({
  bookingUrl,
  bookingLabel,
}: {
  bookingUrl?: string;
  bookingLabel?: string;
} = {}) {
  const bookHref = bookingUrl ?? site.booking.page;
  const bookText = bookingLabel ?? site.booking.label;
  return (
    <Section tone="transparent" aria-labelledby="contact-cta-heading" className="bg-[#F4F7FA]">
      <Container>
        <div className="rounded-[32px] bg-white px-5 py-8 sm:rounded-[40px] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
          <div className="grid items-stretch gap-8 lg:grid-cols-2 lg:gap-12">
            <div className="overflow-hidden rounded-[24px] sm:rounded-[30px]">
              <Image
                src={contactCta.image.src}
                alt=""
                width={contactCta.image.width}
                height={contactCta.image.height}
                loading="lazy"
                sizes="(min-width: 1024px) 40vw, 92vw"
                className="h-full w-full min-h-[280px] object-cover object-center sm:min-h-[360px] lg:min-h-full"
              />
            </div>

            <div className="flex flex-col justify-center">
              <h2
                id="contact-cta-heading"
                className="font-heading text-[28px] font-normal leading-[1.2] tracking-normal sm:text-[40px] min-[1181px]:text-[48px]"
              >
                <span className="text-[var(--lw-accent)]">Reach Out and Take </span>
                <span className="italic text-[var(--lw-primary)]">the First Step</span>
              </h2>

              <div className="mt-8">
                <SwapButton href={bookHref}>{bookText}</SwapButton>
              </div>
              <div className="mt-8">
                <ContactForm variant="compact" />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
