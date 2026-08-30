'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { SeoPreview } from '@/components/SitePreviews';
import { classifyRoute } from '@/lib/routeStatus';

function RouteStatusBadge({ path }: { path: unknown }) {
  const status = classifyRoute(typeof path === 'string' ? path : String(path ?? ''));
  const className =
    status.kind === 'active' ? 'badge ok' : status.kind === 'unmatched' ? 'badge danger' : 'badge warn';
  return <span className={className}>{status.label}</span>;
}

export default function Page() {
  return (
    <ResourceManager
      title="SEO"
      subtitle="Google title, description, and social image by public path. Preview the search snippet, then Save to publish."
      endpoint="/api/admin/seo"
      createDefaults={{ noindex: false, path: '/' }}
      itemLabel={(r) => String(r.path || r.title || 'SEO row')}
      preview={{
        hint: 'Search and social preview only. Visitors and Google pick this up after Save.',
        liveHref: (row) => String(row.path || '/'),
        render: (form) => {
          const status = classifyRoute(typeof form.path === 'string' ? form.path : String(form.path ?? ''));
          return (
            <>
              {status.kind === 'unmatched' ? (
                <p className="preview-place warn">
                  No matching public route for this path — this SEO entry will not be shown to visitors or
                  Google until the path matches a real page exactly.
                </p>
              ) : status.kind === 'redirect' ? (
                <p className="preview-place warn">
                  This path redirects to {status.destination} before any page loads, so this SEO entry will
                  never be shown. Use {status.destination} as the path instead.
                </p>
              ) : status.kind === 'dynamic' ? (
                <p className="preview-place">
                  This looks like a dynamic route pattern ({status.label}) — the specific page isn&apos;t
                  verified here, only the pattern.
                </p>
              ) : null}
              <SeoPreview
                path={String(form.path || '/')}
                title={String(form.title || '')}
                description={String(form.description || '')}
                ogImage={form.og_image_url ? String(form.og_image_url) : null}
                noindex={Boolean(form.noindex)}
              />
            </>
          );
        },
      }}
      columns={[
        { key: 'path', label: 'Path' },
        { key: 'title', label: 'Title' },
        { key: 'route_status', label: 'Route status', render: (r) => <RouteStatusBadge path={r.path} /> },
        {
          key: 'noindex',
          label: 'Index',
          render: (r) => (r.noindex ? <span className="badge warn">Noindex</span> : <span className="badge ok">Index</span>),
        },
      ]}
      fields={[
        { key: 'path', label: 'Path (e.g. /faqs)' },
        { key: 'title', label: 'Title', full: true },
        { key: 'description', label: 'Meta description', type: 'textarea', full: true },
        { key: 'og_image_url', label: 'Social image URL', full: true },
        { key: 'noindex', label: 'Hide from search', type: 'checkbox' },
      ]}
    />
  );
}
