'use client';

import { ResourceManager } from '@/components/ResourceManager';

/** Kept in sync with client/src/data/telehealth-states.ts style taxonomy notes — see P2B plan. */
const CATEGORIES = [
  'Anxiety',
  'Depression',
  'ADHD',
  'Psychiatric Care & Evaluations',
  'Medication & Treatment',
  'Sleep & Wellness',
  'Trauma & Stress',
  'Whole-Person Wellness',
];

/** Kept in sync with client/src/data/service-catalog.ts. */
const SERVICES = [
  { slug: 'psychiatric-evaluations', title: 'Psychiatric Evaluations' },
  { slug: 'medication-management', title: 'Medication Management' },
  {
    slug: 'treatment-for-depression-anxiety-adhd-bipolar-disorder-ptsd',
    title: 'Treatment for Depression, Anxiety, ADHD, Bipolar Disorder & PTSD',
  },
  { slug: 'psychiatric-follow-up-visits-telehealth', title: 'Follow-Up Visits for Ongoing Mental Health Care' },
  { slug: 'annual-physical-exam-telehealth', title: 'Annual Physicals & Preventive Screenings' },
  { slug: 'chronic-disease-management-telehealth', title: 'Chronic Disease Management' },
  { slug: 'preventive-care-telehealth', title: 'Preventive Care' },
  { slug: 'telehealth-sick-visits-primary-care', title: 'Sick Visits (Acute Primary Care)' },
  { slug: 'weight-management-telehealth', title: 'Weight Management' },
  { slug: 'wellness-and-lifestyle-counseling-telehealth', title: 'Wellness and Lifestyle Counseling' },
  { slug: 'lab-testing-coordination-telehealth', title: 'Lab Testing Coordination' },
];

export default function Page() {
  return (
    <ResourceManager
      title="Blog"
      subtitle="Published articles appear on /blog (the Wellness Resource Hub) after Save. Leave Published unchecked to keep a draft."
      endpoint="/api/admin/blog"
      createDefaults={{ published: true }}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'category', label: 'Category' },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : 'Draft'),
        },
      ]}
      fields={[
        { key: 'title', label: 'Title', full: true },
        { key: 'slug', label: 'URL slug' },
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          options: [{ value: '', label: '— None —' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))],
        },
        { key: 'author_name', label: 'Author' },
        { key: 'cover_image_url', label: 'Cover image URL', type: 'url', full: true },
        { key: 'excerpt', label: 'Excerpt', type: 'textarea', full: true },
        { key: 'body', label: 'Article body', type: 'textarea', full: true },
        {
          key: 'related_service_slug',
          label: 'Related service (linked at the end of the article)',
          type: 'select',
          options: [{ value: '', label: '— None —' }, ...SERVICES.map((s) => ({ value: s.slug, label: s.title }))],
        },
        { key: 'seo_title', label: 'SEO title' },
        { key: 'seo_description', label: 'SEO description', type: 'textarea' },
        { key: 'og_image_url', label: 'Social image URL', type: 'url', full: true },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
  );
}
