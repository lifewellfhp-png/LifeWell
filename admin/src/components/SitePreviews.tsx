'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { findMediaPlacements, VIDEO_PLACEMENT, type Placement } from '@/lib/placements';
import { publicAssetUrl } from '@/lib/site';

const HEADING_FONT: Record<string, string> = {
  Lora: 'var(--font-lora), Georgia, serif',
  Georgia: 'Georgia, "Times New Roman", serif',
  'Playfair Display': '"Playfair Display", Georgia, serif',
};

const BODY_FONT: Record<string, string> = {
  'Source Sans 3': 'var(--font-source-sans), system-ui, sans-serif',
  Inter: 'Inter, system-ui, sans-serif',
  'system-ui': 'system-ui, sans-serif',
};

export function AppearancePreview({
  primary,
  accent,
  headingFont,
  bodyFont,
  ctaLabel,
  logoUrl,
  phone,
}: {
  primary: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  ctaLabel: string;
  logoUrl?: string | null;
  phone?: string | null;
}) {
  const heading = HEADING_FONT[headingFont] || HEADING_FONT.Lora;
  const body = BODY_FONT[bodyFont] || BODY_FONT['Source Sans 3'];
  const logo = publicAssetUrl(logoUrl || '/images/brand/logo-v2.avif');

  return (
    <div
      className="site-mock"
      style={
        {
          '--mock-primary': primary || '#3E7FB1',
          '--mock-accent': accent || '#5FAF6B',
          '--mock-heading': heading,
          '--mock-body': body,
        } as CSSProperties
      }
    >
      <header className="site-mock-header">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logo} alt="Logo" />
        <nav>
          <span>Home</span>
          <span>Services</span>
          <span>Contact Us</span>
        </nav>
        <span className="site-mock-cta">{ctaLabel || 'Book an Appointment'}</span>
      </header>
      <section className="site-mock-hero">
        <h3>
          <em style={{ color: 'var(--mock-primary)' }}>Compassionate</em>{' '}
          <em style={{ color: 'var(--mock-accent)' }}>Mental Health Care</em>
        </h3>
        <p>This is how headings, the header button, and the footer band will look.</p>
        <span className="site-mock-cta">{ctaLabel || 'Book an Appointment'}</span>
      </section>
      <footer className="site-mock-footer">
        <strong>Stay Updated on Mental Health &amp; Wellness</strong>
        <span>{phone || '(407) 603-1717'}</span>
      </footer>
    </div>
  );
}

export function FaqPreview({
  question,
  answer,
  category,
}: {
  question?: string;
  answer?: string;
  category?: string | null;
}) {
  const fees = String(category || '') === 'Fees';
  return (
    <div className="site-mock faq-mock">
      <p className="preview-place">
        Shows on <strong>{fees ? '/fees-insurance' : '/faqs'}</strong>
        {fees ? ' (Fees accordion)' : ' (FAQs page)'}
      </p>
      <article className="faq-mock-item open">
        <h3>{question || 'Question'}</h3>
        <p>{answer || 'Answer text appears here after you type it.'}</p>
      </article>
    </div>
  );
}

export function SeoPreview({
  path,
  title,
  description,
  ogImage,
  noindex,
}: {
  path?: string;
  title?: string;
  description?: string;
  ogImage?: string | null;
  noindex?: boolean;
}) {
  const url = `www.lifewellfhp.com${path || '/'}`;
  return (
    <div className="seo-mock">
      {noindex ? <p className="preview-place warn">Hidden from Google (noindex).</p> : null}
      <p className="preview-place">
        Google result for <strong>{path || '/'}</strong>
      </p>
      <div className="serp-card">
        <p className="serp-url">{url}</p>
        <h3>{title || 'Page title'}</h3>
        <p>{description || 'Meta description appears under the title in search results.'}</p>
      </div>
      <p className="preview-place">Social share card</p>
      <div className="og-card">
        {ogImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicAssetUrl(ogImage)} alt="" />
        ) : (
          <div className="og-fallback">No social image yet</div>
        )}
        <div>
          <small>LIFEWELLFHP.COM</small>
          <strong>{title || 'Page title'}</strong>
          <span>{description || 'Description'}</span>
        </div>
      </div>
    </div>
  );
}

function PlacementList({ items }: { items: Placement[] }) {
  if (!items.length) {
    return (
      <p className="preview-place warn">
        Not attached to a page yet. Copy the URL into Services, Insurance, Homepage, Appearance, or Blog, then Save.
      </p>
    );
  }
  return (
    <ul className="placement-list">
      {items.map((item) => (
        <li key={`${item.label}-${item.path}-${item.detail}`}>
          <strong>{item.label}</strong>
          <span>{item.path}</span>
          <em>{item.detail}</em>
        </li>
      ))}
    </ul>
  );
}

export function MediaPreview({
  url,
  title,
  alt,
}: {
  url?: string;
  title?: string;
  alt?: string | null;
}) {
  const [placements, setPlacements] = useState<Placement[] | null>(null);
  const src = publicAssetUrl(url || '');

  useEffect(() => {
    if (!url) {
      setPlacements([]);
      return;
    }
    let cancelled = false;
    void findMediaPlacements(url).then((rows) => {
      if (!cancelled) setPlacements(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <div className="media-mock">
      <div className="media-frame">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt || title || ''} />
        ) : (
          <p>No image URL yet</p>
        )}
      </div>
      <p className="preview-place">
        <strong>{title || 'Untitled image'}</strong> — visitors see this only after Save and after it is attached to a page.
      </p>
      {placements ? <PlacementList items={placements} /> : <p className="muted">Checking where this image is used…</p>}
    </div>
  );
}

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

export function VideoPreview({
  title,
  url,
  provider,
  description,
  embedHtml,
  published,
}: {
  title?: string;
  url?: string;
  provider?: string;
  description?: string | null;
  embedHtml?: string | null;
  published?: boolean;
}) {
  const yt = provider === 'youtube' && url ? youtubeId(url) : null;
  return (
    <div className="video-mock">
      <p className="preview-place">
        Homepage section <strong>Watch and Learn</strong> ({VIDEO_PLACEMENT.path})
        {published === false ? ' — draft, hidden from visitors until published and saved.' : ' — goes live after Save.'}
      </p>
      <div className="video-frame">
        {embedHtml ? (
          <div className="video-embed" dangerouslySetInnerHTML={{ __html: embedHtml }} />
        ) : yt ? (
          <iframe title={title || 'Video'} src={`https://www.youtube-nocookie.com/embed/${yt}`} allowFullScreen />
        ) : url ? (
          <video src={publicAssetUrl(url)} controls />
        ) : (
          <p>Add a URL to preview</p>
        )}
      </div>
      <h3>{title || 'Video title'}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}

export function InsurancePreview({
  name,
  logoUrl,
}: {
  name?: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="insurance-mock">
      <p className="preview-place">
        Logo grid on <strong>/fees-insurance</strong>
      </p>
      <div className="insurance-logo-card">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicAssetUrl(logoUrl)} alt={name || ''} />
        ) : (
          <span>Add a logo URL</span>
        )}
      </div>
      <strong>{name || 'Plan name'}</strong>
    </div>
  );
}

export function ServicePreview({
  title,
  summary,
  body,
  imageUrl,
  category,
  slug,
}: {
  title?: string;
  summary?: string | null;
  body?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  slug?: string;
}) {
  const src = publicAssetUrl(imageUrl || '/images/services/Psychiatric-Evaluation-Telehealth.avif');
  const paragraphs = String(body || '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 4);

  return (
    <div className="service-mock">
      <p className="preview-place">
        Card on <strong>/our-services</strong>
        {slug ? (
          <>
            {' '}
            and page <strong>/services/{slug}</strong>
          </>
        ) : null}
        {category ? ` · ${category}` : ''}
      </p>
      <article className="service-card-mock">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title || ''} />
        <h3>{title || 'Service title'}</h3>
        <p>{summary || 'Short summary shown on service cards.'}</p>
      </article>
      <div className="service-page-mock">
        <div className="service-hero-mock">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" />
          <div>
            <h3>{title || 'Service title'}</h3>
            <p>{summary || 'Lead paragraph under the heading.'}</p>
          </div>
        </div>
        {paragraphs.length ? (
          paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)
        ) : (
          <p className="muted">Add full content to preview the service page body.</p>
        )}
      </div>
    </div>
  );
}
