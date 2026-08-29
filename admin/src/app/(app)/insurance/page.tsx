'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { InsurancePreview } from '@/components/SitePreviews';
import { FeesCopy } from '@/components/FeesCopy';
import { HomepageInsuranceCopy } from '@/components/HomepageInsuranceCopy';
import { publicAssetUrl } from '@/lib/site';

export default function Page() {
  return (
    <div>
      <HomepageInsuranceCopy />
      <FeesCopy />
      <ResourceManager
      title="Insurance"
      subtitle="Plans and logos on /fees-insurance. Preview the logo card, then Save to update the public page."
      endpoint="/api/admin/insurance"
      createDefaults={{ published: true, self_pay: false, sort_order: 0 }}
      itemLabel={(r) => String(r.name || 'Plan')}
      preview={{
        hint: 'This logo appears in the Fees & Insurance grid after Save.',
        liveHref: () => '/fees-insurance',
        render: (form) => (
          <InsurancePreview name={String(form.name || '')} logoUrl={form.logo_url ? String(form.logo_url) : null} />
        ),
      }}
      columns={[
        {
          key: 'logo_url',
          label: 'Logo',
          render: (r) =>
            r.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicAssetUrl(String(r.logo_url))} alt="" className="table-thumb" />
            ) : (
              '—'
            ),
        },
        { key: 'name', label: 'Plan' },
        {
          key: 'self_pay',
          label: 'Self-pay',
          render: (r) => (r.self_pay ? 'Yes' : 'No'),
        },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : 'Draft'),
        },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'logo_url', label: 'Logo URL (from Media)' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'self_pay', label: 'Self-pay option', type: 'checkbox' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
    </div>
  );
}
