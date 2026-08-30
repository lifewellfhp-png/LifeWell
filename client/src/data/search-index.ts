import { serviceSummaries, serviceCategories } from './service-catalog';
import { generatedLegalPages } from './generated/legal';
import { publishedPosts } from './blog';
import { faqs, benefits } from './marketing';
import { provider } from './provider';
import { pricingTiers } from './pricing';

export interface SearchEntry {
  title: string;
  href: string;
  section: string;
  /** Short line shown under the title in results. */
  summary: string;
  /** Lower-cased haystack, not rendered. */
  keywords: string;
}

const clip = (text: string, max = 150) =>
  text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;

/**
 * Search index.
 *
 * Derived from the same typed content the pages render, so it can never drift
 * out of date, and built at module scope so it ships as part of the static
 * bundle — no search API, no runtime index build.
 */
function build(): SearchEntry[] {
  const entries: SearchEntry[] = [];

  /* Core pages */
  entries.push(
    {
      title: 'Home',
      href: '/',
      section: 'Pages',
      summary: 'Compassionate telehealth mental health care from a board-certified PMHNP.',
      keywords: 'home telehealth psychiatry mental health care pmhnp',
    },
    {
      title: `Meet Your Provider — ${provider.name}`,
      href: '/bio',
      section: 'Pages',
      summary: clip(provider.tagline),
      keywords: `${provider.name} ${provider.credentials} ${provider.role} bio about ${provider.expertise.join(' ')}`,
    },
    {
      title: 'Our Services',
      href: '/our-services',
      section: 'Pages',
      summary: 'All psychiatric and primary care services offered by telehealth.',
      keywords: `services ${serviceSummaries.map((s) => s.title).join(' ')}`,
    },
    {
      title: 'Fees & Insurance',
      href: '/fees-insurance',
      section: 'Pages',
      summary: 'Self-pay rates, weight management programs, and accepted insurance plans.',
      keywords: `fees insurance cost price payment self-pay superbill ${pricingTiers
        .map((t) => `${t.name} ${t.initialFee} ${t.followUpFee}`)
        .join(' ')}`,
    },
    {
      title: 'New Patients',
      href: '/new-patients',
      section: 'Pages',
      summary: 'What to expect at your first visit and how to prepare.',
      keywords: 'new patients first visit first appointment what to expect prepare for appointment intake',
    },
    {
      title: 'Book an Appointment',
      href: '/book-telehealth-mental-health-appointment',
      section: 'Pages',
      summary: 'Schedule a confidential telehealth appointment in three steps.',
      keywords: 'book booking appointment schedule consultation new patient',
    },
    {
      title: 'Contact Us',
      href: '/contact-telehealth-mental-health-provider',
      section: 'Pages',
      summary: 'Phone, text, email and secure enquiry form.',
      keywords: 'contact phone email address hours enquiry question call text',
    },
    {
      title: 'FAQs',
      href: '/faqs',
      section: 'Pages',
      summary: 'Common questions about telehealth appointments, insurance and privacy.',
      keywords: `faq questions ${faqs.map((f) => f.question).join(' ')}`,
    },
    {
      title: 'Patient Testimonials',
      href: '/telehealth-mental-health-testimonials',
      section: 'Pages',
      summary: 'Experiences from patients who received telehealth mental health support.',
      keywords: 'testimonials reviews patient experiences feedback',
    },
    {
      title: 'Blog',
      href: '/blog',
      section: 'Pages',
      summary: 'Mental health and wellness writing.',
      keywords: 'blog articles news insights',
    },
    {
      title: 'Videos',
      href: '/videos',
      section: 'Pages',
      summary: 'Educational mental health videos from LifeWell.',
      keywords: 'videos watch learn education mental health',
    }
  );

  /* Services — indexed on title and card description, not full page bodies */
  for (const summary of serviceSummaries) {
    entries.push({
      title: summary.title,
      href: summary.href,
      section: serviceCategories[summary.category].shortLabel,
      summary: clip(summary.description),
      keywords: `${summary.title} ${summary.description}`,
    });
  }

  /* FAQs — each question is individually findable */
  for (const faq of faqs) {
    entries.push({
      title: faq.question,
      href: '/faqs',
      section: 'FAQ',
      summary: clip(faq.answer),
      keywords: `${faq.question} ${faq.answer}`,
    });
  }

  /* Reasons to choose the clinic */
  for (const benefit of benefits) {
    entries.push({
      title: benefit.title,
      href: '/#benefits-heading',
      section: 'Why LifeWell',
      summary: clip(benefit.description),
      keywords: `${benefit.title} ${benefit.description}`,
    });
  }

  /* Legal */
  for (const page of generatedLegalPages) {
    entries.push({
      title: page.title,
      href: `/${page.slug}`,
      section: 'Policies',
      summary: clip(page.intro[0] ?? ''),
      keywords: `${page.title} ${page.intro.join(' ')} ${page.sections
        .map((s) => s.heading)
        .join(' ')}`,
    });
  }

  /* Published posts only — placeholder-bodied ones stay out */
  for (const post of publishedPosts) {
    entries.push({
      title: post.title,
      href: `/${post.slug}`,
      section: 'Blog',
      summary: clip(post.excerpt),
      keywords: `${post.title} ${post.excerpt} ${post.tags.join(' ')}`,
    });
  }

  return entries.map((e) => ({ ...e, keywords: e.keywords.toLowerCase() }));
}

export const searchIndex: SearchEntry[] = build();

/** Counts non-overlapping occurrences of `term` in `haystack`. */
function occurrences(haystack: string, term: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(term, from);
    if (at === -1) return count;
    count++;
    from = at + term.length;
  }
}

/**
 * Ranked search.
 *
 * Title matches dominate; body relevance is scored by term frequency rather
 * than mere presence, so the page that actually covers a topic outranks pages
 * that only mention it once. Every term must appear somewhere (AND semantics).
 */
export function searchEntries(query: string, limit = 8): SearchEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const terms = q.split(/\s+/).filter(Boolean);

  return searchIndex
    .map((entry) => {
      const title = entry.title.toLowerCase();
      let score = 0;

      for (const term of terms) {
        const inTitle = title.includes(term);
        const hits = occurrences(entry.keywords, term);

        // Every term must match somewhere, or the entry is not a result.
        if (!inTitle && hits === 0) return { entry, score: -1 };

        if (title.startsWith(term)) score += 14;
        else if (inTitle) score += 9;

        // Frequency, with diminishing returns so long pages can't dominate.
        score += Math.min(hits, 6) * 1.5;
      }

      // Exact phrase in the title is the strongest single signal.
      if (title.includes(q)) score += 10;

      // Services are the pages people are usually looking for.
      if (entry.section !== 'Pages') score += 1;

      return { entry, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.entry);
}
