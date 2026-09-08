'use client';

import { ResourceManager } from '@/components/ResourceManager';
import { InsurancePreview } from '@/components/SitePreviews';
import { FeesCopy } from '@/components/FeesCopy';
import { HomepageInsuranceCopy } from '@/components/HomepageInsuranceCopy';
import { publicAssetUrl } from '@/lib/site';
import { api } from '@/lib/api';
import { useState } from 'react';

const approvedInsurance = [
  'AVMED Florida Exchange',
  'Florida Exchange',
  'Oscar Health Plan',
  'UBH General',
  'Veterans Affairs Coordinated Care Network Region 3',
  'Oxford (Commercial)',
  'Aetna (Commercial)',
  'First Health (Coventry Health Care)',
  'Cigna (Commercial)',
  'Medicaid',
  'Medicare',
  'UHC Medicare Advantage',
  'Optum',
  'Curative',
] as const;

const APPROVED_INSURANCE_SET = new Set<string>(approvedInsurance);

const approvedDisclaimer =
  'Insurance coverage and network participation vary by plan. Please contact us to verify your benefits and eligibility before scheduling.';

type InsuranceRow = {
  id: string;
  name: string;
  published?: boolean;
  self_pay?: boolean;
  sort_order?: number;
};

type SectionRow = {
  id: string;
  page_key: string;
  section_key: string;
  content?: Record<string, unknown> | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function PhaseA1Sync() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const insuranceResponse = await api<InsuranceRow[]>('/api/admin/insurance');
      if (!insuranceResponse.success) throw new Error(`Loading insurance plans failed: ${insuranceResponse.message || 'Request failed'}`);
      const rows = insuranceResponse.data || [];
      const usedIds = new Set<string>();

      // Matching is exact-name only (see below), which silently creates a
      // duplicate row AND unpublishes the "unmatched" original whenever a
      // Production row's name doesn't literally equal the approved string
      // (whitespace, truncation, or any other drift). That already happened
      // once in Production: several rows had truncated names, so a prior
      // sync run created fresh full-name rows with no logo and unpublished
      // the originals that had one. Build the plan first and show exactly
      // what would be created/unpublished so a human can catch a mismatch
      // like that before it's applied, instead of finding out afterward.
      const matchByName = new Map<string, InsuranceRow>();
      const toCreate: string[] = [];
      for (const name of approvedInsurance) {
        const existing = rows.find((row) => row.name === name && !usedIds.has(row.id));
        if (existing) {
          usedIds.add(existing.id);
          matchByName.set(name, existing);
        } else {
          toCreate.push(name);
        }
      }
      const toUnpublish = rows.filter((row) => !usedIds.has(row.id) && row.published);

      const planLines = [
        `Update ${matchByName.size} existing row(s) (name matched exactly).`,
        toCreate.length
          ? `Create ${toCreate.length} NEW row(s) with no logo (no exact name match found): ${toCreate.join(', ')}`
          : null,
        toUnpublish.length
          ? `Unpublish ${toUnpublish.length} existing row(s) not in the approved list: ${toUnpublish.map((r) => r.name).join(', ')}`
          : null,
      ].filter(Boolean);
      if (toCreate.length && toUnpublish.length) {
        planLines.push(
          'Warning: rows are both being created AND unpublished — if a name below is meant to be the same payer as one being unpublished, its logo will be lost. Check for a near-match before continuing.'
        );
      }
      if (!confirm(`Apply the approved Florida insurance list and disclaimer?\n\n${planLines.join('\n')}`)) {
        setBusy(false);
        return;
      }

      for (const [sort_order, name] of approvedInsurance.entries()) {
        const match = matchByName.get(name);
        if (match) {
          const response = await api(`/api/admin/insurance/${match.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name, published: true, self_pay: false, sort_order }),
          });
          if (!response.success) throw new Error(`Updating ${name} failed: ${response.message || 'Request failed'}`);
        } else {
          const response = await api('/api/admin/insurance', {
            method: 'POST',
            body: JSON.stringify({ name, published: true, self_pay: false, sort_order }),
          });
          if (!response.success) throw new Error(`Creating ${name} failed: ${response.message || 'Request failed'}`);
        }
      }

      for (const row of toUnpublish) {
        const response = await api(`/api/admin/insurance/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ published: false }),
        });
        if (!response.success) throw new Error(`Unpublishing ${row.name} failed: ${response.message || 'Request failed'}`);
      }

      // Phase 14 (Remove Legacy CMS Pricing Sync Authority): this tool used
      // to also read/rewrite the fees/self_pay section's psychiatricStatePricing
      // — Phase 12A already made that field inert (client/src/lib/
      // cms-resolve.ts's mapFees() never reads it), and Phase 13 removed the
      // matching editable inputs from FeesCopy.tsx, so "syncing" it here
      // served no purpose and implied a CMS pricing authority that no
      // longer exists. Only the insurance disclaimer (ordinary CMS
      // marketing copy, still legitimately CMS-authoritative) is synced
      // below now.
      const sectionsResponse = await api<SectionRow[]>('/api/admin/sections');
      if (!sectionsResponse.success) throw new Error(`Loading Fees sections failed: ${sectionsResponse.message || 'Request failed'}`);
      const sections = sectionsResponse.data || [];
      const insurance = sections.find((row) => row.page_key === 'fees' && row.section_key === 'insurance');
      if (!insurance?.id) throw new Error('Required Fees CMS section was not found.');

      const insuranceContent = asRecord(insurance.content);
      const insuranceUpdate = await api(`/api/admin/sections/${insurance.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ content: { ...insuranceContent, disclaimer: approvedDisclaimer } }),
      });
      if (!insuranceUpdate.success) throw new Error(`Updating Fees disclaimer failed: ${insuranceUpdate.message || 'Request failed'}`);

      const [verifiedInsurance, verifiedSections] = await Promise.all([
        api<InsuranceRow[]>('/api/admin/insurance'),
        api<SectionRow[]>('/api/admin/sections'),
      ]);
      if (!verifiedInsurance.success || !verifiedSections.success) throw new Error('Post-save verification requests failed.');
      const published = (verifiedInsurance.data || []).filter((row) => row.published);
      const names = published.map((row) => row.name);
      if (published.length !== approvedInsurance.length || approvedInsurance.some((name, index) => names[index] !== name)) {
        throw new Error('Post-save verification failed: published insurance list does not match the approved order.');
      }
      const verifiedInsuranceSection = (verifiedSections.data || []).find((row) => row.page_key === 'fees' && row.section_key === 'insurance');
      if (asRecord(verifiedInsuranceSection?.content).disclaimer !== approvedDisclaimer) {
        throw new Error('Post-save verification failed: insurance disclaimer does not match.');
      }
      setMessage('Insurance list and disclaimer sync completed and verified.');
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : 'CMS sync failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card-pad" style={{ marginBottom: '1.25rem' }}>
      <h2>Insurance list sync</h2>
      <p className="muted">
        Synchronizes the approved Florida insurance list and insurance disclaimer. Psychiatric self-pay pricing is
        managed in protected site configuration (see below) and is not affected by this action.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}
      <button type="button" className="btn btn-primary" onClick={() => void sync()} disabled={busy}>
        {busy ? 'Syncing…' : 'Apply Approved Florida Insurance Setup'}
      </button>
    </div>
  );
}

export default function Page() {
  return (
    <div>
      <HomepageInsuranceCopy />
      <FeesCopy />
      <PhaseA1Sync />
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        Published insurers appear on the public Fees &amp; Insurance page. Only insurers in LifeWell&rsquo;s approved
        payer list may be published — the server rejects publishing an insurer that isn&rsquo;t on that list.
      </p>
      <ResourceManager
      title="Insurance"
      subtitle="Plans and logos on /fees-insurance. Preview the logo card, then Save to update the public page."
      endpoint="/api/admin/insurance"
      createDefaults={{ published: true, self_pay: false, sort_order: 0 }}
      itemLabel={(r) => String(r.name || 'Plan')}
      confirmFieldChange={{
        key: 'published',
        message: (from, to, form) => {
          const name = String(form?.name || 'this insurer');
          return to === 'true'
            ? `Publish ${name}?\n\nThis insurer will appear on the public Fees & Insurance page.`
            : `Unpublish ${name}?\n\nThis insurer will no longer appear on the public Fees & Insurance page.`;
        },
      }}
      preview={{
        hint: 'This logo appears in the Fees & Insurance grid after Save.',
        liveHref: () => '/fees-insurance',
        render: (form) => (
          <InsurancePreview name={String(form.name || '')} logoUrl={form.logo_url ? String(form.logo_url) : null} />
        ),
      }}
      columns={[
        {
          key: 'logo_url',
          label: 'Logo',
          render: (r) =>
            r.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicAssetUrl(String(r.logo_url))} alt="" className="table-thumb" />
            ) : (
              '—'
            ),
        },
        { key: 'name', label: 'Plan' },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : 'Draft'),
        },
        {
          // Mobile cards only render the table's first 4 columns
          // (ResourceManager's columns.slice(0, 4)) — Published stays ahead
          // of this and self_pay so both remain visible there, not just on
          // the desktop table.
          key: 'approved',
          label: 'Approved',
          render: (r) =>
            APPROVED_INSURANCE_SET.has(String(r.name)) ? (
              <span className="badge ok">Approved</span>
            ) : (
              <span className="badge warn">Not approved</span>
            ),
        },
        {
          key: 'self_pay',
          label: 'Self-pay',
          render: (r) => (r.self_pay ? 'Yes' : 'No'),
        },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        {
          key: 'logo_url',
          label: 'Logo URL (from Media)',
          // Deliberately not type: 'url' — this field's most common legitimate
          // value is a relative local path (/images/insurance/badges/...),
          // which HTML5's native url input validation rejects as invalid
          // (it requires an absolute URL with a scheme). That validation runs
          // on the whole form at submit time, not just this field, so it
          // silently blocked every save — including ones that never touched
          // logo_url — with no error, no event, nothing to debug from JS.
          hint: () => `Local path under /images/insurance/ (e.g. /images/insurance/badges/curative.svg) or a valid https:// URL.`,
        },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'self_pay', label: 'Self-pay option', type: 'checkbox' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
    </div>
  );
}
