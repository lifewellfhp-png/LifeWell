'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { api } from '@/lib/api';
import { PreviewShell } from '@/components/PreviewShell';
import { AppearancePreview } from '@/components/SitePreviews';

type Settings = {
  primary_color: string;
  accent_color: string;
  heading_font: string;
  body_font: string;
  header_cta_label: string;
  header_cta_url: string;
  logo_url?: string | null;
  practice_phone?: string | null;
  practice_email?: string | null;
};

const empty: Settings = {
  primary_color: '#3E7FB1',
  accent_color: '#5FAF6B',
  heading_font: 'Lora',
  body_font: 'Source Sans 3',
  header_cta_label: 'Book an Appointment',
  header_cta_url: '/book-telehealth-mental-health-appointment#charm-calendar',
  logo_url: '',
  practice_phone: '',
  practice_email: '',
};

export default function AppearancePage() {
  const [form, setForm] = useState<Settings>(empty);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    void api<Settings>('/api/admin/settings').then((res) => {
      if (!res.success || !res.data) setError(res.message || 'Could not load settings');
      else setForm({ ...empty, ...res.data, logo_url: res.data.logo_url || '', practice_phone: res.data.practice_phone || '', practice_email: res.data.practice_email || '' });
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await api('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({
        ...form,
        logo_url: form.logo_url || null,
        practice_phone: form.practice_phone || null,
        practice_email: form.practice_email || null,
      }),
    });
    setSaving(false);
    if (!res.success) setError(res.message || 'Save failed');
    else setMessage('Saved. The public website now uses these colors, fonts, and logo.');
  }

  const preview = (
    <AppearancePreview
      primary={form.primary_color}
      accent={form.accent_color}
      headingFont={form.heading_font}
      bodyFont={form.body_font}
      ctaLabel={form.header_cta_label}
      logoUrl={form.logo_url}
      phone={form.practice_phone}
    />
  );

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Appearance</h1>
          <p className="page-sub">
            Change colors and type, preview instantly, then save to update the public website.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => setPreviewOpen(true)}>
          <Eye size={16} />
          Preview
        </button>
      </div>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      <div className="appearance-layout">
        <form className="card card-pad" onSubmit={onSubmit}>
          <p className="page-sub" style={{ marginTop: 0 }}>
            The admin sidebar stays blue. These colors apply to the public website only after Save.
          </p>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="primary_color">Primary color</label>
              <div className="color-row">
                <input
                  id="primary_color"
                  type="color"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                />
                <input
                  aria-label="Primary color hex"
                  value={form.primary_color}
                  onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#3E7FB1"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="accent_color">Accent color</label>
              <div className="color-row">
                <input
                  id="accent_color"
                  type="color"
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                />
                <input
                  aria-label="Accent color hex"
                  value={form.accent_color}
                  onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
                  pattern="^#[0-9A-Fa-f]{6}$"
                  placeholder="#5FAF6B"
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="heading_font">Heading font</label>
              <select
                id="heading_font"
                value={form.heading_font}
                onChange={(e) => setForm({ ...form, heading_font: e.target.value })}
              >
                <option>Lora</option>
                <option>Georgia</option>
                <option>Playfair Display</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="body_font">Body font</label>
              <select
                id="body_font"
                value={form.body_font}
                onChange={(e) => setForm({ ...form, body_font: e.target.value })}
              >
                <option>Source Sans 3</option>
                <option>Inter</option>
                <option>system-ui</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="header_cta_label">Header button label</label>
              <input
                id="header_cta_label"
                value={form.header_cta_label}
                onChange={(e) => setForm({ ...form, header_cta_label: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="header_cta_url">Header button URL</label>
              <input
                id="header_cta_url"
                value={form.header_cta_url}
                onChange={(e) => setForm({ ...form, header_cta_url: e.target.value })}
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="logo_url">Logo URL</label>
              <input
                id="logo_url"
                value={form.logo_url || ''}
                onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                placeholder="/images/brand/logo-v2.avif or uploaded media URL"
              />
            </div>
            <div className="field">
              <label htmlFor="practice_phone">Public phone</label>
              <input
                id="practice_phone"
                value={form.practice_phone || ''}
                onChange={(e) => setForm({ ...form, practice_phone: e.target.value })}
              />
            </div>
            <div className="field">
              <label htmlFor="practice_email">Public email</label>
              <input
                id="practice_email"
                type="email"
                value={form.practice_email || ''}
                onChange={(e) => setForm({ ...form, practice_email: e.target.value })}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '1rem' }}>
            {saving ? 'Saving…' : 'Save to website'}
          </button>
        </form>

        <aside className="card card-pad live-preview-pane appearance-aside">
          <p className="preview-kicker">Live preview</p>
          <p className="preview-hint">Updates as you change colors. Visitors see this only after Save.</p>
          {preview}
        </aside>
      </div>

      {previewOpen ? (
        <PreviewShell
          title="Public website colors"
          hint="Draft preview from this form. Save to push it to visitors."
          livePath="/"
          onClose={() => setPreviewOpen(false)}
        >
          {preview}
        </PreviewShell>
      ) : null}
    </div>
  );
}
