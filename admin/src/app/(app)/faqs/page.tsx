'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { FaqPreview } from '@/components/SitePreviews';

const CATEGORY_HINTS: Record<string, string> = {
  General: 'Appears on the general FAQ page (/faqs).',
  Fees: 'Appears in the Fees & Insurance FAQ section (/fees-insurance) — moving a FAQ out of Fees removes it from that page.',
  Appointments: 'Appears on the general FAQ page (/faqs), grouped alongside General FAQs — there is no separate Appointments page.',
};

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  General: 'badge',
  Fees: 'badge ok',
  Appointments: 'badge warn',
};

export default function Page() {
  return (
    <ResourceManager
      title="FAQs"
      subtitle="Questions on /faqs (General, Appointments) and /fees-insurance (Fees). Preview before save; visitors update only after Save."
      endpoint="/api/admin/faqs"
      createDefaults={{ published: true, sort_order: 0, category: 'General' }}
      itemLabel={(r) => String(r.question || 'FAQ')}
      preview={{
        hint: 'Matches the public FAQ accordion. Category Fees goes to the Fees & Insurance page.',
        liveHref: (row) => (String(row.category || '') === 'Fees' ? '/fees-insurance' : '/faqs'),
        render: (form) => (
          <FaqPreview
            question={String(form.question || '')}
            answer={String(form.answer || '')}
            category={String(form.category || 'General')}
          />
        ),
      }}
      filters={[
        {
          key: 'category',
          label: 'Category',
          allLabel: 'All categories',
          options: [
            { value: 'General', label: 'General' },
            { value: 'Fees', label: 'Fees' },
            { value: 'Appointments', label: 'Appointments' },
          ],
        },
      ]}
      confirmFieldChange={{
        key: 'category',
        message: (from, to) =>
          `Move this FAQ from "${from || 'General'}" to "${to}"? ${
            CATEGORY_HINTS[to] || ''
          }`.trim(),
      }}
      columns={[
        { key: 'question', label: 'Question' },
        {
          key: 'category',
          label: 'Category',
          render: (r) => {
            const cat = String(r.category || 'General');
            return <span className={CATEGORY_BADGE_CLASS[cat] || 'badge'}>{cat}</span>;
          },
        },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : 'Draft'),
        },
      ]}
      fields={[
        { key: 'question', label: 'Question', full: true },
        { key: 'answer', label: 'Answer', type: 'textarea', full: true },
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          options: [
            { value: 'General', label: 'General → /faqs' },
            { value: 'Fees', label: 'Fees → /fees-insurance' },
            { value: 'Appointments', label: 'Appointments → /faqs' },
          ],
          hint: (value) => CATEGORY_HINTS[String(value || 'General')] || null,
        },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
  );
}
