import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { JourneyCta } from '@/components/sections/JourneyCta';
import { PatientTrustSection } from '@/components/sections/BookingProfiles';
import {
  testimonials as staticTestimonials,
  testimonialsCta,
  testimonialsSection,
} from '@/data/marketing';
import type { Testimonial } from '@/types/content';
import type { BookingProfiles } from '@/lib/cms-resolve';

/**
 * /telehealth-mental-health-testimonials — Elementor post 50982.
 * Lorem / John Doe placeholders from the live page are omitted.
 */
export function TestimonialsPageContent({
  testimonials = staticTestimonials,
  bookingUrl,
  bookingProfiles,
}: {
  testimonials?: Testimonial[];
  bookingUrl?: string;
  bookingProfiles?: BookingProfiles;
}) {
  const PAGE_QUOTES = testimonials.length > 1 ? testimonials.slice(1) : testimonials;
  return (
    <div className="bg-white">
      <InnerPageHero
        image={{
          src: '/images/sections/Telehealth-Mental-Health-Testimonials.avif',
          alt: 'Patient testimonials for telehealth mental health care',
        }}
        imageSide="left"
        title="Telehealth Mental Health Testimonials"
        accent="from Real Patients"
        lead="Read authentic telehealth mental health testimonials from individuals who have experienced compassionate, professional, and confidential online mental health support."
        leadSize="subhead"
      />

      <section
        aria-labelledby="patients-saying-heading"
        className="relative overflow-hidden bg-white px-5 pb-16 sm:px-[30px] sm:pb-24 lg:px-10 lg:pb-[150px] min-[1601px]:px-[80px]"
      >
        <div className="relative mx-auto max-w-[1840px]">
          <div className="mx-auto max-w-[40rem] text-center">
            <p className="mx-auto w-fit rounded-[7px] bg-[#EEF3F7] px-4 py-1 text-[11px] font-semibold uppercase tracking-[1px] text-[var(--lw-accent)] sm:text-[12px] min-[1181px]:text-[13px]">
              {testimonialsSection.eyebrow}
            </p>
            <h2
              id="patients-saying-heading"
              className="mt-5 font-heading text-[30px] font-normal leading-[1.15] tracking-[-2px] sm:text-[48px] min-[1181px]:text-[56px]"
            >
              <span className="text-[var(--lw-accent)]">What Patients </span>
              <span className="italic text-[var(--lw-primary)]">Are Saying</span>
            </h2>
            <p className="mt-5 text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
              Honest feedback from patients who found support, understanding, and lasting care.
            </p>
          </div>

          <ul className="mt-12 grid list-none grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
            {PAGE_QUOTES.map((item) => (
              <li
                key={item.author ?? item.quote.slice(0, 24)}
                className="rounded-[15px] bg-[#F4F7FA] p-7 sm:p-8"
              >
                <p className="text-center text-[16px] leading-[1.45] text-[#374151] min-[1181px]:text-[18px]">
                  {item.quote}
                </p>
                {item.author && (
                  <p className="mt-6 text-center text-[14px] font-bold text-[#374151] sm:text-[16px]">
                    {item.author}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {bookingProfiles && <PatientTrustSection profiles={bookingProfiles} />}

      <JourneyCta
        href={bookingUrl}
        image={{
          src: testimonialsSection.image.src,
          alt: '',
          width: testimonialsSection.image.width,
          height: testimonialsSection.image.height,
        }}
        imageSide="left"
        title="Begin Your Own Journey"
        accent="Toward Emotional Wellness"
        after=""
        body={testimonialsCta.body}
        cta="Book an Appointment"
      />
    </div>
  );
}
