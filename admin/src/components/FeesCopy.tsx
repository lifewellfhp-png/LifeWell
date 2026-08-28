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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function bodyText(value: unknown) {
  if (Array.isArray(value)) return value.filter((p) => typeof p === 'string').join('\n\n');
  return typeof value === 'string' ? value : '';
}

export function FeesCopy() {
  const [introId, setIntroId] = useState<string | null>(null);
  const [selfPayId, setSelfPayId] = useState<string | null>(null);
  const [insuranceId, setInsuranceId] = useState<string | null>(null);
  const [introHeading, setIntroHeading] = useState('');
  const [introBody, setIntroBody] = useState('');
  const [selfPayHeading, setSelfPayHeading] = useState('');
  const [selfPayBody, setSelfPayBody] = useState('');
  const [insuranceDisclaimer, setInsuranceDisclaimer] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api<SectionRow[]>('/api/admin/sections');
    if (!res.success) {
      setError(res.message || 'Could not load fees copy');
      return;
    }
    const rows = res.data || [];
    const latest = (key: string) =>
      [...rows]
        .filter((r) => r.page_key === 'fees' && r.section_key === key)
        .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))[0];
    const intro = latest('intro');
    const selfPay = latest('self_pay');
    const insurance = latest('insurance');
    setIntroId(intro?.id ?? null);
    setSelfPayId(selfPay?.id ?? null);
    setInsuranceId(insurance?.id ?? null);
    if (intro) {
      const c = asRecord(intro.content);
      setIntroHeading(String(c.heading || ''));
      setIntroBody(bodyText(c.body));
    }
    if (selfPay) {
      const c = asRecord(selfPay.content);
      setSelfPayHeading(String(c.heading || ''));
      setSelfPayBody(bodyText(c.body));
    }
    if (insurance) {
      const c = asRecord(insurance.content);
      setInsuranceDisclaimer(String(c.disclaimer || ''));
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSection(id: string | null, section_key: string, title: string, content: Record<string, unknown>) {
    const payload = { page_key: 'fees', section_key, title, published: true, content };
    if (id) return api(`/api/admin/sections/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    return api('/api/admin/sections', { method: 'POST', body: JSON.stringify(payload) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const [introRes, selfPayRes, insuranceRes] = await Promise.all([
      saveSection(introId, 'intro', 'Fees intro', { heading: introHeading, body: introBody }),
      saveSection(selfPayId, 'self_pay', 'Self-pay', {
        heading: selfPayHeading,
        body: selfPayBody
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
      }),
      saveSection(insuranceId, 'insurance', 'Insurance disclaimer', { disclaimer: insuranceDisclaimer }),
    ]);
    setSaving(false);
    if (!introRes.success || !selfPayRes.success || !insuranceRes.success) {
      setError(introRes.message || selfPayRes.message || insuranceRes.message || 'Save failed');
      return;
    }
    setMessage('Saved. Refresh /fees-insurance on the public site to see the copy.');
    await load();
  }

  return (
    <form className="card card-pad" onSubmit={onSubmit} style={{ marginBottom: '1.25rem' }}>
      <h2>Fees page text</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Intro and self-pay copy on /fees-insurance. Plan logos are in the table below. Dollar amounts stay in the site
        template unless you change them in code.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}
      <div className="field">
        <label htmlFor="fees-intro-heading">Intro heading</label>
        <input id="fees-intro-heading" value={introHeading} onChange={(e) => setIntroHeading(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fees-intro-body">Intro body</label>
        <textarea id="fees-intro-body" rows={4} value={introBody} onChange={(e) => setIntroBody(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fees-selfpay-heading">Self-pay heading</label>
        <input id="fees-selfpay-heading" value={selfPayHeading} onChange={(e) => setSelfPayHeading(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fees-selfpay-body">Self-pay body (blank line between paragraphs)</label>
        <textarea id="fees-selfpay-body" rows={5} value={selfPayBody} onChange={(e) => setSelfPayBody(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fees-insurance-disclaimer">Insurance coverage disclaimer</label>
        <textarea
          id="fees-insurance-disclaimer"
          rows={2}
          value={insuranceDisclaimer}
          placeholder="Coverage varies by plan and state — please contact us to verify your benefits before scheduling."
          onChange={(e) => setInsuranceDisclaimer(e.target.value)}
        />
        <p className="muted" style={{ marginTop: '0.25rem' }}>
          Shown under the accepted-plans logos on this page. Keep this so visitors know coverage
          isn&apos;t guaranteed and should be verified.
        </p>
      </div>
      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save fees text'}
      </button>
    </form>
  );
}
