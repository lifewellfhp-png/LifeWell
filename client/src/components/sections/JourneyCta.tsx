import Image from 'next/image';
import { SwapButton } from '@/components/ui/SwapButton';
import { site } from '@/data/site';

/** Live closing band: photo + “Start Your Mental Wellness Journey Today”. */
export function JourneyCta({
  image,
  imageSide = 'left',
  title = 'Start',
  accent = 'Your Mental Wellness',
  after = 'Journey Today',
  body = 'Getting started is simple. Choose an available appointment time that works for you.',
  cta = 'Book an Appointment',
  href = site.booking.page,
  trackAs,
}: {
  image: { src: string; alt: string; width: number; height: number };
  imageSide?: 'left' | 'right';
  title?: string;
  accent?: string;
  after?: string;
  body?: string;
  cta?: string;
  href?: string;
  /** Opt-in conversion tracking; omit if this instance isn't a booking CTA. */
  trackAs?: 'booking_click';
}) {
  const copy = (
    <div>
      <h2 className="max-w-[16ch] font-heading text-[30px] font-normal leading-[1.15] tracking-[-3px] sm:text-[48px] min-[1181px]:text-[56px]">
        <span className="text-[var(--lw-accent)]">{title} </span>
        <span className="italic tracking-normal text-[var(--lw-primary)]">{accent}</span>
        {after ? <span className="text-[var(--lw-accent)]"> {after}</span> : null}
      </h2>
      <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.45] text-[#374151] sm:text-[16px] min-[1181px]:text-[18px]">
        {body}
      </p>
      <div className="mt-8">
        <SwapButton href={href} trackAs={trackAs}>{cta}</SwapButton>
      </div>
    </div>
  );

  const photo = (
    <div>
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading="lazy"
        sizes="(min-width: 1024px) 50vw, 92vw"
        className="h-auto w-full rounded-[30px] object-cover"
      />
    </div>
  );

  return (
    <section className="bg-white px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]">
      <div className="mx-auto grid max-w-[1840px] items-center gap-10 lg:grid-cols-2 lg:gap-20">
        {imageSide === 'left' ? (
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
