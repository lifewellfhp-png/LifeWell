'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { ServicePreview } from '@/components/SitePreviews';
import { publicAssetUrl } from '@/lib/site';

export default function Page() {
  return (
    <ResourceManager
      title="Services"
      subtitle="Text, images, and category match the public /our-services grid and /services/[slug] pages. Preview first; Save publishes to visitors."
      endpoint="/api/admin/services"
      createDefaults={{ published: true, sort_order: 0, category: '' }}
      itemLabel={(r) => String(r.title || 'Service')}
      preview={{
        hint: 'Card + service page layout. Image, title, summary, and body update here as you type. Save to push to the live site.',
        liveHref: (row) => (row.slug ? `/services/${String(row.slug)}` : '/our-services'),
        render: (form) => (
          <ServicePreview
            title={String(form.title || '')}
            summary={form.summary ? String(form.summary) : null}
            body={form.body ? String(form.body) : null}
            imageUrl={form.image_url ? String(form.image_url) : form.icon ? String(form.icon) : null}
            category={form.category ? String(form.category) : null}
            slug={form.slug ? String(form.slug) : ''}
          />
        ),
      }}
      columns={[
        {
          key: 'image_url',
          label: 'Image',
          render: (r) =>
            r.image_url || r.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={publicAssetUrl(String(r.image_url || r.icon))}
                alt=""
                className="table-thumb"
              />
            ) : (
              '—'
            ),
        },
        { key: 'title', label: 'Title' },
        { key: 'slug', label: 'Slug' },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : <span className="badge">Draft</span>),
        },
      ]}
      fields={[
        { key: 'title', label: 'Title' },
        { key: 'slug', label: 'URL slug' },
        {
          key: 'category',
          label: 'Category (required — controls Massachusetts/Arizona telehealth eligibility)',
          type: 'select',
          options: [
            { value: '', label: 'Select a category…' },
            { value: 'psychiatric', label: 'Psychiatric & Mental Health' },
            { value: 'primary-care', label: 'Family Health (Primary Care)' },
            { value: 'professional-education', label: 'Professional Education / Clinical Education' },
          ],
        },
        { key: 'image_url', label: 'Image URL (from Media or /images/services/…)', full: true },
        { key: 'summary', label: 'Card summary / page lead', type: 'textarea', full: true },
        { key: 'body', label: 'Full page content', type: 'textarea', full: true },
        { key: 'seo_title', label: 'SEO title' },
        { key: 'seo_description', label: 'SEO description', type: 'textarea' },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
  );
}
