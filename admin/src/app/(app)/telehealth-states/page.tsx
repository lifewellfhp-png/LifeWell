'use client';

import { ResourceManager } from '@/components/ResourceManager';

export default function Page() {
  return (
    <ResourceManager
      title="Telehealth States"
      subtitle="Content, image, pricing, FAQs, and SEO for /telehealth/florida, /telehealth/massachusetts, and /telehealth/arizona. These three states are pre-configured — edit them rather than adding new ones unless a new state is actually authorized."
      endpoint="/api/admin/telehealth-states"
      createDefaults={{ published: true, insurance_mode: 'self_pay_only', self_pay_enabled: true, faqs: [] }}
      itemLabel={(r) => String(r.state_name || 'State page')}
      columns={[
        { key: 'state_name', label: 'State' },
        { key: 'insurance_mode', label: 'Insurance mode' },
        {
          key: 'self_pay_fee',
          label: 'Self-pay fee',
          render: (r) => (r.self_pay_fee ? `$${r.self_pay_fee}` : '— not set —'),
        },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : <span className="badge">Draft</span>),
        },
      ]}
      fields={[
        { key: 'state_name', label: 'State name (e.g. Massachusetts)' },
        { key: 'state_code', label: 'State code (e.g. MA)' },
        { key: 'slug', label: 'URL slug (e.g. massachusetts)' },
        { key: 'badge', label: 'Badge / eyebrow text' },
        { key: 'heading', label: 'Heading', full: true },
        { key: 'subheading', label: 'Subheading (shown under the heading)', type: 'textarea', full: true },
        { key: 'body', label: 'Body text (blank line between paragraphs)', type: 'textarea', full: true },
        { key: 'care_mode', label: 'Care mode description (e.g. "Telehealth only")' },
        {
          key: 'insurance_mode',
          label: 'Insurance mode',
          type: 'select',
          options: [
            { value: 'existing', label: 'Existing insurance & self-pay structure (Florida)' },
            { value: 'self_pay_only', label: 'Self-pay only — no insurance shown' },
          ],
        },
        { key: 'self_pay_enabled', label: 'Show self-pay pricing block', type: 'checkbox' },
        {
          key: 'self_pay_fee',
          label: 'Self-pay fee in dollars (leave blank until a real price is confirmed — do not guess)',
          type: 'number',
        },
        { key: 'self_pay_fee_label', label: 'Fee label (e.g. "per initial evaluation")' },
        {
          key: 'pricing_note',
          label: 'Pricing note shown when the fee is blank',
          full: true,
        },
        { key: 'hero_image_url', label: 'Hero image URL (upload via Media, then paste the URL here)', type: 'url', full: true },
        { key: 'hero_image_alt', label: 'Hero image alt text', full: true },
        { key: 'primary_cta_label', label: 'Primary button label' },
        { key: 'primary_cta_href', label: 'Primary button link' },
        { key: 'secondary_cta_label', label: 'Secondary link label' },
        { key: 'secondary_cta_href', label: 'Secondary link URL' },
        {
          key: 'faqs',
          label: 'FAQs (JSON list of {"question": "...", "answer": "..."})',
          type: 'json',
          full: true,
        },
        { key: 'seo_title', label: 'SEO title' },
        { key: 'seo_description', label: 'SEO description', type: 'textarea' },
        { key: 'og_image_url', label: 'Social image URL (optional — falls back to the hero image)', type: 'url', full: true },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
  );
}
