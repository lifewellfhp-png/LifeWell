'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { Stat } from '@/types/content';
import { Container } from '@/components/ui/Section';
import { SwapButton } from '@/components/ui/SwapButton';
import { formatCount } from '@/lib/utils';
import { site } from '@/data/site';

/**
 * Live “Start Your Mental Wellness Journey” band: rounded photo with
 * left-aligned split heading + booking button, followed by optional stats.
 */
export function StatsBand({ stats, bookingUrl }: { stats: Stat[]; bookingUrl?: string }) {
  const bookHref = bookingUrl ?? site.booking.page;
  return (
    <section aria-labelledby="stats-heading" className="bg-white py-14 md:py-24">
      <Container>
        <div className="relative isolate min-h-[420px] overflow-hidden rounded-[40px] lg:min-h-[560px]">
          <Image
            src="/images/sections/Your-Mental-Wellness-Journey.avif"
            alt=""
            fill
            loading="lazy"
            sizes="(min-width: 1601px) 1280px, 92vw"
            className="object-cover"
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-r from-white via-white/80 to-white/10 sm:from-white/95 sm:via-white/55 sm:to-transparent"
          />

          <div className="relative z-10 flex min-h-[420px] items-center px-6 py-12 sm:px-10 lg:min-h-[560px] lg:px-16">
            <div className="max-w-[38rem]">
              <h2
                id="stats-heading"
                className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[42px] min-[1181px]:text-[52px]"
              >
                <span className="text-[var(--lw-primary)]">Start Your Mental </span>
                <span className="italic text-[var(--lw-accent)]">Wellness</span>
                <span className="text-[var(--lw-primary)]"> Journey Today</span>
              </h2>
              <p className="mt-5 max-w-[42ch] font-heading text-[16px] font-normal italic leading-[1.45] text-text-primary sm:text-[18px]">
                Getting started is simple. Choose an available appointment time that works for you.
              </p>
              <div className="mt-8">
                <SwapButton href={bookHref}>Book an Appointment</SwapButton>
              </div>
            </div>
          </div>
        </div>

        {stats.length > 0 ? (
          <dl className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:mt-16 lg:grid-cols-3">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="px-4 py-6 text-center sm:px-6 lg:border-l lg:border-border-subtle lg:first:border-l-0"
              >
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <Counter value={stat.value} suffix={stat.suffix} />
                  <span
                    aria-hidden="true"
                    className="mt-2 block font-body text-[13px] font-normal leading-snug text-text-primary sm:text-[14px] min-[1181px]:text-[15px]"
                  >
                    {stat.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </Container>
    </section>
  );
}

function Counter({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || started) return;

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        setStarted(true);

        const duration = 1400;
        const start = performance.now();
        let frame = 0;

        const tick = (now: number) => {
          const progress = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };

        setDisplay(0);
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
      },
      { threshold: 0.4 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [value, started]);

  return (
    <span
      ref={ref}
      className="block font-heading text-[42px] font-normal leading-none text-[var(--lw-primary)] sm:text-[52px] min-[1181px]:text-[56px]"
    >
      {formatCount(display)}
      {suffix}
    </span>
  );
}
