'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { HomepageCopy } from '@/components/HomepageCopy';

export default function Page() {
  return (
    <div>
      <HomepageCopy />
      <ResourceManager
        title="Homepage sections"
        subtitle="Every homepage block from the live site. Edit JSON, unpublish, or delete a section."
        endpoint="/api/admin/sections"
        createDefaults={{ page_key: 'home', section_key: 'hero', published: true, content: '{}' }}
        columns={[
          { key: 'page_key', label: 'Page' },
          { key: 'section_key', label: 'Section' },
          { key: 'title', label: 'Title' },
        ]}
        fields={[
          { key: 'page_key', label: 'Page key (e.g. home)' },
          { key: 'section_key', label: 'Section key (e.g. hero)' },
          { key: 'title', label: 'Title' },
          {
            key: 'content',
            label: 'Content JSON',
            type: 'json',
            full: true,
            // Phase 15 (Restore Governed CMS Pricing Authority with
            // Protected Fallback): the only row this generic JSON editor
            // needs a targeted warning for — page_key:'fees'/
            // section_key:'self_pay' is the CMS row that carries
            // psychiatricStatePricing. A complete, fully valid value here
            // does control public pricing; anything incomplete or invalid
            // (missing a state, wrong governance flags, bad numbers, etc.)
            // makes the site fall back to protected code-level pricing
            // instead. The structured pricing editor on Admin → Insurance
            // validates every field before it can be saved — this raw
            // editor does not, so a mistake here is easy to make silently.
            hint: (_value, form) =>
              form.page_key === 'fees' && form.section_key === 'self_pay'
                ? 'A complete, valid psychiatricStatePricing value here controls public pricing; anything incomplete or invalid makes the site fall back to protected pricing instead. Use the structured pricing editor on Admin → Insurance — it validates every field before saving.'
                : null,
          },
          { key: 'published', label: 'Published', type: 'checkbox' },
        ]}
      />
    </div>
  );
}
