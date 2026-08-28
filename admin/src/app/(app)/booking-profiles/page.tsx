'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api } from '@/lib/api';

type ZocdocForm = {
  enabled: boolean;
  booking_url: string;
  profile_url: string;
  cta_label: string;
  description: string;
  rating_enabled: boolean;
  rating: string;
  review_count: string;
  rating_verified_at: string;
};

type PsychologyTodayForm = {
  enabled: boolean;
  profile_url: string;
  contact_url: string;
  cta_label: string;
  description: string;
};

type DisplayForm = {
  homepage: boolean;
  booking_page: boolean;
  bio_page: boolean;
  reviews_page: boolean;
};

type FormState = {
  zocdoc: ZocdocForm;
  psychology_today: PsychologyTodayForm;
  display: DisplayForm;
};

const EMPTY: FormState = {
  zocdoc: {
    enabled: false,
    booking_url: '',
    profile_url: '',
    cta_label: 'Book through Zocdoc',
    description: '',
    rating_enabled: false,
    rating: '',
    review_count: '',
    rating_verified_at: '',
  },
  psychology_today: {
    enabled: false,
    profile_url: '',
    contact_url: '',
    cta_label: 'View our Psychology Today profile',
    description: '',
  },
  display: {
    homepage: false,
    booking_page: true,
    bio_page: false,
    reviews_page: true,
  },
};

type SectionRow = {
  id: string;
  page_key: string;
  section_key: string;
  title?: string | null;
  content?: unknown;
  published?: boolean;
};

function str(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function isHttpsUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (!/^https:\/\//i.test(trimmed)) return false;
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export default function BookingProfilesPage() {
  const [rowId, setRowId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void api<SectionRow[]>('/api/admin/sections').then((res) => {
      setLoading(false);
      if (!res.success || !res.data) {
        setError(res.message || 'Could not load Booking & Profiles settings');
        return;
      }
      const row = res.data.find((r) => r.page_key === 'global' && r.section_key === 'booking_profiles');
      if (!row) return;
      setRowId(row.id);
      const content = record(row.content);
      const zocdoc = record(content.zocdoc);
      const pt = record(content.psychology_today);
      const display = record(content.display);
      setForm({
        zocdoc: {
          enabled: zocdoc.enabled === true,
          booking_url: str(zocdoc.booking_url),
          profile_url: str(zocdoc.profile_url),
          cta_label: str(zocdoc.cta_label) || EMPTY.zocdoc.cta_label,
          description: str(zocdoc.description),
          rating_enabled: zocdoc.rating_enabled === true,
          rating: zocdoc.rating === null || zocdoc.rating === undefined ? '' : str(zocdoc.rating),
          review_count: zocdoc.review_count === null || zocdoc.review_count === undefined ? '' : str(zocdoc.review_count),
          rating_verified_at: str(zocdoc.rating_verified_at),
        },
        psychology_today: {
          enabled: pt.enabled === true,
          profile_url: str(pt.profile_url),
          contact_url: str(pt.contact_url),
          cta_label: str(pt.cta_label) || EMPTY.psychology_today.cta_label,
          description: str(pt.description),
        },
        display: {
          homepage: display.homepage === true,
          booking_page: display.booking_page !== false,
          bio_page: display.bio_page === true,
          reviews_page: display.reviews_page !== false,
        },
      });
    });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const urlChecks: [string, string][] = [
      ['Zocdoc booking URL', form.zocdoc.booking_url],
      ['Zocdoc profile URL', form.zocdoc.profile_url],
      ['Psychology Today profile URL', form.psychology_today.profile_url],
      ['Psychology Today contact URL', form.psychology_today.contact_url],
    ];
    for (const [label, value] of urlChecks) {
      if (!isHttpsUrl(value)) {
        setError(`${label} must start with https:// (leave blank if you don't have one yet).`);
        return;
      }
    }
    if (form.zocdoc.rating.trim()) {
      const n = Number(form.zocdoc.rating);
      if (!Number.isFinite(n) || n <= 0 || n > 5) {
        setError('Zocdoc rating must be a number between 0 and 5.');
        return;
      }
    }
    if (form.zocdoc.review_count.trim()) {
      const n = Number(form.zocdoc.review_count);
      if (!Number.isInteger(n) || n < 0) {
        setError('Zocdoc review count must be a whole number, 0 or greater.');
        return;
      }
    }

    setSaving(true);
    const payload = {
      page_key: 'global',
      section_key: 'booking_profiles',
      title: 'Booking & Profiles integrations',
      published: true,
      content: {
        zocdoc: {
          enabled: form.zocdoc.enabled,
          booking_url: form.zocdoc.booking_url.trim(),
          profile_url: form.zocdoc.profile_url.trim(),
          cta_label: form.zocdoc.cta_label.trim() || EMPTY.zocdoc.cta_label,
          description: form.zocdoc.description.trim(),
          rating_enabled: form.zocdoc.rating_enabled,
          rating: form.zocdoc.rating.trim() ? Number(form.zocdoc.rating) : null,
          review_count: form.zocdoc.review_count.trim() ? Number(form.zocdoc.review_count) : null,
          rating_verified_at: form.zocdoc.rating_verified_at.trim(),
        },
        psychology_today: {
          enabled: form.psychology_today.enabled,
          profile_url: form.psychology_today.profile_url.trim(),
          contact_url: form.psychology_today.contact_url.trim(),
          cta_label: form.psychology_today.cta_label.trim() || EMPTY.psychology_today.cta_label,
          description: form.psychology_today.description.trim(),
        },
        display: { ...form.display },
      },
    };

    const res = rowId
      ? await api<SectionRow>(`/api/admin/sections/${rowId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      : await api<SectionRow>('/api/admin/sections', { method: 'POST', body: JSON.stringify(payload) });

    setSaving(false);
    if (!res.success) {
      setError(res.message || 'Save failed');
      return;
    }
    if (res.data?.id) setRowId(res.data.id);
    setMessage('Saved. The public website now reflects these settings.');
  }

  if (loading) return <p className="page-sub">Loading…</p>;

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Booking &amp; Profiles</h1>
          <p className="page-sub">
            Secondary booking and trust links for Zocdoc and Psychology Today. LifeWell&apos;s own
            booking system stays the primary way patients schedule — configure that on the{' '}
            <a href="/booking">Booking</a> page. Nothing here appears on the public site until you
            enable it and save.
          </p>
        </div>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      <form className="card card-pad" onSubmit={onSubmit}>
        <section>
          <h2 style={{ marginTop: 0 }}>Zocdoc</h2>
          <label className="field-inline" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <input
              type="checkbox"
              checked={form.zocdoc.enabled}
              onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, enabled: e.target.checked } })}
            />
            Enable Zocdoc integration
          </label>

          <div className="grid-2" style={{ marginTop: '1rem' }}>
            <div className="field">
              <label htmlFor="zocdoc_booking_url">Zocdoc booking URL</label>
              <input
                id="zocdoc_booking_url"
                type="url"
                value={form.zocdoc.booking_url}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, booking_url: e.target.value } })}
                placeholder="https://www.zocdoc.com/..."
              />
            </div>
            <div className="field">
              <label htmlFor="zocdoc_profile_url">Zocdoc profile URL</label>
              <input
                id="zocdoc_profile_url"
                type="url"
                value={form.zocdoc.profile_url}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, profile_url: e.target.value } })}
                placeholder="https://www.zocdoc.com/..."
              />
            </div>
            <div className="field">
              <label htmlFor="zocdoc_cta_label">Button label</label>
              <input
                id="zocdoc_cta_label"
                value={form.zocdoc.cta_label}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, cta_label: e.target.value } })}
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="zocdoc_description">Short description (optional)</label>
              <input
                id="zocdoc_description"
                value={form.zocdoc.description}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, description: e.target.value } })}
              />
            </div>
          </div>

          <label className="field-inline" style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginTop: '1.25rem' }}>
            <input
              type="checkbox"
              checked={form.zocdoc.rating_enabled}
              onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, rating_enabled: e.target.checked } })}
            />
            Show a Zocdoc rating/review count
          </label>
          <p className="page-sub" style={{ marginTop: '.25rem' }}>
            Only enter a rating and review count if you have looked them up on your live Zocdoc
            profile just now — do not guess or estimate. Leave both blank to show a plain
            &quot;Read our reviews on Zocdoc&quot; link with no number instead.
          </p>

          <div className="grid-2">
            <div className="field">
              <label htmlFor="zocdoc_rating">Rating (0–5)</label>
              <input
                id="zocdoc_rating"
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={form.zocdoc.rating}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, rating: e.target.value } })}
                placeholder="e.g. 4.9"
              />
            </div>
            <div className="field">
              <label htmlFor="zocdoc_review_count">Review count</label>
              <input
                id="zocdoc_review_count"
                type="number"
                min={0}
                step={1}
                value={form.zocdoc.review_count}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, review_count: e.target.value } })}
                placeholder="e.g. 120"
              />
            </div>
            <div className="field">
              <label htmlFor="zocdoc_verified">Last verified (e.g. &quot;August 2026&quot;)</label>
              <input
                id="zocdoc_verified"
                value={form.zocdoc.rating_verified_at}
                onChange={(e) => setForm({ ...form, zocdoc: { ...form.zocdoc, rating_verified_at: e.target.value } })}
              />
            </div>
          </div>
        </section>

        <hr style={{ margin: '1.75rem 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

        <section>
          <h2>Psychology Today</h2>
          <label className="field-inline" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <input
              type="checkbox"
              checked={form.psychology_today.enabled}
              onChange={(e) =>
                setForm({ ...form, psychology_today: { ...form.psychology_today, enabled: e.target.checked } })
              }
            />
            Enable Psychology Today integration
          </label>

          <div className="grid-2" style={{ marginTop: '1rem' }}>
            <div className="field">
              <label htmlFor="pt_profile_url">Profile URL</label>
              <input
                id="pt_profile_url"
                type="url"
                value={form.psychology_today.profile_url}
                onChange={(e) =>
                  setForm({ ...form, psychology_today: { ...form.psychology_today, profile_url: e.target.value } })
                }
                placeholder="https://www.psychologytoday.com/..."
              />
            </div>
            <div className="field">
              <label htmlFor="pt_contact_url">Contact/booking URL (optional, if different)</label>
              <input
                id="pt_contact_url"
                type="url"
                value={form.psychology_today.contact_url}
                onChange={(e) =>
                  setForm({ ...form, psychology_today: { ...form.psychology_today, contact_url: e.target.value } })
                }
                placeholder="https://www.psychologytoday.com/..."
              />
            </div>
            <div className="field">
              <label htmlFor="pt_cta_label">Link label</label>
              <input
                id="pt_cta_label"
                value={form.psychology_today.cta_label}
                onChange={(e) =>
                  setForm({ ...form, psychology_today: { ...form.psychology_today, cta_label: e.target.value } })
                }
              />
            </div>
            <div className="field" style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="pt_description">Short description (optional)</label>
              <input
                id="pt_description"
                value={form.psychology_today.description}
                onChange={(e) =>
                  setForm({ ...form, psychology_today: { ...form.psychology_today, description: e.target.value } })
                }
              />
            </div>
          </div>
        </section>

        <hr style={{ margin: '1.75rem 0', border: 0, borderTop: '1px solid #e5e7eb' }} />

        <section>
          <h2>Where these appear</h2>
          <p className="page-sub" style={{ marginTop: 0 }}>
            Each integration above still needs to be enabled — these switches only control which
            pages are allowed to show it.
          </p>
          <div className="grid-2">
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <input
                type="checkbox"
                checked={form.display.homepage}
                onChange={(e) => setForm({ ...form, display: { ...form.display, homepage: e.target.checked } })}
              />
              Homepage (subtle secondary link only)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <input
                type="checkbox"
                checked={form.display.booking_page}
                onChange={(e) => setForm({ ...form, display: { ...form.display, booking_page: e.target.checked } })}
              />
              Booking page
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <input
                type="checkbox"
                checked={form.display.bio_page}
                onChange={(e) => setForm({ ...form, display: { ...form.display, bio_page: e.target.checked } })}
              />
              Provider / bio page
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              <input
                type="checkbox"
                checked={form.display.reviews_page}
                onChange={(e) => setForm({ ...form, display: { ...form.display, reviews_page: e.target.checked } })}
              />
              Reviews / testimonials page
            </label>
          </div>
        </section>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: '1.5rem' }}>
          {saving ? 'Saving…' : 'Save to website'}
        </button>
      </form>
    </div>
  );
}
