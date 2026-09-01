'use client';

import { ResourceManager } from '@/components/ResourceManager';

export default function Page() {
  return (
    <ResourceManager
      title="Reviews"
      subtitle="Published reviews appear on the homepage and /telehealth-mental-health-testimonials after Save."
      endpoint="/api/admin/testimonials"
      createDefaults={{ published: false, consent_confirmed: false, sort_order: 0 }}
      columns={[
        { key: 'author_name', label: 'Author' },
        { key: 'quote', label: 'Quote', render: (r) => String(r.quote || '').slice(0, 80) },
        {
          key: 'consent_confirmed',
          label: 'Consent',
          render: (r) => (r.consent_confirmed ? <span className="badge ok">Yes</span> : <span className="badge warn">No</span>),
        },
      ]}
      fields={[
        { key: 'author_name', label: 'Author name' },
        { key: 'author_role', label: 'Author label' },
        { key: 'quote', label: 'Quote', type: 'textarea', full: true },
        { key: 'rating', label: 'Rating (1-5)', type: 'number' },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'consent_confirmed', label: 'Written consent confirmed', type: 'checkbox' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
  );
}
