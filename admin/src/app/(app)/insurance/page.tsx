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
  'BH Complete Commercial',
  'FL DSNP',
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
] as const;

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
    if (!confirm('Apply the approved Florida insurance list and disclaimer?')) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const insuranceResponse = await api<InsuranceRow[]>('/api/admin/insurance');
      if (!insuranceResponse.success) throw new Error(`Loading insurance plans failed: ${insuranceResponse.message || 'Request failed'}`);
      const rows = insuranceResponse.data || [];
      const usedIds = new Set<string>();
      for (const [sort_order, name] of approvedInsurance.entries()) {
        const existing = rows.find((row) => row.name === name && !usedIds.has(row.id));
        if (existing) {
          usedIds.add(existing.id);
          const response = await api(`/api/admin/insurance/${existing.id}`, {
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

      for (const row of rows) {
        if (usedIds.has(row.id)) continue;
        if (row.published) {
          const response = await api(`/api/admin/insurance/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ published: false }),
          });
          if (!response.success) throw new Error(`Unpublishing ${row.name} failed: ${response.message || 'Request failed'}`);
        }
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
      <ResourceManager
      title="Insurance"
      subtitle="Plans and logos on /fees-insurance. Preview the logo card, then Save to update the public page."
      endpoint="/api/admin/insurance"
      createDefaults={{ published: true, self_pay: false, sort_order: 0 }}
      itemLabel={(r) => String(r.name || 'Plan')}
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
          key: 'self_pay',
          label: 'Self-pay',
          render: (r) => (r.self_pay ? 'Yes' : 'No'),
        },
        {
          key: 'published',
          label: 'Published',
          render: (r) => (r.published ? <span className="badge ok">Live</span> : 'Draft'),
        },
      ]}
      fields={[
        { key: 'name', label: 'Name' },
        { key: 'logo_url', label: 'Logo URL (from Media)' },
        { key: 'notes', label: 'Notes', type: 'textarea', full: true },
        { key: 'sort_order', label: 'Sort order', type: 'number' },
        { key: 'self_pay', label: 'Self-pay option', type: 'checkbox' },
        { key: 'published', label: 'Published', type: 'checkbox' },
      ]}
    />
    </div>
  );
}
