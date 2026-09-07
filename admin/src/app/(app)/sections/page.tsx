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
            // Phase 13: the only row this generic JSON editor needs a
            // targeted warning for — page_key:'fees'/section_key:'self_pay'
            // is the one CMS row that still carries a psychiatricStatePricing
            // value from before Phase 12A locked pricing to protected site
            // configuration. Editing it here no longer changes what
            // visitors see.
            hint: (_value, form) =>
              form.page_key === 'fees' && form.section_key === 'self_pay'
                ? 'Any psychiatricStatePricing values in this JSON no longer control public pricing — those figures are protected in site configuration. Edit ordinary Fees copy from Admin → Insurance instead.'
                : null,
          },
          { key: 'published', label: 'Published', type: 'checkbox' },
        ]}
      />
    </div>
  );
}
