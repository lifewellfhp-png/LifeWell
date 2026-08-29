'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Container, Section } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { insuranceCarriers as staticCarriers } from '@/data/marketing';
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
  ctaLabel = 'View fees & insurance details',
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
            className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]"
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
          <p className="mx-auto mt-5 max-w-[46rem] text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
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
  const count = carriers.length;
  const loop = [...carriers, ...carriers];
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(6);
  const [paused, setPaused] = useState(false);
  const [instant, setInstant] = useState(false);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setVisible(w >= 1024 ? 6 : w >= 768 ? 5 : w >= 640 ? 3 : 2);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || paused) return;
    const id = window.setInterval(() => setIndex((i) => i + 1), 5000);
    return () => window.clearInterval(id);
  }, [paused]);

  useEffect(() => {
    if (index !== count) return;
    const timeout = window.setTimeout(() => {
      setInstant(true);
      setIndex(0);
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [index, count]);

  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setInstant(false));
    });
    return () => cancelAnimationFrame(id);
  }, [instant]);

  const slide = Math.min(index, count);

  return (
    <div
      className="mt-12 overflow-hidden sm:mt-14"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <p className="sr-only">
        Accepted plans: {carriers.map((c) => c.name).join(', ')}.
      </p>
      <ul
        aria-hidden="true"
        className="flex items-center"
        style={{
          transform: `translateX(-${(slide * 100) / visible}%)`,
          transition: instant ? 'none' : 'transform 500ms ease',
        }}
      >
        {loop.map((carrier, i) => (
          <li
            key={`${carrier.name}-${i}`}
            className="flex shrink-0 items-center justify-center px-3 sm:px-5"
            style={{ width: `${100 / visible}%` }}
          >
            <div className="flex h-16 w-full max-w-[168px] items-center justify-center rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-sm sm:h-20 sm:p-4">
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

  const isFallback = src === FALLBACK_LOGO;
  const className = `h-full w-full object-contain object-center ${isFallback ? 'max-h-8 max-w-8 opacity-80 sm:max-h-9 sm:max-w-9' : ''}`;

  return src.startsWith('http') ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={carrier.width}
      height={carrier.height}
      onError={handleError}
      className={className}
    />
  ) : (
    <Image
      src={src}
      alt=""
      width={carrier.width}
      height={carrier.height}
      loading="lazy"
      onError={handleError}
      className={className}
    />
  );
}
