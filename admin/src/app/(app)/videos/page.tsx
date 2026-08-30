'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { VideoPreview } from '@/components/SitePreviews';

export default function Page() {
  return (
    <ResourceManager
      title="Videos"
      subtitle="Published videos appear on /videos and the homepage Watch and Learn section. Preview the embed, then Save to show it to visitors."
      endpoint="/api/admin/videos"
      createDefaults={{ published: true, provider: 'youtube', sort_order: 0 }}
      itemLabel={(r) => String(r.title || 'Video')}
      preview={{
        hint: 'This is the public video card. Unpublished items stay hidden until you publish and save.',
        liveHref: () => '/videos',
        render: (form) => (
          <VideoPreview
            title={String(form.title || '')}
            url={String(form.url || '')}
            provider={String(form.provider || 'youtube')}
            description={form.description ? String(form.description) : null}
            hasLegacyEmbedHtml={Boolean(form.embed_html && String(form.embed_html).trim())}
            published={Boolean(form.published)}
          />
        ),
      }}
      columns={[
        { key: 'title', label: 'Title' },
        { key: 'provider', label: 'Source' },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live on homepage</span> : 'Draft'),
        },
      ]}
      fields={[
        { key: 'title', label: 'Title' },
        {
          key: 'provider',
          label: 'Source',
          type: 'select',
          options: [
            { value: 'youtube', label: 'YouTube' },
            { value: 'vimeo', label: 'Vimeo' },
            { value: 'file', label: 'File URL' },
            { value: 'embed', label: 'Embed' },
          ],
        },
        { key: 'url', label: 'URL (YouTube, Vimeo, or a direct video file link)', full: true },
        { key: 'thumbnail_url', label: 'Thumbnail URL', full: true },
        { key: 'description', label: 'Description', type: 'textarea', full: true },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'published', label: 'Published on homepage', type: 'checkbox' },
      ]}
    />
  );
}
