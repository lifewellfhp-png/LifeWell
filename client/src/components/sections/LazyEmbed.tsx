'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Defers mounting a third-party video iframe until the container scrolls
 * near the viewport. VideosSection sits at the bottom of the homepage, but
 * an eagerly-rendered iframe still has the browser open connections to
 * youtube.com/ytimg.com/fonts.gstatic.com during initial load — irrelevant
 * to the hero above it, but still competing for early network priority.
 * The wrapper keeps the same aspect-ratio box so nothing shifts once the
 * real embed mounts.
 *
 * Renders a real <iframe> element (not an HTML string via
 * dangerouslySetInnerHTML) — src/sandbox/allow are the only inputs, and the
 * caller is responsible for having validated `src` (see lib/videoEmbed.ts).
 * See P4-E3.
 */
export function LazyEmbed({
  src,
  title,
  allow,
  className,
}: {
  src: string;
  title: string;
  allow?: string;
  className?: string;
}) {
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
        <iframe
          className="h-full w-full"
          src={src}
          title={title}
          allow={allow}
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
      )}
    </div>
  );
}
