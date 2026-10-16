'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Subtle scroll-reveal wrapper (Phase 23 premium redesign). Progressive
 * enhancement, not a requirement for content to appear: on first render
 * (including with JS disabled) children are fully visible; only after this
 * component mounts does it add `.reveal-pending` (globals.css), then
 * `.reveal-visible` once scrolled into view. Reduced motion is handled by
 * globals.css's existing sitewide `prefers-reduced-motion: reduce` block,
 * which already collapses every transition's duration — no separate
 * handling needed here.
 */
export function Reveal({
  children,
  className,
  delayMs = 0,
}: {
  children: ReactNode;
  className?: string;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setPending(true);
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        timer = setTimeout(() => setVisible(true), delayMs);
        observer.disconnect();
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [delayMs]);

  return (
    <div ref={ref} className={cn(pending && 'reveal-pending', visible && 'reveal-visible', className)}>
      {children}
    </div>
  );
}
