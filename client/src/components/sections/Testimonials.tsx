'use client';

import { useEffect, useId, useState } from 'react';
import Image from 'next/image';
import type { Testimonial } from '@/types/content';
import { Container, Section } from '@/components/ui/Section';
import { testimonialsSection } from '@/data/marketing';
import { cn } from '@/lib/utils';

/**
 * Homepage testimonials — live layout is a featured quote (left) + photo
 * (right) with bullet navigation. One quote at a time, matching the
 * Elementor slider (`slider_per_view: 1`).
 */
export function Testimonials({ testimonials }: { testimonials: Testimonial[] }) {
  const headingId = useId();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = testimonials[index] ?? testimonials[0];

  useEffect(() => {
    if (testimonials.length < 2) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || paused) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 5000);
    return () => window.clearInterval(id);
  }, [paused, testimonials.length]);

  if (!current) return null;

  return (
    <Section
      tone="base"
      aria-labelledby={headingId}
      className="relative overflow-hidden bg-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#e8f4f2_0%,_transparent_68%)]"
      />
      <Container className="relative">
        <div className="mx-auto max-w-[46rem] text-center">
          <h2
            id={headingId}
            className="font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]"
          >
            <span className="text-[var(--lw-accent)]">What Patients </span>
            <span className="italic text-[var(--lw-primary)]">Are Saying</span>
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-[16px] leading-[1.45] text-text-secondary min-[1181px]:text-[18px]">
            {testimonialsSection.body}
          </p>
        </div>

        <div className="mt-12 grid items-center gap-10 lg:mt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <figure
            className="min-w-0"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocusCapture={() => setPaused(true)}
            onBlurCapture={() => setPaused(false)}
          >
            <blockquote>
              <p className="font-heading text-[20px] font-normal leading-[1.55] text-[var(--lw-accent)] sm:text-[24px] min-[1181px]:text-[28px]">
                {current.quote}
              </p>
            </blockquote>
            {current.author && (
              <figcaption className="mt-8 font-body text-[13px] font-semibold uppercase tracking-[2px] text-[#8A94A0]">
                {current.author}
              </figcaption>
            )}

            {testimonials.length > 1 && (
              <div className="mt-10 flex items-center gap-2.5" role="tablist" aria-label="Testimonials">
                {testimonials.map((t, i) => (
                  <button
                    key={t.author ?? i}
                    type="button"
                    role="tab"
                    aria-selected={i === index}
                    aria-label={`Show testimonial ${i + 1} of ${testimonials.length}`}
                    onClick={() => setIndex(i)}
                    className={cn(
                      'size-2.5 rounded-full transition-colors duration-300',
                      i === index ? 'bg-[#374151]' : 'bg-[#D5DCE3] hover:bg-[#9AA6B2]'
                    )}
                  />
                ))}
              </div>
            )}
          </figure>

          <div className="overflow-hidden rounded-[30px] lg:rounded-[40px]">
            <Image
              src={testimonialsSection.image.src}
              alt=""
              width={testimonialsSection.image.width}
              height={testimonialsSection.image.height}
              loading="lazy"
              sizes="(min-width: 1024px) 42vw, 92vw"
              className="w-full object-cover"
            />
          </div>
        </div>
      </Container>
    </Section>
  );
}

export function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  return (
    <figure className="flex h-full flex-col rounded-[30px] border border-border-subtle bg-surface-raised p-5 sm:p-7">
      {testimonial.rating !== null && <Rating value={testimonial.rating} />}

      <blockquote className="mt-5 flex-1">
        <p className="font-heading text-lead leading-relaxed text-text-primary">
          {testimonial.quote}
        </p>
      </blockquote>

      {testimonial.author && (
        <figcaption className="mt-6 flex items-center gap-3 border-t border-border-subtle pt-5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-primary-soft font-heading text-md font-semibold text-brand-primary-solid"
          >
            {testimonial.author
              .split(' ')
              .map((p) => p[0])
              .slice(0, 2)
              .join('')}
          </span>
          <span className="text-sm font-semibold text-text-primary">{testimonial.author}</span>
        </figcaption>
      )}
    </figure>
  );
}

function Rating({ value }: { value: number }) {
  return (
    <p className="flex items-center gap-1" aria-label={`Rated ${value} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} filled={i < value} />
      ))}
    </p>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 20 20"
      className={filled ? 'text-brand-accent-strong' : 'text-border-strong'}
      fill="currentColor"
    >
      <path d="M10 1.8l2.4 5 5.5.8-4 3.9.95 5.5L10 14.4l-4.9 2.6.95-5.5-4-3.9 5.5-.8L10 1.8Z" />
    </svg>
  );
}
