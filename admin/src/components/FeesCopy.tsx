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

type PsychiatricStatePricing = {
  state: string;
  selfPayOnly: boolean;
  initialFee: number;
  followUpFee: number;
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
  const [selfPayContent, setSelfPayContent] = useState<Record<string, unknown>>({});
  const [psychiatricPricing, setPsychiatricPricing] = useState<PsychiatricStatePricing[]>([
    { state: 'Florida', selfPayOnly: false, initialFee: 300, followUpFee: 150 },
    { state: 'Massachusetts', selfPayOnly: true, initialFee: 300, followUpFee: 175 },
    { state: 'Arizona', selfPayOnly: true, initialFee: 325, followUpFee: 175 },
  ]);
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
      setSelfPayContent(c);
      setSelfPayHeading(String(c.heading || ''));
      setSelfPayBody(bodyText(c.body));
      if (Array.isArray(c.psychiatricStatePricing)) {
        const pricing = c.psychiatricStatePricing.filter(
          (item): item is PsychiatricStatePricing =>
            Boolean(item) &&
            typeof item === 'object' &&
            typeof (item as Record<string, unknown>).state === 'string' &&
            typeof (item as Record<string, unknown>).initialFee === 'number' &&
            typeof (item as Record<string, unknown>).followUpFee === 'number'
        );
        if (pricing.length === 3) setPsychiatricPricing(pricing);
      }
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
    try {
      const results = await Promise.allSettled([
        saveSection(introId, 'intro', 'Fees intro', { heading: introHeading, body: introBody }),
        saveSection(selfPayId, 'self_pay', 'Self-pay', {
          ...selfPayContent,
          heading: selfPayHeading,
          body: selfPayBody
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
          psychiatricStatePricing: psychiatricPricing,
        }),
        saveSection(insuranceId, 'insurance', 'Insurance disclaimer', { disclaimer: insuranceDisclaimer }),
      ]);
      const labels = ['Intro', 'Self-pay', 'Insurance'];
      const failures = results.flatMap((result, index) => {
        if (result.status === 'rejected') {
          const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
          return `${labels[index]}: ${reason}`;
        }
        if (!result.value.success) {
          return `${labels[index]}: ${result.value.message || 'Request failed'}`;
        }
        return [];
      });
      if (failures.length > 0) {
        setError(`Save incomplete. ${failures.join(' ')}`);
        return;
      }

      const verification = await api<SectionRow[]>('/api/admin/sections');
      if (!verification.success) {
        setError(`Save completed but verification failed: ${verification.message || 'Could not reload CMS records.'}`);
        return;
      }
      const selfPayExists = (verification.data || []).some(
        (row) => row.page_key === 'fees' && row.section_key === 'self_pay'
      );
      if (!selfPayExists) {
        setError('Save completed but the Self-pay CMS record could not be verified. Please try again.');
        return;
      }

      await load();
      setMessage('Saved and verified. Refresh /fees-insurance on the public site to see the copy.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected save error';
      setError(`Save failed: ${message}`);
    } finally {
      setSaving(false);
    }
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
      <h3>Psychiatric state pricing</h3>
      <p className="muted">Initial and follow-up self-pay fees shown for psychiatric care.</p>
      {psychiatricPricing.map((pricing, index) => (
        <div key={pricing.state} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr 1fr 1fr', marginBottom: '0.75rem' }}>
          <strong>{pricing.state}{pricing.selfPayOnly ? ' — Self-pay only' : ''}</strong>
          <input
            aria-label={`${pricing.state} initial fee`}
            type="number"
            value={pricing.initialFee}
            onChange={(e) =>
              setPsychiatricPricing((current) =>
                current.map((item, itemIndex) => (itemIndex === index ? { ...item, initialFee: Number(e.target.value) } : item))
              )
            }
          />
          <input
            aria-label={`${pricing.state} follow-up fee`}
            type="number"
            value={pricing.followUpFee}
            onChange={(e) =>
              setPsychiatricPricing((current) =>
                current.map((item, itemIndex) => (itemIndex === index ? { ...item, followUpFee: Number(e.target.value) } : item))
              )
            }
          />
        </div>
      ))}
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
