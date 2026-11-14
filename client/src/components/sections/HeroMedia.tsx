'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { isOptimizableImageSrc } from '@/lib/site-asset';

/**
 * Hero background media.
 *
 * A CMS image takes precedence when available. Otherwise the <video>
 * (showing its own `poster` image) is the LCP element from first paint —
 * it used to be conditionally mounted only after a client-side
 * matchMedia effect ran, which meant the real first paint was a separate
 * <Image> showing the same poster, and the video mounting moments later
 * registered as a *second*, larger-or-equal LCP candidate at the same
 * spot. Chrome's LCP metric keeps replacing its recorded candidate with
 * any later same-or-larger paint, so that second element (appearing only
 * after hydration + an effect) was resetting LCP to a much later
 * timestamp — found via Lighthouse's lcp-discovery-insight audit
 * ("Request is discoverable in initial document: false") on an otherwise
 * well-optimized poster image. Now the <video poster> is always in the
 * initial markup (poster images need no JS to paint, same as an <img>),
 * so there's only ever one element at that position; motion preference
 * only controls whether `.play()` is called, via a ref, not whether the
 * element exists.
 */
export const HERO_POSTER_SRC = '/images/sections/home-hero-poster.webp';
const HERO_DESKTOP_POSTER_SRC = '/images/sections/home-hero-poster-desktop.webp';

export function HeroMedia({
  image,
  hasCmsImage,
}: {
  image?: { src: string; alt: string };
  hasCmsImage?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadVideo, setLoadVideo] = useState(false);
  const cmsImage = hasCmsImage && image && isUsableImageSrc(image.src) ? image : null;

  useEffect(() => {
    if (cmsImage) return;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktopQuery = window.matchMedia('(min-width: 768px)');
    const saveData = 'connection' in navigator && Boolean(
      (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData,
    );
    if (motionQuery.matches || !desktopQuery.matches || saveData) return;

    let cancelled = false;
    const schedule = () => {
      const callback = () => {
        if (!cancelled) setLoadVideo(true);
      };
      if (typeof window.requestIdleCallback === 'function') {
        window.requestIdleCallback(callback, { timeout: 1500 });
      } else {
        setTimeout(callback, 0);
      }
    };
    if (document.readyState === 'complete') {
      schedule();
    } else {
      window.addEventListener('load', schedule, { once: true });
    }
    return () => {
      cancelled = true;
      window.removeEventListener('load', schedule);
    };
  }, [cmsImage]);

  useEffect(() => {
    if (!loadVideo) return;
    void videoRef.current?.play();
  }, [loadVideo]);

  if (cmsImage) {
    return isOptimizableImageSrc(cmsImage.src) ? (
      <Image
        src={cmsImage.src}
        alt={cmsImage.alt}
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="-z-20 object-cover object-[80%_center]"
      />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cmsImage.src}
        alt={cmsImage.alt}
        fetchPriority="high"
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[80%_center]"
      />
    );
  }

  return (
    <>
      <picture>
        <source media="(min-width: 768px)" srcSet={HERO_DESKTOP_POSTER_SRC} />
        <img
          src={HERO_POSTER_SRC}
          alt=""
          fetchPriority="high"
          sizes="(max-width: 767px) 100vw, 100vw"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[80%_center]"
          aria-hidden="true"
        />
      </picture>
      {loadVideo && (
        <video
          ref={videoRef}
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[80%_center]"
          poster={HERO_DESKTOP_POSTER_SRC}
          preload="none"
          muted
          loop
          playsInline
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/video/home-hero.mp4" type="video/mp4" />
        </video>
      )}
    </>
  );
}

export function isUsableImageSrc(src: string): boolean {
  if (!src || /^(data:|blob:|\/\/)/i.test(src)) return false;
  if (src.startsWith('/')) return src.length > 1;
  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
