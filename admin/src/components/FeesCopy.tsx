'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PROTECTED_PSYCHIATRIC_PRICING } from '@/lib/protected-pricing';

type SectionRow = {
  id: string;
  page_key: string;
  section_key: string;
  content?: Record<string, unknown> | null;
  updated_at?: string;
};

/** Phase 15: the editable half of a governed pricing row — only these two fields are ever owner-editable. */
type PricingFeeDraft = { initialFee: string; followUpFee: string };
type PricingDraft = Record<string, PricingFeeDraft>;

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function bodyText(value: unknown) {
  if (Array.isArray(value)) return value.filter((p) => typeof p === 'string').join('\n\n');
  return typeof value === 'string' ? value : '';
}

/**
 * Phase 15: seeds the editable fee fields from whatever is currently
 * stored, falling back per-field to the protected figure when the stored
 * value for that specific state isn't itself a sane positive number. This
 * is presentation-only pre-fill convenience, not the authority check —
 * the actual public-site gate (resolvePsychiatricStatePricing() in
 * client/src/lib/cms-resolve.ts) independently validates the full
 * collection, including governance flags, and is the only thing that
 * decides whether CMS pricing actually goes live.
 */
function seedPricingDraft(rawPricing: unknown): PricingDraft {
  const rows = Array.isArray(rawPricing) ? rawPricing : [];
  const draft: PricingDraft = {};
  for (const protectedRow of PROTECTED_PSYCHIATRIC_PRICING) {
    const stored = rows.find((r) => r && typeof r === 'object' && (r as Record<string, unknown>).state === protectedRow.state) as
      | Record<string, unknown>
      | undefined;
    const storedInitial = stored?.initialFee;
    const storedFollowUp = stored?.followUpFee;
    draft[protectedRow.state] = {
      initialFee: String(
        typeof storedInitial === 'number' && Number.isFinite(storedInitial) && storedInitial > 0
          ? storedInitial
          : protectedRow.initialFee
      ),
      followUpFee: String(
        typeof storedFollowUp === 'number' && Number.isFinite(storedFollowUp) && storedFollowUp > 0
          ? storedFollowUp
          : protectedRow.followUpFee
      ),
    };
  }
  return draft;
}

/** Phase 15: a single field is valid only if it parses to a finite number > 0 — matches the public resolver's own fee validity rule exactly, so nothing an owner is blocked from saving here could ever be rejected by the public site for the same reason. */
function isValidFeeInput(value: string): boolean {
  if (!value.trim()) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
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
  // The raw, unmodified CMS record for the self_pay section, kept so the
  // marketing-copy save below can pass any *other* stored key through
  // byte-for-byte via the spread in saveSection() — including whatever
  // psychiatricStatePricing value already exists. The marketing-copy save
  // action never reads, edits, or reconstructs that field itself (see its
  // own comment below); site_sections.content is replaced wholesale per
  // PATCH, not merged field-by-field, so leaving it untouched here is what
  // preserves it rather than silently erasing it.
  const [selfPayContent, setSelfPayContent] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Phase 15 (Restore Governed CMS Pricing Authority with Protected
  // Fallback): a deliberately separate save action/payload from the
  // marketing-copy form above — pricing is only ever included in a PATCH
  // when this specific action fires, never as a side effect of saving
  // ordinary copy.
  const [pricingDraft, setPricingDraft] = useState<PricingDraft>(() => seedPricingDraft(null));
  const [pricingErrors, setPricingErrors] = useState<Record<string, string>>({});
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [pricingMessage, setPricingMessage] = useState<string | null>(null);

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
      setPricingDraft(seedPricingDraft(c.psychiatricStatePricing));
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
        // This marketing-copy save deliberately never sets a
        // `psychiatricStatePricing` key — whatever value already exists in
        // the spread `...selfPayContent` (loaded verbatim from the CMS
        // row, never edited by this action) passes through completely
        // unchanged. Pricing is only ever written by the separate "Save
        // pricing" action below (onSavePricing), with its own explicit
        // payload — never as a side effect of saving ordinary copy.
        saveSection(selfPayId, 'self_pay', 'Self-pay', {
          ...selfPayContent,
          heading: selfPayHeading,
          body: selfPayBody
            .split(/\n\s*\n/)
            .map((p) => p.trim())
            .filter(Boolean),
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

  /**
   * Phase 15: the ONLY code path in this component that ever includes
   * `psychiatricStatePricing` in a save payload. Validates every field
   * first (finite, > 0) and refuses to call the API at all if anything is
   * invalid — this mirrors the public resolver's own validity rule
   * exactly, so a save that passes this check is guaranteed to also pass
   * the public site's own governance check and go live, and a save that
   * fails this check is never sent. Governance flags (`selfPayOnly`/
   * `slidingScaleAvailable`) are always taken from the protected constant,
   * never from user input — there is no control that can alter them.
   */
  async function onSavePricing() {
    const nextErrors: Record<string, string> = {};
    for (const state of PROTECTED_PSYCHIATRIC_PRICING) {
      const draft = pricingDraft[state.state];
      if (!draft || !isValidFeeInput(draft.initialFee)) {
        nextErrors[`${state.state}-initial`] = 'Enter a whole dollar amount greater than $0.';
      }
      if (!draft || !isValidFeeInput(draft.followUpFee)) {
        nextErrors[`${state.state}-followup`] = 'Enter a whole dollar amount greater than $0.';
      }
    }
    setPricingErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setPricingError('Fix the highlighted fields before saving.');
      setPricingMessage(null);
      return;
    }

    setPricingSaving(true);
    setPricingError(null);
    setPricingMessage(null);
    try {
      const payload = PROTECTED_PSYCHIATRIC_PRICING.map((state) => ({
        state: state.state,
        selfPayOnly: state.selfPayOnly,
        slidingScaleAvailable: state.slidingScaleAvailable,
        initialFee: Number(pricingDraft[state.state].initialFee),
        followUpFee: Number(pricingDraft[state.state].followUpFee),
      }));
      const res = await saveSection(selfPayId, 'self_pay', 'Self-pay', {
        ...selfPayContent,
        psychiatricStatePricing: payload,
      });
      if (!res.success) {
        setPricingError(res.message || 'Save failed');
        return;
      }
      await load();
      setPricingMessage('Pricing saved. This now controls the public website. Refresh /fees-insurance to see it.');
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : 'Unexpected save error';
      setPricingError(`Save failed: ${message}`);
    } finally {
      setPricingSaving(false);
    }
  }

  return (
    <form className="card card-pad" onSubmit={onSubmit} style={{ marginBottom: '1.25rem' }}>
      <h2>Fees page text</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Intro and self-pay copy on /fees-insurance. Plan logos are in the table below.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}
      <div className="field">
        <label htmlFor="fees-intro-heading">Intro heading</label>
        <input id="fees-intro-heading" value={introHeading} onChange={(e) => setIntroHeading(e.target.value)} />
      </div>
      <h3>Psychiatric Self-Pay Pricing</h3>
      <p className="muted">
        Psychiatric self-pay pricing entered here controls the public website after it is saved. If CMS pricing is
        missing or invalid, the website uses protected fallback pricing.
      </p>
      {pricingError ? <div className="error-banner">{pricingError}</div> : null}
      {pricingMessage ? <div className="ok-banner">{pricingMessage}</div> : null}
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '0.75rem' }}>
        {PROTECTED_PSYCHIATRIC_PRICING.map((state) => {
          const draft = pricingDraft[state.state] ?? { initialFee: '', followUpFee: '' };
          const initialError = pricingErrors[`${state.state}-initial`];
          const followUpError = pricingErrors[`${state.state}-followup`];
          return (
            <div key={state.state} className="card card-pad" style={{ margin: 0 }}>
              <strong>{state.state}</strong>
              {state.selfPayOnly ? (
                <div>
                  <span className="badge warn">Self-Pay Only</span>
                </div>
              ) : null}
              <div className="field" style={{ marginTop: '0.5rem' }}>
                <label htmlFor={`pricing-${state.state}-initial`}>Initial psychiatric evaluation ($)</label>
                <input
                  id={`pricing-${state.state}-initial`}
                  type="number"
                  min="1"
                  step="1"
                  value={draft.initialFee}
                  onChange={(e) =>
                    setPricingDraft((current) => ({
                      ...current,
                      [state.state]: { ...current[state.state], initialFee: e.target.value },
                    }))
                  }
                />
                {initialError ? <p className="field-error">{initialError}</p> : null}
              </div>
              <div className="field">
                <label htmlFor={`pricing-${state.state}-followup`}>Follow-up medication management ($)</label>
                <input
                  id={`pricing-${state.state}-followup`}
                  type="number"
                  min="1"
                  step="1"
                  value={draft.followUpFee}
                  onChange={(e) =>
                    setPricingDraft((current) => ({
                      ...current,
                      [state.state]: { ...current[state.state], followUpFee: e.target.value },
                    }))
                  }
                />
                {followUpError ? <p className="field-error">{followUpError}</p> : null}
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className="btn btn-primary" onClick={() => void onSavePricing()} disabled={pricingSaving} style={{ marginBottom: '1.25rem' }}>
        {pricingSaving ? 'Saving pricing…' : 'Save pricing'}
      </button>
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
