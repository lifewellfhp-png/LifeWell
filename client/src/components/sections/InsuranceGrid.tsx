'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Container, Section } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { insuranceCarriers as staticCarriers } from '@/data/marketing';
import { isOptimizableImageSrc } from '@/lib/site-asset';
import type { InsuranceCarrier } from '@/types/content';

const FALLBACK_LOGO = '/images/insurance/insurance-placeholder.svg';

/**
 * Live homepage insurance band: centered split heading + 6 wordmark logos
 * per view (Elementor media carousel, autoplay 5s, infinite).
 */
export function InsuranceGrid({
  showCta = true,
  showDisclaimer = true,
  heading = 'Insurance & Self-Pay Options',
  title,
  accent,
  body = 'We offer self-pay options for all patients. Insurance participation is limited by state and plan. Massachusetts and Arizona visits are self-pay only at this time.',
  disclaimer = 'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.',
  ctaLabel = 'View Fees & Insurance',
  ctaHref = '/fees-insurance',
  carriers = staticCarriers,
}: {
  showCta?: boolean;
  showDisclaimer?: boolean;
  heading?: string;
  title?: string;
  accent?: string;
  body?: string;
  disclaimer?: string;
  ctaLabel?: string;
  ctaHref?: string;
  carriers?: InsuranceCarrier[];
}) {
  return (
    <Section
      tone="transparent"
      aria-labelledby="insurance-heading"
      className="bg-[#F7FAFC]"
    >
      <Container>
        <div className="mx-auto max-w-[48rem] text-center">
          <h2
            id="insurance-heading"
            className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:max-desktop:text-[48px] desktop:text-[56px]"
          >
            {title ? (
              <>
                <span className="text-[var(--lw-accent)]">{title} </span>
                <span className="italic text-[var(--lw-primary)]">{accent}</span>
              </>
            ) : (
              heading
            )}
          </h2>
          <p className="mx-auto mt-5 max-w-[46rem] text-[16px] leading-[1.45] text-[#374151] desktop:text-[18px]">
            {body}
          </p>
        </div>

        <LogoCarousel carriers={carriers} />

        {showDisclaimer && (
          <p className="mx-auto mt-8 max-w-[70ch] text-center text-sm text-text-secondary">
            {disclaimer}
          </p>
        )}

        {showCta && (
          <div className="mt-9 flex justify-center">
            <SwapButton href={ctaHref}>{ctaLabel}</SwapButton>
          </div>
        )}
      </Container>
    </Section>
  );
}

function LogoCarousel({ carriers }: { carriers: InsuranceCarrier[] }) {
  return (
    <div
      className="mt-12 overflow-x-auto scroll-smooth sm:mt-14"
      tabIndex={0}
      aria-label="Accepted insurance plans"
    >
      <p className="sr-only">
        Accepted plans: {carriers.map((c) => c.name).join(', ')}.
      </p>
      <ul className="flex min-w-max items-center">
        {carriers.map((carrier) => (
          <li
            key={carrier.name}
            className="flex w-[50vw] shrink-0 items-center justify-center px-3 sm:w-[33.333vw] sm:px-5 md:w-[20vw] lg:w-[16.666vw]"
          >
            <div className="aspect-[220/100] w-full max-w-[200px] sm:max-w-[220px]">
              <CarrierLogo carrier={carrier} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CarrierLogo({ carrier }: { carrier: InsuranceCarrier }) {
  const [src, setSrc] = useState(carrier.logo || FALLBACK_LOGO);

  const handleError = () => {
    setSrc((current) => (current === FALLBACK_LOGO ? current : FALLBACK_LOGO));
  };

  const className = 'h-full w-full object-contain object-center';

  return isOptimizableImageSrc(src) ? (
    <Image
      src={src}
      alt=""
      width={carrier.width}
      height={carrier.height}
      loading="lazy"
      sizes="(min-width: 640px) 220px, 45vw"
      onError={handleError}
      className={className}
    />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      width={carrier.width}
      height={carrier.height}
      onError={handleError}
      className={className}
    />
  );
}
