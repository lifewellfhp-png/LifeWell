'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

/**
 * Hero background media.
 *
 * A CMS image takes precedence when available. Otherwise the static poster is
 * rendered as the LCP element and the 1.1 MB loop is layered on top only once
 * it can play, with reduced-motion visitors staying on the poster.
 */
export function HeroMedia({
  image,
}: {
  image?: { src: string; alt: string };
}) {
  const [allowMotion, setAllowMotion] = useState(false);
  const cmsImage = image && isUsableImageSrc(image.src) ? image : null;

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAllowMotion(!query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  const heroImage = cmsImage ? (
    cmsImage.src.startsWith('http') ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={cmsImage.src}
        alt={cmsImage.alt}
        className="absolute inset-0 -z-20 h-full w-full object-cover object-[68%_center]"
      />
    ) : (
      <Image
        src={cmsImage.src}
        alt={cmsImage.alt}
        fill
        priority
        fetchPriority="high"
        sizes="100vw"
        className="-z-20 object-cover object-[68%_center]"
      />
    )
  ) : (
    <Image
      src="/images/sections/home-hero-poster.jpg"
      alt=""
      fill
      priority
      fetchPriority="high"
      sizes="100vw"
      className="-z-20 object-cover object-[68%_center]"
    />
  );

  return (
    <>
      {heroImage}

      {!cmsImage && allowMotion && (
        <video
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[68%_center]"
          poster="/images/sections/home-hero-poster.jpg"
          autoPlay
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
      )}
    </>
  );
}

function isUsableImageSrc(src: string): boolean {
  if (!src || /^(data:|blob:|\/\/)/i.test(src)) return false;
  if (src.startsWith('/')) return src.length > 1;
  try {
    const url = new URL(src);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
