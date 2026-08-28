/** Content model for the LifeWell site. */

/* ------------------------------------------------------------- blocks --- */

export type TextBlock = { type: 'text'; text: string };
export type ListBlock = { type: 'list'; items: string[] };
export type HeadingBlock = { type: 'heading'; text: string };

export type ContentBlock = TextBlock | ListBlock;
export type ArticleBlock = TextBlock | ListBlock | HeadingBlock;

export interface ContentSection {
  heading: string;
  blocks: ContentBlock[];
  /**
   * Heading level this section carried in the WordPress source. Retained for
   * provenance only — the rebuilt pages derive their own correct hierarchy,
   * because the source nested H2s beneath H3s and styled H6 as an eyebrow.
   */
  sourceLevel?: number;
}

/* ----------------------------------------------------------- services --- */

export type ServiceCategory = 'psychiatric' | 'primary-care';

export interface Service {
  slug: string;
  title: string;
  category: ServiceCategory;
  /** The page's own lead statement, shown under the H1. */
  lead: string;
  intro: string[];
  sections: ContentSection[];
  cta: { heading: string; body: string[] } | null;
  wpId: number;
  modified: string | null;
}

/** Card-level summary used in grids and navigation. */
export interface ServiceSummary {
  slug: string;
  title: string;
  category: ServiceCategory;
  description: string;
  href: string;
  image: {
    src: string;
    alt: string;
    width: number;
    height: number;
  };
}

/* --------------------------------------------------------------- blog --- */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: string[];
  publishedAt: string | null;
  modifiedAt: string | null;
  image: string | null;
  /**
   * True when the source body is WordPress theme filler rather than real
   * clinical writing. Flagged posts are withheld from the public site.
   */
  needsClientContent: boolean;
  demoSignals: string[];
  blocks: ArticleBlock[];
  wpId: number;
  /** Service slug to link at the end of the article, if relevant. */
  relatedServiceSlug?: string;
}

/* -------------------------------------------------------------- legal --- */

export interface LegalPage {
  slug: string;
  title: string;
  heading: string;
  intro: string[];
  sections: ContentSection[];
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string | null;
  wpId: number;
}

/* ------------------------------------------------------------- people --- */

export interface Provider {
  name: string;
  credentials: string;
  role: string;
  tagline: string;
  bio: string[];
  philosophy: string;
  education: string[];
  certifications: string[];
  expertise: string[];
  approach: string[];
  approachIntro: string;
  approachOutcome: string;
  image: { src: string; width: number; height: number; alt: string };
}

/* -------------------------------------------------------- marketing ---- */

export interface Benefit {
  title: string;
  description: string;
  image: { src: string; width: number; height: number };
}

export interface Step {
  title: string;
  description: string;
}

export interface Testimonial {
  quote: string;
  /** Null when the source provides no verified attribution. */
  author: string | null;
  rating: number | null;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface Stat {
  value: number;
  suffix: string;
  label: string;
  /** Marketing claims the client should verify before launch. */
  requiresVerification: boolean;
}

export interface InsuranceCarrier {
  name: string;
  logo: string;
  width: number;
  height: number;
}

export interface PricingTier {
  name: string;
  initialFee: number;
  initialDuration: string;
  followUpFee: number;
  followUpDuration: string;
  includes: string[];
  freeConsult: boolean;
}

export interface PricingPackage {
  name: string;
  priceRange: string;
  description: string;
  includes: string[];
}

/* --------------------------------------------------------- navigation --- */

export interface NavLink {
  label: string;
  href: string;
  /** Present on links that leave the site. */
  external?: boolean;
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

export interface NavItem extends NavLink {
  groups?: NavGroup[];
}

/* -------------------------------------------------------------- forms --- */

export interface ContactFormValues {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  consent: boolean;
}

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface ApiSuccess {
  success: true;
  message: string;
  referenceId?: string;
}

export interface ApiFailure {
  success: false;
  message: string;
  errors?: Record<string, string>;
}

export type ApiResponse = ApiSuccess | ApiFailure;
