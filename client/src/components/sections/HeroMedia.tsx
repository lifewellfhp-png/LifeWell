'use client';

import { useEffect, useRef } from 'react';
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
export const HERO_POSTER_SRC = '/images/sections/home-hero-poster.jpg';

export function HeroMedia({
  image,
  hasCmsImage,
}: {
  image?: { src: string; alt: string };
  hasCmsImage?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cmsImage = hasCmsImage && image && isUsableImageSrc(image.src) ? image : null;

  useEffect(() => {
    if (cmsImage) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      if (query.matches) {
        videoRef.current?.pause();
      } else {
        void videoRef.current?.play();
      }
    };
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, [cmsImage]);

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
    <video
      ref={videoRef}
      className="absolute inset-0 -z-20 h-full w-full object-cover object-[80%_center]"
      poster={HERO_POSTER_SRC}
      // React's DOM typings don't model fetchPriority on <video> yet (it's
      // valid HTML/supported by Chrome) — spread it in as a plain attribute.
      {...{ fetchpriority: 'high' }}
      muted
      loop
      playsInline
      preload="none"
      // Decorative; the heading carries the meaning.
      aria-hidden="true"
      tabIndex={-1}
    >
      <source src="/video/home-hero.mp4" type="video/mp4" />
    </video>
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
