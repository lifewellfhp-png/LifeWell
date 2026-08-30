import { cache } from 'react';
import type { Benefit, Faq, Testimonial, InsuranceCarrier, Stat, Step } from '@/types/content';
import { fetchPublicCms, type PublicCmsPayload } from '@/lib/cms';
import {
  faqs as staticFaqs,
  testimonials as staticTestimonials,
  insuranceCarriers as staticInsurance,
  hero as staticHero,
  welcome as staticWelcome,
  benefits as staticBenefits,
  benefitsSection as staticBenefitsSection,
  howItWorks as staticHowItWorks,
  steps as staticSteps,
  stats as staticStats,
  servicesSection as staticServicesSection,
} from '@/data/marketing';
import { site as staticSite } from '@/data/site';
import {
  feesFaqs as staticFeesFaqs,
  feesIntro as staticFeesIntro,
  psychiatricStatePricing as staticPsychiatricStatePricing,
  selfPay as staticSelfPay,
} from '@/data/pricing';
import {
  homeServiceSummaries as staticHomeServices,
  serviceSummaries as staticServiceSummaries,
  serviceHref,
} from '@/data/service-catalog';
import type { ServiceSummary } from '@/types/content';
import { siteAssetSrc } from '@/lib/site-asset';
import { telehealthStates as staticTelehealthStates, type TelehealthState } from '@/data/telehealth-states';

export type ResolvedHero = typeof staticHero & {
  headingPrimary?: string;
  headingAccent?: string;
  /** True only when the owner has actually set a hero image in the CMS —
   * distinct from `image`, which always carries a safe value (CMS image or
   * the static fallback) so existing consumers never see an empty src. */
  hasCmsImage?: boolean;
};

export type ResolvedContent = {
  source: 'cms' | 'static';
  hero: ResolvedHero;
  welcome: typeof staticWelcome;
  faqs: Faq[];
  feesFaqs: Faq[];
  testimonials: Testimonial[];
  insurance: InsuranceCarrier[];
  insuranceSection: {
    heading: string;
    body: string;
    disclaimer: string;
    ctaLabel: string;
    ctaHref: string;
  };
  homeServices: ServiceSummary[];
  serviceSummaries: ServiceSummary[];
  servicesIntro: { eyebrow: string; heading: string; body: string; cta: string };
  benefitsHeading: string;
  benefits: Benefit[];
  howItWorks: { eyebrow: string; heading: string; body: string };
  steps: Step[];
  stats: Stat[];
  booking: { url: string; page: string; label: string };
  announcements: { title: string; body: string; tone: string }[];
  videos: { title: string; url: string; provider: string; description?: string | null; embedHtml?: string | null }[];
  settings: {
    primaryColor: string;
    accentColor: string;
    headingFont: string;
    bodyFont: string;
    headerCtaLabel: string;
    headerCtaUrl: string;
    logoUrl: string | null;
    practicePhone: string | null;
    practiceEmail: string | null;
  };
  provider: {
    name: string;
    credentials: string;
    title?: string | null;
    bio?: string | null;
    photoUrl?: string | null;
    education: string[];
    certifications: string[];
  } | null;
  locations: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    street?: string | null;
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    hours: string[];
    isPrimary: boolean;
  }[];
  telehealthStates: TelehealthState[];
  bookingProfiles: BookingProfiles;
  seoByPath: Record<
    string,
    {
      title: string | null;
      description: string | null;
      ogImageUrl: string | null;
      noindex: boolean;
    }
  >;
  posts: {
    slug: string;
    title: string;
    excerpt?: string | null;
    coverImageUrl?: string | null;
    authorName?: string | null;
    category?: string | null;
    publishedAt?: string | null;
    body?: string | null;
  }[];
  fees: {
    introHeading: string;
    introBody: string;
    selfPayHeading: string;
    selfPayBody: string[];
    insuranceDisclaimer: string;
    psychiatricStatePricing: typeof staticPsychiatricStatePricing;
  };
  serviceDetails: {
    slug: string;
    title: string;
    summary: string;
    body: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
  }[];
};

type CmsService = {
  slug?: string;
  title?: string;
  summary?: string | null;
  body?: string | null;
  published?: boolean;
  sort_order?: number;
  image_url?: string | null;
  icon?: string | null;
  category?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
};

type CmsSection = {
  page_key?: string;
  section_key?: string;
  title?: string | null;
  content?: Record<string, unknown> | null;
  published?: boolean;
  updated_at?: string;
};

function cmsLive(cms: PublicCmsPayload | null): boolean {
  return Boolean(cms);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function latestSection(cms: PublicCmsPayload | null, page: string, key: string): CmsSection | undefined {
  const sections = (cms?.sections ?? []) as CmsSection[];
  return [...sections]
    .filter((s) => s.page_key === page && s.section_key === key && s.published !== false)
    .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))[0];
}

function sectionContent(cms: PublicCmsPayload | null, page: string, key: string): Record<string, unknown> | null {
  const row = latestSection(cms, page, key);
  return asRecord(row?.content);
}

function mapFaqs(cms: PublicCmsPayload | null, live: boolean): Faq[] {
  const rows = (cms?.faqs ?? []) as { question?: string; answer?: string; category?: string | null }[];
  const mapped = rows
    .filter((r) => r.question && r.answer && String(r.category || 'General') !== 'Fees')
    .map((r) => ({ question: String(r.question), answer: String(r.answer) }));
  if (live) return mapped;
  return mapped.length ? mapped : staticFaqs;
}

function mapFeesFaqs(cms: PublicCmsPayload | null, live: boolean): Faq[] {
  const rows = (cms?.faqs ?? []) as { question?: string; answer?: string; category?: string | null }[];
  const mapped = rows
    .filter((r) => r.question && r.answer && String(r.category || '') === 'Fees')
    .map((r) => ({ question: String(r.question), answer: String(r.answer) }));
  if (live) return mapped;
  return mapped.length ? mapped : staticFeesFaqs;
}

function mapTestimonials(cms: PublicCmsPayload | null, live: boolean): Testimonial[] {
  const rows = (cms?.testimonials ?? []) as {
    quote?: string;
    author_name?: string;
    author_role?: string | null;
    rating?: number | null;
  }[];
  const mapped = rows
    .filter((r) => r.quote && r.author_name)
    .map((r) => ({
      quote: String(r.quote),
      author: String(r.author_name),
      role: r.author_role ? String(r.author_role) : undefined,
      rating: typeof r.rating === 'number' ? r.rating : 5,
    }));
  if (live) return mapped;
  return mapped.length ? mapped : staticTestimonials;
}

function mapInsurance(cms: PublicCmsPayload | null, live: boolean): InsuranceCarrier[] {
  const rows = (cms?.insurance ?? []) as {
    name?: string;
    logo_url?: string | null;
  }[];
  const mapped = rows
    .filter((r) => r.name)
    .map((r) => ({
      name: String(r.name),
      logo: (r.logo_url && siteAssetSrc(String(r.logo_url))) || '/images/insurance/insurance-placeholder.svg',
      width: 160,
      height: 64,
    }));
  if (live) return mapped;
  return mapped.length ? mapped : staticInsurance;
}

function mapInsuranceSection(cms: PublicCmsPayload | null) {
  const content = sectionContent(cms, 'home', 'insurance') ?? {};
  return {
    heading:
      typeof content.heading === 'string' && content.heading.trim()
        ? content.heading
        : 'Insurance & Self-Pay Options',
    body:
      typeof content.body === 'string' && content.body.trim()
        ? content.body
        : 'We offer self-pay options for all patients. Insurance participation is limited by state and plan. Massachusetts and Arizona visits are self-pay only at this time.',
    disclaimer:
      typeof content.disclaimer === 'string' && content.disclaimer.trim()
        ? content.disclaimer
        : 'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.',
    ctaLabel:
      typeof content.ctaLabel === 'string' && content.ctaLabel.trim()
        ? content.ctaLabel
        : 'View fees & insurance details',
    ctaHref:
      typeof content.ctaHref === 'string' && content.ctaHref.trim()
        ? content.ctaHref
        : '/fees-insurance',
  };
}

export function mapServiceSummaries(cms: PublicCmsPayload | null, live: boolean): ServiceSummary[] {
  const rows = (cms?.services ?? []) as CmsService[];
  if (!rows.length) return live ? [] : staticServiceSummaries;

  const bySlug = new Map(staticServiceSummaries.map((s) => [s.slug, s]));
  return rows
    .filter((r) => r.slug && r.title)
    .map((r) => {
      const slug = String(r.slug);
      const base = bySlug.get(slug);
      // A known slug keeps its known category. An unrecognized slug with no
      // explicit, valid CMS category must NOT become psychiatric by default —
      // that would silently make it MA/AZ-eligible (see TelehealthStatePageContent's
      // `category === 'psychiatric'` filter) without anyone having chosen that.
      // 'primary-care' is the safe default: it never unlocks MA/AZ display.
      const category =
        r.category === 'primary-care' || r.category === 'psychiatric'
          ? r.category
          : base?.category ?? 'primary-care';
      const imageSrc = siteAssetSrc(
        (typeof r.image_url === 'string' && r.image_url) ||
          (typeof r.icon === 'string' && r.icon) ||
          base?.image.src ||
          '/images/services/Psychiatric-Evaluation-Telehealth.avif'
      );
      return {
        slug,
        title: String(r.title),
        category,
        description: String(r.summary || base?.description || r.title),
        href: serviceHref(slug),
        image: {
          src: imageSrc,
          width: base?.image.width ?? 800,
          height: base?.image.height ?? 600,
          alt: String(r.title),
        },
      } satisfies ServiceSummary;
    });
}

function mapServiceDetails(cms: PublicCmsPayload | null) {
  const rows = (cms?.services ?? []) as CmsService[];
  return rows
    .filter((r) => r.slug && r.title)
    .map((r) => ({
      slug: String(r.slug),
      title: String(r.title),
      summary: String(r.summary || ''),
      body: r.body ? String(r.body) : null,
      seoTitle: r.seo_title ? String(r.seo_title) : null,
      seoDescription: r.seo_description ? String(r.seo_description) : null,
    }));
}

function mapHomeServices(cms: PublicCmsPayload | null, live: boolean): ServiceSummary[] {
  const all = mapServiceSummaries(cms, live);
  if (!live && all === staticServiceSummaries) return staticHomeServices;
  return all.slice(0, Math.max(4, Math.min(all.length, 8)));
}

function mapHero(cms: PublicCmsPayload | null): ResolvedHero {
  const row = latestSection(cms, 'home', 'hero');
  const content = asRecord(row?.content) ?? {};
  const headline =
    (typeof content.headline === 'string' && content.headline.trim()) ||
    (typeof content.heading === 'string' && content.heading.trim()) ||
    (typeof row?.title === 'string' && row.title.trim() && row.title !== 'Homepage hero' ? row.title : '') ||
    '';
  const subhead =
    (typeof content.subhead === 'string' && content.subhead.trim()) ||
    (typeof content.subheading === 'string' && content.subheading.trim()) ||
    '';
  const badge = typeof content.badge === 'string' ? content.badge : '';
  const imageUrl = typeof content.image === 'string' && content.image.trim() ? content.image.trim() : '';

  if (!headline && !subhead && !badge && !imageUrl) return staticHero;

  let headingPrimary = headline || staticHero.heading;
  let headingAccent = '';
  if (headline) {
    const parts = headline.split(/\s+/);
    const mid = Math.ceil(parts.length / 2);
    headingPrimary = parts.slice(0, mid).join(' ');
    headingAccent = parts.slice(mid).join(' ');
  }

  return {
    ...staticHero,
    heading: headline || staticHero.heading,
    subheading: subhead || staticHero.subheading,
    badge: badge || staticHero.badge,
    headingPrimary,
    headingAccent,
    hasCmsImage: Boolean(imageUrl),
    image: imageUrl ? { ...staticHero.image, src: siteAssetSrc(imageUrl) } : staticHero.image,
  };
}

function mapWelcome(cms: PublicCmsPayload | null): typeof staticWelcome {
  const content = (latestSection(cms, 'home', 'welcome')?.content ?? {}) as Record<string, unknown>;
  const heading = typeof content.heading === 'string' ? content.heading : null;
  const body = Array.isArray(content.body)
    ? content.body.filter((b): b is string => typeof b === 'string')
    : typeof content.body === 'string'
      ? [content.body]
      : null;
  const ctaLabel = typeof content.ctaLabel === 'string' && content.ctaLabel.trim() ? content.ctaLabel.trim() : null;
  const ctaHref = typeof content.ctaHref === 'string' && content.ctaHref.trim() ? content.ctaHref.trim() : null;
  const imageUrl = typeof content.image === 'string' && content.image.trim() ? content.image.trim() : null;

  if (!heading && !body && !ctaLabel && !ctaHref && !imageUrl) return staticWelcome;
  return {
    ...staticWelcome,
    heading: heading || staticWelcome.heading,
    body: body?.length ? body : staticWelcome.body,
    cta: {
      label: ctaLabel || staticWelcome.cta.label,
      href: ctaHref || staticWelcome.cta.href,
    },
    image: imageUrl ? { ...staticWelcome.image, src: siteAssetSrc(imageUrl) } : staticWelcome.image,
  };
}

function calendarEmbedUrl(value: string | undefined) {
  const url = (value || '').trim();
  if (/charmtracker\.com|clientsecure\.me/i.test(url)) return url;
  return staticSite.booking.url;
}

function mapBooking(cms: PublicCmsPayload | null): { url: string; page: string; label: string } {
  const rows = (cms?.booking ?? []) as { booking_url?: string; label?: string; active?: boolean }[];
  const active = rows.find((r) => r.active !== false && r.booking_url);
  return {
    url: calendarEmbedUrl(active?.booking_url),
    page: staticSite.booking.page,
    label: String(active?.label || staticSite.booking.label),
  };
}

function mapAnnouncements(cms: PublicCmsPayload | null) {
  const rows = (cms?.announcements ?? []) as {
    title?: string;
    body?: string;
    tone?: string;
    active?: boolean;
  }[];
  return rows
    .filter((r) => r.active !== false && r.title && r.body)
    .filter((r) => {
      const title = String(r.title).trim();
      const body = String(r.body).trim();
      return !(/^test$/i.test(title) && /^test$/i.test(body));
    })
    .map((r) => ({
      title: String(r.title),
      body: String(r.body),
      tone: String(r.tone || 'info'),
    }));
}

function mapVideos(cms: PublicCmsPayload | null) {
  const rows = (cms?.videos ?? []) as {
    title?: string;
    url?: string;
    provider?: string;
    description?: string | null;
    embed_html?: string | null;
    published?: boolean;
  }[];
  return rows
    .filter((r) => r.published !== false && r.title && (r.url || r.embed_html))
    .map((r) => ({
      title: String(r.title),
      url: String(r.url || ''),
      provider: String(r.provider || 'youtube'),
      description: r.description ?? null,
      embedHtml: r.embed_html ?? null,
    }));
}

const DEFAULT_SETTINGS = {
  primaryColor: '#3E7FB1',
  accentColor: '#5FAF6B',
  headingFont: 'Lora',
  bodyFont: 'Source Sans 3',
  headerCtaLabel: 'Book an Appointment',
  headerCtaUrl: '/book-telehealth-mental-health-appointment#charm-calendar',
  logoUrl: null as string | null,
  practicePhone: null as string | null,
  practiceEmail: null as string | null,
};

function hexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

function mapSettings(cms: PublicCmsPayload | null) {
  const row = (cms?.settings ?? null) as Record<string, unknown> | null;
  if (!row) return DEFAULT_SETTINGS;
  return {
    primaryColor: hexColor(row.primary_color, DEFAULT_SETTINGS.primaryColor),
    accentColor: hexColor(row.accent_color, DEFAULT_SETTINGS.accentColor),
    headingFont: typeof row.heading_font === 'string' ? row.heading_font : DEFAULT_SETTINGS.headingFont,
    bodyFont: typeof row.body_font === 'string' ? row.body_font : DEFAULT_SETTINGS.bodyFont,
    headerCtaLabel: typeof row.header_cta_label === 'string' ? row.header_cta_label : DEFAULT_SETTINGS.headerCtaLabel,
    headerCtaUrl: typeof row.header_cta_url === 'string' ? row.header_cta_url : DEFAULT_SETTINGS.headerCtaUrl,
    logoUrl: typeof row.logo_url === 'string' && row.logo_url ? siteAssetSrc(row.logo_url) : null,
    practicePhone: typeof row.practice_phone === 'string' && row.practice_phone ? row.practice_phone : null,
    practiceEmail: typeof row.practice_email === 'string' && row.practice_email ? row.practice_email : null,
  };
}

export type BookingProfiles = {
  zocdoc: {
    enabled: boolean;
    bookingUrl: string | null;
    profileUrl: string | null;
    ctaLabel: string;
    description: string | null;
    ratingEnabled: boolean;
    rating: number | null;
    reviewCount: number | null;
    ratingVerifiedAt: string | null;
  };
  psychologyToday: {
    enabled: boolean;
    profileUrl: string | null;
    contactUrl: string | null;
    ctaLabel: string;
    description: string | null;
  };
  display: {
    homepage: boolean;
    bookingPage: boolean;
    bioPage: boolean;
    reviewsPage: boolean;
  };
  pageCopy: {
    heading: string;
    subtitle: string;
    directHeading: string;
    directDescription: string;
    trustHeading: string;
  };
};

const DEFAULT_BOOKING_PROFILES: BookingProfiles = {
  zocdoc: {
    enabled: false,
    bookingUrl: null,
    profileUrl: null,
    ctaLabel: 'Book through Zocdoc',
    description: null,
    ratingEnabled: false,
    rating: null,
    reviewCount: null,
    ratingVerifiedAt: null,
  },
  psychologyToday: {
    enabled: false,
    profileUrl: null,
    contactUrl: null,
    ctaLabel: 'View our Psychology Today profile',
    description: null,
  },
  display: {
    homepage: false,
    bookingPage: true,
    bioPage: false,
    reviewsPage: true,
  },
  pageCopy: {
    heading: 'Book an Appointment',
    subtitle: 'Choose the option that works best for you.',
    directHeading: 'Book Directly with LifeWell',
    directDescription: 'Schedule your appointment directly with LifeWell through our secure booking system.',
    trustHeading: 'Also find LifeWell on trusted platforms',
  },
};

/** Only ever returns an https:// URL — blocks javascript:, malformed, and non-https values. */
function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || !/^https:\/\//i.test(trimmed)) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === 'https:' ? trimmed : null;
  } catch {
    return null;
  }
}

function safeLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeNote(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** 0–5, exclusive of 0 — a real rating is never zero on Zocdoc's own scale. */
function safeRating(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

function safeCount(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= 0 && Number.isInteger(n) ? n : null;
}

/**
 * Reads the owner-managed Zocdoc / Psychology Today integration config from
 * the generic site_sections store (page_key "global", section_key
 * "booking_profiles") — no dedicated table needed. Every value defaults to
 * "off" / null; nothing here is ever fabricated when the owner hasn't
 * entered it.
 */
function mapBookingProfiles(cms: PublicCmsPayload | null): BookingProfiles {
  const content = sectionContent(cms, 'global', 'booking_profiles');
  if (!content) return DEFAULT_BOOKING_PROFILES;

  const zocdoc = asRecord(content.zocdoc) ?? {};
  const pt = asRecord(content.psychology_today) ?? {};
  const display = asRecord(content.display) ?? {};
  const pageCopy = asRecord(content.page_copy) ?? {};
  const ratingEnabled = zocdoc.rating_enabled === true;

  return {
    zocdoc: {
      enabled: zocdoc.enabled === true,
      bookingUrl: safeHttpsUrl(zocdoc.booking_url),
      profileUrl: safeHttpsUrl(zocdoc.profile_url),
      ctaLabel: safeLabel(zocdoc.cta_label, DEFAULT_BOOKING_PROFILES.zocdoc.ctaLabel),
      description: safeNote(zocdoc.description),
      ratingEnabled,
      rating: ratingEnabled ? safeRating(zocdoc.rating) : null,
      reviewCount: ratingEnabled ? safeCount(zocdoc.review_count) : null,
      ratingVerifiedAt: ratingEnabled ? safeNote(zocdoc.rating_verified_at) : null,
    },
    psychologyToday: {
      enabled: pt.enabled === true,
      profileUrl: safeHttpsUrl(pt.profile_url),
      contactUrl: safeHttpsUrl(pt.contact_url),
      ctaLabel: safeLabel(pt.cta_label, DEFAULT_BOOKING_PROFILES.psychologyToday.ctaLabel),
      description: safeNote(pt.description),
    },
    display: {
      homepage: display.homepage === true,
      bookingPage: display.booking_page !== false,
      bioPage: display.bio_page === true,
      reviewsPage: display.reviews_page !== false,
    },
    pageCopy: {
      heading: safeLabel(pageCopy.heading, DEFAULT_BOOKING_PROFILES.pageCopy.heading),
      subtitle: safeLabel(pageCopy.subtitle, DEFAULT_BOOKING_PROFILES.pageCopy.subtitle),
      directHeading: safeLabel(pageCopy.direct_heading, DEFAULT_BOOKING_PROFILES.pageCopy.directHeading),
      directDescription: safeLabel(pageCopy.direct_description, DEFAULT_BOOKING_PROFILES.pageCopy.directDescription),
      trustHeading: safeLabel(pageCopy.trust_heading, DEFAULT_BOOKING_PROFILES.pageCopy.trustHeading),
    },
  };
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string' && value.trim()) {
    try {
      return stringList(JSON.parse(value));
    } catch {
      return value.split(/\n+/).map((item) => item.trim()).filter(Boolean);
    }
  }
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string' && item.trim()) return item.trim();
      if (item && typeof item === 'object' && 'name' in item && typeof (item as { name: unknown }).name === 'string') {
        return (item as { name: string }).name.trim();
      }
      return '';
    })
    .filter(Boolean);
}

function hoursLines(value: unknown): string[] {
  if (Array.isArray(value)) return stringList(value);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).filter(
      (item): item is string => typeof item === 'string' && item.trim().length > 0
    );
  }
  return [];
}

function mapProvider(cms: PublicCmsPayload | null) {
  const rows = (cms?.providers ?? []) as {
    name?: string;
    credentials?: string | null;
    title?: string | null;
    bio?: string | null;
    photo_url?: string | null;
    education?: unknown;
    certifications?: unknown;
    published?: boolean;
  }[];
  const row = rows.find((r) => r.published !== false && r.name);
  if (!row?.name) return null;
  return {
    name: String(row.name),
    credentials: String(row.credentials || ''),
    title: row.title ?? null,
    bio: row.bio ?? null,
    photoUrl: row.photo_url ? siteAssetSrc(String(row.photo_url)) : null,
    education: stringList(row.education),
    certifications: stringList(row.certifications),
  };
}

function mapLocations(cms: PublicCmsPayload | null) {
  const rows = (cms?.locations ?? []) as {
    name?: string;
    phone?: string | null;
    email?: string | null;
    address_line1?: string | null;
    address_line2?: string | null;
    city?: string | null;
    state?: string | null;
    postal_code?: string | null;
    hours?: unknown;
    is_primary?: boolean;
    published?: boolean;
  }[];
  return rows
    .filter((r) => r.published !== false && r.name)
    .map((r) => ({
      name: String(r.name),
      phone: r.phone ?? null,
      email: r.email ?? null,
      street: [r.address_line1, r.address_line2].filter(Boolean).join(', ') || null,
      city: r.city ?? null,
      region: r.state ?? null,
      postalCode: r.postal_code ?? null,
      address: [r.address_line1, r.address_line2, r.city, r.state, r.postal_code].filter(Boolean).join(', ') || null,
      hours: hoursLines(r.hours),
      isPrimary: Boolean(r.is_primary),
    }));
}

type TelehealthStateRow = {
  state_code?: string;
  slug?: string;
  published?: boolean;
  badge?: string | null;
  heading?: string | null;
  subheading?: string | null;
  body?: string | null;
  care_mode?: string | null;
  insurance_mode?: 'existing' | 'self_pay_only' | null;
  self_pay_enabled?: boolean | null;
  self_pay_fee?: number | null;
  self_pay_fee_label?: string | null;
  pricing_note?: string | null;
  hero_image_url?: string | null;
  hero_image_alt?: string | null;
  primary_cta_label?: string | null;
  primary_cta_href?: string | null;
  secondary_cta_label?: string | null;
  secondary_cta_href?: string | null;
  faqs?: unknown;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
};

function trimmedOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/**
 * Merges each state's CMS row over its static fallback, field by field — a
 * row missing (or leaving blank) any individual field falls back to the
 * matching static value rather than the whole state reverting to fully
 * static. A state with no CMS row at all uses its static entry untouched.
 *
 * `code`/`slug`/`inPersonAvailable`-equivalent identity is never taken from
 * the CMS — only content fields are. See the safety note on
 * TelehealthState in data/telehealth-states.ts.
 */
function mapTelehealthStates(cms: PublicCmsPayload | null): TelehealthState[] {
  const rows = (cms?.telehealthStates ?? []) as TelehealthStateRow[];

  return staticTelehealthStates.map((fallback) => {
    const row = rows.find((r) => r.published !== false && r.state_code === fallback.code);
    if (!row) return fallback;

    const bodyText = trimmedOrNull(row.body);
    const faqsRaw = Array.isArray(row.faqs) ? row.faqs : null;
    const faqs = faqsRaw
      ?.filter(
        (f): f is { question: string; answer: string } =>
          Boolean(f) && typeof f === 'object' && typeof (f as { question?: unknown }).question === 'string' && typeof (f as { answer?: unknown }).answer === 'string'
      )
      .map((f) => ({ question: f.question, answer: f.answer }));

    return {
      ...fallback,
      badge: trimmedOrNull(row.badge) || fallback.badge,
      heading: trimmedOrNull(row.heading) || fallback.heading,
      subheading: trimmedOrNull(row.subheading) || fallback.subheading,
      body: bodyText ? bodyText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : fallback.body,
      careMode: trimmedOrNull(row.care_mode) || fallback.careMode,
      insuranceMode: row.insurance_mode ?? fallback.insuranceMode,
      selfPayEnabled: row.self_pay_enabled ?? fallback.selfPayEnabled,
      selfPayFee: typeof row.self_pay_fee === 'number' && row.self_pay_fee > 0 ? row.self_pay_fee : null,
      selfPayFeeLabel: trimmedOrNull(row.self_pay_fee_label) ?? fallback.selfPayFeeLabel,
      pricingNote: trimmedOrNull(row.pricing_note) ?? fallback.pricingNote,
      heroImage: trimmedOrNull(row.hero_image_url)
        ? { src: siteAssetSrc(row.hero_image_url as string), alt: trimmedOrNull(row.hero_image_alt) || fallback.name }
        : fallback.heroImage,
      primaryCta: {
        label: trimmedOrNull(row.primary_cta_label) || fallback.primaryCta.label,
        href: trimmedOrNull(row.primary_cta_href) || fallback.primaryCta.href,
      },
      secondaryCta: {
        label: trimmedOrNull(row.secondary_cta_label) || fallback.secondaryCta.label,
        href: trimmedOrNull(row.secondary_cta_href) || fallback.secondaryCta.href,
      },
      faqs: faqs?.length ? faqs : fallback.faqs,
      metaTitle: trimmedOrNull(row.seo_title) || fallback.metaTitle,
      metaDescription: trimmedOrNull(row.seo_description) || fallback.metaDescription,
      ogImageUrl: trimmedOrNull(row.og_image_url) ?? fallback.ogImageUrl,
    } satisfies TelehealthState;
  });
}

function mapSeo(cms: PublicCmsPayload | null) {
  const rows = (cms?.seo ?? []) as {
    path?: string;
    title?: string | null;
    description?: string | null;
    og_image_url?: string | null;
    noindex?: boolean;
  }[];
  const seoByPath: ResolvedContent['seoByPath'] = {};
  for (const row of rows) {
    const path = typeof row.path === 'string' ? row.path : '';
    if (!path) continue;
    seoByPath[path] = {
      title: row.title ? String(row.title) : null,
      description: row.description ? String(row.description) : null,
      ogImageUrl: row.og_image_url ? siteAssetSrc(String(row.og_image_url)) : null,
      noindex: Boolean(row.noindex),
    };
  }
  return seoByPath;
}

function mapPosts(cms: PublicCmsPayload | null) {
  const rows = (cms?.posts ?? []) as {
    slug?: string;
    title?: string;
    excerpt?: string | null;
    cover_image_url?: string | null;
    author_name?: string | null;
    category?: string | null;
    published_at?: string | null;
    body?: string | null;
  }[];
  return rows
    .filter((r) => r.slug && r.title)
    .map((r) => ({
      slug: String(r.slug),
      title: String(r.title),
      excerpt: r.excerpt ?? null,
      coverImageUrl: r.cover_image_url ? siteAssetSrc(String(r.cover_image_url)) : null,
      authorName: r.author_name ?? null,
      category: r.category ?? null,
      publishedAt: r.published_at ?? null,
      body: r.body ?? null,
    }));
}

function mapServicesIntro(cms: PublicCmsPayload | null) {
  const content = sectionContent(cms, 'home', 'services');
  if (!content) return { ...staticServicesSection, cta: staticServicesSection.cta.label };
  return {
    eyebrow: typeof content.eyebrow === 'string' ? content.eyebrow : staticServicesSection.eyebrow,
    heading: typeof content.heading === 'string' ? content.heading : staticServicesSection.heading,
    body: typeof content.body === 'string' ? content.body : staticServicesSection.body,
    cta: typeof content.cta === 'string' ? content.cta : staticServicesSection.cta.label,
  };
}

function mapBenefits(cms: PublicCmsPayload | null): { heading: string; items: Benefit[] } {
  const content = sectionContent(cms, 'home', 'benefits');
  const heading =
    typeof content?.heading === 'string' ? content.heading : staticBenefitsSection.heading;
  const raw = Array.isArray(content?.items) ? content.items : [];
  const items: Benefit[] = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.title !== 'string' || typeof row.description !== 'string') return null;
      const imageSrc = siteAssetSrc(
        typeof row.image === 'string'
          ? row.image
          : staticBenefits[0]?.image.src || '/images/benefits/Personalized-One-on-One-Care.avif'
      );
      return {
        title: row.title,
        description: row.description,
        image: { src: imageSrc, width: 1180, height: 1180 },
      } satisfies Benefit;
    })
    .filter((item): item is Benefit => Boolean(item));
  return { heading, items: items.length ? items : staticBenefits };
}

function mapHowItWorks(cms: PublicCmsPayload | null) {
  const content = sectionContent(cms, 'home', 'how_it_works');
  const rawSteps = Array.isArray(content?.steps) ? content.steps : [];
  const steps: Step[] = rawSteps
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.title !== 'string' || typeof row.description !== 'string') return null;
      return { title: row.title, description: row.description } satisfies Step;
    })
    .filter((item): item is Step => Boolean(item));
  return {
    eyebrow: typeof content?.eyebrow === 'string' ? content.eyebrow : staticHowItWorks.eyebrow,
    heading: typeof content?.heading === 'string' ? content.heading : staticHowItWorks.heading,
    body: typeof content?.body === 'string' ? content.body : staticHowItWorks.body,
    steps: steps.length ? steps : staticSteps,
  };
}

function mapStats(cms: PublicCmsPayload | null): Stat[] {
  const content = sectionContent(cms, 'home', 'stats');
  if (!content || !Array.isArray(content.items)) return staticStats;
  const raw = content.items;
  const items: Stat[] = raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.label !== 'string' || row.hidden === true) return null;
      return {
        value: Number(row.value) || 0,
        suffix: typeof row.suffix === 'string' ? row.suffix : '',
        label: row.label,
        requiresVerification: Boolean(row.requiresVerification),
      } satisfies Stat;
    })
    .filter((item): item is Stat => Boolean(item));
  return items;
}

function mapFees(cms: PublicCmsPayload | null) {
  const intro = sectionContent(cms, 'fees', 'intro') ?? {};
  const selfPay = sectionContent(cms, 'fees', 'self_pay') ?? {};
  const insurance = sectionContent(cms, 'fees', 'insurance') ?? {};
  const introBody =
    typeof intro.body === 'string' && intro.body.trim()
      ? intro.body
      : Array.isArray(intro.body)
          ? intro.body
              .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
              .join('\n\n') || staticFeesIntro.body
          : staticFeesIntro.body;
  const selfPayBody = Array.isArray(selfPay.body)
    ? selfPay.body.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    : typeof selfPay.body === 'string' && selfPay.body.trim()
      ? selfPay.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : staticSelfPay.body;
  const psychiatricStatePricing = Array.isArray(selfPay.psychiatricStatePricing)
    ? selfPay.psychiatricStatePricing
      .map((item) => {
        if (!item || typeof item !== 'object') return null;
        const row = item as Record<string, unknown>;
        if (
          typeof row.state !== 'string' ||
          typeof row.initialFee !== 'number' ||
          typeof row.followUpFee !== 'number'
        ) {
          return null;
        }
        const staticState = staticPsychiatricStatePricing.find((item) => item.state === row.state);
        return {
          state: row.state,
          selfPayOnly: row.selfPayOnly === true,
          slidingScaleAvailable:
            typeof row.slidingScaleAvailable === 'boolean'
              ? row.slidingScaleAvailable
              : staticState?.slidingScaleAvailable ?? false,
          initialFee: row.initialFee,
          followUpFee: row.followUpFee,
        };
      })
      .filter((item): item is typeof staticPsychiatricStatePricing[number] => Boolean(item))
    : staticPsychiatricStatePricing;
  return {
    introHeading: typeof intro.heading === 'string' && intro.heading.trim() ? intro.heading : staticFeesIntro.heading,
    introBody,
    selfPayHeading:
      typeof selfPay.heading === 'string' && selfPay.heading.trim() ? selfPay.heading : staticSelfPay.heading,
    selfPayBody: selfPayBody.length ? selfPayBody : staticSelfPay.body,
    insuranceDisclaimer:
      typeof insurance.disclaimer === 'string' && insurance.disclaimer.trim()
        ? insurance.disclaimer
        : 'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.',
    psychiatricStatePricing:
      psychiatricStatePricing.length === staticPsychiatricStatePricing.length
        ? psychiatricStatePricing
        : staticPsychiatricStatePricing,
  };
}
export const getResolvedContent = cache(async (): Promise<ResolvedContent> => {
  const cms = await fetchPublicCms();
  const live = cmsLive(cms);
  const benefits = mapBenefits(cms);
  const howItWorks = mapHowItWorks(cms);

  return {
    source: live ? 'cms' : 'static',
    hero: mapHero(cms),
    welcome: mapWelcome(cms),
    faqs: mapFaqs(cms, live),
    feesFaqs: mapFeesFaqs(cms, live),
    testimonials: mapTestimonials(cms, live),
    insurance: mapInsurance(cms, live),
    insuranceSection: mapInsuranceSection(cms),
    homeServices: mapHomeServices(cms, live),
    serviceSummaries: mapServiceSummaries(cms, live),
    servicesIntro: mapServicesIntro(cms),
    benefitsHeading: benefits.heading,
    benefits: benefits.items,
    howItWorks: {
      eyebrow: howItWorks.eyebrow,
      heading: howItWorks.heading,
      body: howItWorks.body,
    },
    steps: howItWorks.steps,
    stats: mapStats(cms),
    booking: mapBooking(cms),
    announcements: mapAnnouncements(cms),
    videos: mapVideos(cms),
    settings: mapSettings(cms),
    provider: mapProvider(cms),
    locations: mapLocations(cms),
    telehealthStates: mapTelehealthStates(cms),
    bookingProfiles: mapBookingProfiles(cms),
    posts: mapPosts(cms),
    fees: mapFees(cms),
    serviceDetails: mapServiceDetails(cms),
    seoByPath: mapSeo(cms),
  };
});
