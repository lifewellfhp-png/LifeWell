'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Defers mounting a third-party embed (YouTube/Vimeo iframe HTML) until the
 * container scrolls near the viewport. VideosSection sits at the bottom of
 * the homepage, but an eagerly-rendered iframe still has the browser open
 * connections to youtube.com/ytimg.com/fonts.gstatic.com during initial
 * load — irrelevant to the hero above it, but still competing for early
 * network priority. The wrapper keeps the same aspect-ratio box so nothing
 * shifts once the real embed mounts.
 */
export function LazyEmbed({ html, className }: { html: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;
    const node = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className={className}>
      {visible && (
        <div className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  );
}
