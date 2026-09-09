import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Inner-page hero used across live Elementor templates: rounded #EEF3F7 card,
 * photo column + split Lora heading.
 */
export function InnerPageHero({
  image,
  imageSide = 'left',
  title,
  accent,
  accentFirst = false,
  lead,
  leadSize = 'body',
  children,
}: {
  image?: { src: string; alt: string };
  imageSide?: 'left' | 'right';
  title: string;
  accent?: string;
  /** When true, `title` is italic blue and `accent` is green (contact/fees). */
  accentFirst?: boolean;
  lead?: string;
  leadSize?: 'body' | 'subhead';
  children?: ReactNode;
}) {
  const heading = (
    <h1 className="font-heading text-[35px] font-normal leading-[1.15] tracking-[-3px] sm:max-desktop:text-[48px] desktop:text-[56px]">
      {accentFirst ? (
        <>
          <span className="italic tracking-normal text-[var(--lw-primary)] sm:max-desktop:text-[50px] sm:leading-[1.05] desktop:text-[60px]">
            {title}
            {accent ? ' ' : ''}
          </span>
          {accent && <span className="text-[var(--lw-accent)]">{accent}</span>}
        </>
      ) : (
        <>
          <span className="text-[var(--lw-accent)]">
            {title}
            {accent ? ' ' : ''}
          </span>
          {accent && (
            <span className="italic tracking-normal text-[var(--lw-primary)] sm:max-desktop:text-[50px] sm:leading-[1.05] desktop:text-[60px]">
              {accent}
            </span>
          )}
        </>
      )}
    </h1>
  );

  const copy = (
    <div
      className={cn(
        'flex flex-col justify-center gap-8 px-5 py-10 sm:gap-10 sm:px-[60px] sm:py-[60px] lg:px-20 lg:py-10',
        image ? 'lg:w-[45%]' : 'w-full'
      )}
    >
      {heading}
      {lead && (
        <p
          className={
            leadSize === 'subhead'
              ? 'font-body text-[18px] font-normal leading-[1.35] text-[#374151] sm:max-desktop:text-[20px] desktop:text-[22px]'
              : 'text-[14px] leading-[1.45] text-[#374151] sm:max-desktop:text-[16px] desktop:text-[18px]'
          }
        >
          {lead}
        </p>
      )}
      {children}
    </div>
  );

  const photo = image ? (
    <div className="relative min-h-[400px] sm:min-h-[500px] lg:min-h-[570px] lg:w-[55%]">
      {image.src.startsWith('http') ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.src} alt={image.alt} className="absolute inset-0 h-full w-full object-cover object-center" />
      ) : (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover object-center"
        />
      )}
    </div>
  ) : null;

  const imageFirst = imageSide === 'left';

  return (
    <section className="px-5 pb-16 pt-4 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
      <div
        className={cn(
          'mx-auto flex max-w-[1840px] overflow-hidden rounded-[20px] bg-[#EEF3F7] sm:rounded-[30px]',
          image && 'lg:min-h-[570px]',
          image
            ? imageFirst
              ? 'flex-col lg:flex-row'
              : 'flex-col-reverse lg:flex-row'
            : 'flex-col'
        )}
      >
        {image && imageFirst ? (
          <>
            {photo}
            {copy}
          </>
        ) : (
          <>
            {copy}
            {photo}
          </>
        )}
      </div>
    </section>
  );
}
