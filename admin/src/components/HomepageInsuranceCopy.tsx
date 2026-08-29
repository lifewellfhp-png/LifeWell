'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type SectionRow = {
  id: string;
  page_key: string;
  section_key: string;
  content?: Record<string, unknown> | null;
  updated_at?: string;
};

const defaults = {
  heading: 'Insurance & Self-Pay Options',
  body: 'We offer self-pay options for all patients. Insurance participation is limited by state and plan. Massachusetts and Arizona visits are self-pay only at this time.',
  disclaimer: 'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.',
  ctaLabel: 'View fees & insurance details',
  ctaHref: '/fees-insurance',
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

export function HomepageInsuranceCopy() {
  const [id, setId] = useState<string | null>(null);
  const [loadedContent, setLoadedContent] = useState<Record<string, unknown>>({});
  const [heading, setHeading] = useState(defaults.heading);
  const [body, setBody] = useState(defaults.body);
  const [disclaimer, setDisclaimer] = useState(defaults.disclaimer);
  const [ctaLabel, setCtaLabel] = useState(defaults.ctaLabel);
  const [ctaHref, setCtaHref] = useState(defaults.ctaHref);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api<SectionRow[]>('/api/admin/sections');
    if (!res.success) {
      setError(res.message || 'Could not load homepage insurance copy');
      return;
    }
    const row = (res.data || [])
      .filter((item) => item.page_key === 'home' && item.section_key === 'insurance')
      .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))[0];
    const content = asRecord(row?.content);
    setId(row?.id ?? null);
    setLoadedContent(content);
    setHeading(typeof content.heading === 'string' ? content.heading : defaults.heading);
    setBody(typeof content.body === 'string' ? content.body : defaults.body);
    setDisclaimer(typeof content.disclaimer === 'string' ? content.disclaimer : defaults.disclaimer);
    setCtaLabel(typeof content.ctaLabel === 'string' ? content.ctaLabel : defaults.ctaLabel);
    setCtaHref(typeof content.ctaHref === 'string' ? content.ctaHref : defaults.ctaHref);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const content = {
      ...loadedContent,
      heading,
      body,
      disclaimer,
      ctaLabel,
      ctaHref,
    };
    const payload = {
      page_key: 'home',
      section_key: 'insurance',
      title: 'Homepage Insurance Section',
      published: true,
      content,
    };
    const res = id
      ? await api(`/api/admin/sections/${id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api('/api/admin/sections', { method: 'POST', body: JSON.stringify(payload) });
    setSaving(false);
    if (!res.success) {
      setError(res.message || 'Save failed');
      return;
    }
    setMessage('Saved. Refresh the public homepage to see the copy.');
    await load();
  }

  return (
    <form className="card card-pad" onSubmit={onSubmit} style={{ marginBottom: '1.25rem' }}>
      <h2>Homepage Insurance Section</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Controls the Insurance &amp; Self-Pay section shown on the homepage. Insurance plans and logos are managed separately below.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}
      <div className="field">
        <label htmlFor="homepage-insurance-heading">Heading</label>
        <input id="homepage-insurance-heading" value={heading} onChange={(e) => setHeading(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="homepage-insurance-body">Body</label>
        <textarea id="homepage-insurance-body" rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="homepage-insurance-disclaimer">Disclaimer</label>
        <textarea
          id="homepage-insurance-disclaimer"
          rows={3}
          value={disclaimer}
          onChange={(e) => setDisclaimer(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="homepage-insurance-cta-label">CTA label</label>
        <input id="homepage-insurance-cta-label" value={ctaLabel} onChange={(e) => setCtaLabel(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="homepage-insurance-cta-href">CTA link</label>
        <input id="homepage-insurance-cta-href" value={ctaHref} onChange={(e) => setCtaHref(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save homepage insurance copy'}
      </button>
    </form>
  );
}
