'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Contact, Plus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { PageLoader } from '@/components/PageLoader';

// No shared code exists between admin/ and server/ (separate deployments),
// so these mirror server/src/validation/adminSchemas.ts MARKETING_*
// constants by value. Keep them in sync by hand if the server ever changes.
const AUDIENCE_TYPES = ['existing_patient', 'prospective_patient', 'subscriber', 'other'] as const;
const SOURCES = ['manual', 'csv_import', 'website_signup', 'other'] as const;
const STATUSES = ['pending', 'subscribed', 'unsubscribed', 'suppressed'] as const;
const SUPPRESSION_REASONS = ['hard_bounce', 'spam_complaint', 'administrative', 'other'] as const;

type AudienceType = (typeof AUDIENCE_TYPES)[number];
type Source = (typeof SOURCES)[number];
type MarketingStatus = (typeof STATUSES)[number];
type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

type MarketingContact = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  audience_type: AudienceType;
  source: Source;
  marketing_status: MarketingStatus;
  consent_source: Source | null;
  consent_at: string | null;
  unsubscribed_at: string | null;
  suppressed_at: string | null;
  suppression_reason: SuppressionReason | null;
  created_at: string;
  updated_at: string;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type ListData = { items: MarketingContact[]; pagination: Pagination };

const AUDIENCE_LABELS: Record<AudienceType, string> = {
  existing_patient: 'Existing Patient',
  prospective_patient: 'Prospective Patient',
  subscriber: 'Subscriber',
  other: 'Other',
};
const SOURCE_LABELS: Record<Source, string> = {
  manual: 'Manual',
  csv_import: 'CSV Import',
  website_signup: 'Website Signup',
  other: 'Other',
};
const STATUS_LABELS: Record<MarketingStatus, string> = {
  pending: 'Pending',
  subscribed: 'Subscribed',
  unsubscribed: 'Unsubscribed',
  suppressed: 'Suppressed',
};
const SUPPRESSION_REASON_LABELS: Record<SuppressionReason, string> = {
  hard_bounce: 'Hard bounce',
  spam_complaint: 'Spam complaint',
  administrative: 'Administrative',
  other: 'Other',
};

// Mirrors the server's assertMarketingStatusTransition reject-set exactly
// (unsubscribed/suppressed can never move back toward pending or
// subscribed; suppressed is terminal). Restricting the offered options up
// front means a staff member never hits a 422 for a transition that was
// never going to be allowed, and resubscription is never presented as an
// option through this screen.
const STATUS_OPTIONS_BY_CURRENT: Record<MarketingStatus, MarketingStatus[]> = {
  pending: ['pending', 'subscribed', 'unsubscribed', 'suppressed'],
  subscribed: ['subscribed', 'pending', 'unsubscribed', 'suppressed'],
  unsubscribed: ['unsubscribed', 'suppressed'],
  suppressed: ['suppressed'],
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 400;

function statusBadgeClass(status: MarketingStatus): string {
  if (status === 'subscribed') return 'badge ok';
  if (status === 'pending') return 'badge warn';
  if (status === 'suppressed') return 'badge danger';
  return 'badge';
}

function contactName(contact: Pick<MarketingContact, 'first_name' | 'last_name'>): string {
  const name = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim();
  return name || '—';
}

const emptyCreateForm = {
  email: '',
  first_name: '',
  last_name: '',
  audience_type: 'other' as AudienceType,
  marketing_status: 'pending' as MarketingStatus,
};

type CreateForm = typeof emptyCreateForm;

type EditForm = {
  email: string;
  first_name: string;
  last_name: string;
  audience_type: AudienceType;
  marketing_status: MarketingStatus;
  consent_source: Source | '';
  suppression_reason: SuppressionReason | '';
};

export default function MarketingContactsPage() {
  const [items, setItems] = useState<MarketingContact[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MarketingStatus | ''>('');
  const [audienceFilter, setAudienceFilter] = useState<AudienceType | ''>('');
  const [sourceFilter, setSourceFilter] = useState<Source | ''>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState<MarketingContact | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  const [viewing, setViewing] = useState<MarketingContact | null>(null);

  async function load() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('marketing_status', statusFilter);
    if (audienceFilter) params.set('audience_type', audienceFilter);
    if (sourceFilter) params.set('source', sourceFilter);

    setLoading(true);
    const res = await api<ListData>(`/api/admin/marketing-contacts?${params.toString()}`);
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Failed to load marketing contacts.');
      setItems([]);
      setPagination(null);
      return;
    }
    setError(null);
    setItems(res.data?.items || []);
    setPagination(res.data?.pagination || null);
  }

  useEffect(() => {
    void load();
  }, [page, pageSize, debouncedSearch, statusFilter, audienceFilter, sourceFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    document.body.style.overflow = createOpen || editing || viewing ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [createOpen, editing, viewing]);

  function openCreate() {
    setCreateForm(emptyCreateForm);
    setCreateError(null);
    setCreateFieldErrors({});
    setCreateOpen(true);
  }

  function closeCreate() {
    if (createSaving) return;
    setCreateOpen(false);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setCreateSaving(true);
    setCreateError(null);
    setCreateFieldErrors({});

    // Source is hidden on this screen: every contact created here was
    // manually entered by a staff member, so `source` is always 'manual'.
    // Consent source follows the same logic — this form cannot truthfully
    // claim a contact consented via CSV import or the website, since it is
    // being typed in by hand right now, so a subscribed contact created
    // here always gets consent_source 'manual' rather than a free choice.
    const payload: Record<string, unknown> = {
      email: createForm.email.trim(),
      first_name: createForm.first_name.trim() || null,
      last_name: createForm.last_name.trim() || null,
      audience_type: createForm.audience_type,
      source: 'manual',
      marketing_status: createForm.marketing_status,
    };
    if (createForm.marketing_status === 'subscribed') {
      payload.consent_source = 'manual';
    }

    const res = await api('/api/admin/marketing-contacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setCreateSaving(false);
    if (!res.success) {
      setCreateError(res.message || 'Could not add marketing contact.');
      setCreateFieldErrors(res.errors || {});
      return;
    }
    setCreateOpen(false);
    setMessage(`${createForm.email.trim()} was added to the marketing directory.`);
    setPage(1);
    await load();
  }

  function openEdit(contact: MarketingContact) {
    setEditing(contact);
    setEditForm({
      email: contact.email,
      first_name: contact.first_name ?? '',
      last_name: contact.last_name ?? '',
      audience_type: contact.audience_type,
      marketing_status: contact.marketing_status,
      consent_source: contact.consent_source ?? '',
      suppression_reason: contact.suppression_reason ?? '',
    });
    setEditError(null);
    setEditFieldErrors({});
  }

  function closeEdit() {
    if (editSaving) return;
    setEditing(null);
    setEditForm(null);
  }

  async function onEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing || !editForm) return;

    if (editForm.marketing_status === 'subscribed' && !editForm.consent_source) {
      setEditError('Choose a consent source before marking this contact subscribed.');
      setEditFieldErrors({ consent_source: 'A consent source is required to mark a contact subscribed.' });
      return;
    }

    setEditSaving(true);
    setEditError(null);
    setEditFieldErrors({});

    const payload: Record<string, unknown> = {
      email: editForm.email.trim(),
      first_name: editForm.first_name.trim() || null,
      last_name: editForm.last_name.trim() || null,
      audience_type: editForm.audience_type,
      marketing_status: editForm.marketing_status,
      consent_source: editForm.consent_source || null,
      suppression_reason: editForm.marketing_status === 'suppressed' ? editForm.suppression_reason || null : null,
    };

    const res = await api(`/api/admin/marketing-contacts/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setEditSaving(false);
    if (!res.success) {
      setEditError(res.message || 'Could not update marketing contact.');
      setEditFieldErrors(res.errors || {});
      return;
    }
    setEditing(null);
    setEditForm(null);
    setMessage('Marketing contact updated.');
    await load();
  }

  const allowedEditStatuses = editing ? STATUS_OPTIONS_BY_CURRENT[editing.marketing_status] : [...STATUSES];
  const hasActiveFilter = Boolean(searchInput || statusFilter || audienceFilter || sourceFilter);

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Marketing Contacts</h1>
          <p className="page-sub">
            A non-clinical email directory for newsletters and outreach. This is never a patient record —
            clinical details never belong here.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add contact
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      <div className="filter-bar">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search marketing contacts"
          style={{ minWidth: '220px' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as MarketingStatus | '');
            setPage(1);
          }}
          aria-label="Filter by marketing status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={audienceFilter}
          onChange={(e) => {
            setAudienceFilter(e.target.value as AudienceType | '');
            setPage(1);
          }}
          aria-label="Filter by audience"
        >
          <option value="">All audiences</option>
          {AUDIENCE_TYPES.map((a) => (
            <option key={a} value={a}>
              {AUDIENCE_LABELS[a]}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value as Source | '');
            setPage(1);
          }}
          aria-label="Filter by source"
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(Number(e.target.value));
            setPage(1);
          }}
          aria-label="Rows per page"
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        {loading ? (
          <PageLoader />
        ) : items.length === 0 ? (
          <div className="empty">
            <Contact size={22} />
            <p>{hasActiveFilter ? 'No marketing contacts match your search or filters.' : 'No marketing contacts yet.'}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap desktop-only">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Audience</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Consent</th>
                    <th>Created</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>{contactName(row)}</td>
                      <td>{row.email}</td>
                      <td>{AUDIENCE_LABELS[row.audience_type]}</td>
                      <td>
                        <span className={statusBadgeClass(row.marketing_status)}>{STATUS_LABELS[row.marketing_status]}</span>
                      </td>
                      <td>{SOURCE_LABELS[row.source]}</td>
                      <td>{row.consent_source ? SOURCE_LABELS[row.consent_source] : '—'}</td>
                      <td>{new Date(row.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-ghost" onClick={() => setViewing(row)}>
                            View
                          </button>
                          <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards">
              {items.map((row) => (
                <article key={row.id} className="mobile-card">
                  <div className="mobile-card-row">
                    <span>Name</span>
                    <strong>{contactName(row)}</strong>
                  </div>
                  <div className="mobile-card-row">
                    <span>Email</span>
                    <strong>{row.email}</strong>
                  </div>
                  <div className="mobile-card-row">
                    <span>Audience</span>
                    <span>{AUDIENCE_LABELS[row.audience_type]}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span>Status</span>
                    <span className={statusBadgeClass(row.marketing_status)}>{STATUS_LABELS[row.marketing_status]}</span>
                  </div>
                  <div className="mobile-card-row">
                    <span>Source</span>
                    <span>{SOURCE_LABELS[row.source]}</span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="btn btn-ghost" onClick={() => setViewing(row)}>
                      View
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {pagination ? (
        <div className="row-actions" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
          <span className="muted">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} contact
            {pagination.total === 1 ? '' : 's'}
          </span>
          <div className="row-actions">
            <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div className="overlay modal-overlay">
          <form className="card card-pad modal-card" onSubmit={onCreate}>
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Marketing Contacts</p>
                <h2>Add contact</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeCreate} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {createError ? <div className="error-banner">{createError}</div> : null}

            <div className="field">
              <label htmlFor="mc-email">Email</label>
              <input
                id="mc-email"
                type="email"
                required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
              {createFieldErrors.email ? <p className="field-error">{createFieldErrors.email}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-first">First name</label>
              <input id="mc-first" value={createForm.first_name} onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="mc-last">Last name</label>
              <input id="mc-last" value={createForm.last_name} onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="mc-audience">Audience</label>
              <select
                id="mc-audience"
                value={createForm.audience_type}
                onChange={(e) => setCreateForm({ ...createForm, audience_type: e.target.value as AudienceType })}
              >
                {AUDIENCE_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Audience type does not indicate marketing consent.
              </p>
            </div>
            <div className="field">
              <label htmlFor="mc-status">Marketing status</label>
              <select
                id="mc-status"
                value={createForm.marketing_status}
                onChange={(e) => setCreateForm({ ...createForm, marketing_status: e.target.value as MarketingStatus })}
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {createForm.marketing_status === 'subscribed' ? (
                <p className="muted" style={{ marginTop: '0.35rem' }}>
                  Consent source will be recorded as Manual, since this contact is being entered directly in the Admin panel.
                </p>
              ) : null}
              {createFieldErrors.consent_source ? <p className="field-error">{createFieldErrors.consent_source}</p> : null}
              {createFieldErrors.marketing_status ? <p className="field-error">{createFieldErrors.marketing_status}</p> : null}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeCreate} disabled={createSaving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={createSaving}>
                {createSaving ? 'Adding…' : 'Add contact'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing && editForm ? (
        <div className="overlay modal-overlay">
          <form className="card card-pad modal-card" onSubmit={onEdit}>
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Marketing Contacts</p>
                <h2>Edit contact</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeEdit} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {editError ? <div className="error-banner">{editError}</div> : null}

            <div className="field">
              <label htmlFor="mc-edit-email">Email</label>
              <input
                id="mc-edit-email"
                type="email"
                required
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
              {editFieldErrors.email ? <p className="field-error">{editFieldErrors.email}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-edit-first">First name</label>
              <input id="mc-edit-first" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="mc-edit-last">Last name</label>
              <input id="mc-edit-last" value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="mc-edit-audience">Audience</label>
              <select
                id="mc-edit-audience"
                value={editForm.audience_type}
                onChange={(e) => setEditForm({ ...editForm, audience_type: e.target.value as AudienceType })}
              >
                {AUDIENCE_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Audience type does not indicate marketing consent.
              </p>
            </div>
            <div className="field">
              <label htmlFor="mc-edit-status">Marketing status</label>
              <select
                id="mc-edit-status"
                value={editForm.marketing_status}
                onChange={(e) => setEditForm({ ...editForm, marketing_status: e.target.value as MarketingStatus })}
              >
                {allowedEditStatuses.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              {editing.marketing_status === 'unsubscribed' || editing.marketing_status === 'suppressed' ? (
                <p className="muted" style={{ marginTop: '0.35rem' }}>
                  {editing.marketing_status === 'suppressed'
                    ? 'Suppressed contacts cannot be reactivated through this screen.'
                    : 'Unsubscribed contacts cannot be resubscribed through this screen.'}
                </p>
              ) : null}
              {editFieldErrors.marketing_status ? <p className="field-error">{editFieldErrors.marketing_status}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-edit-consent">Consent source</label>
              <select
                id="mc-edit-consent"
                value={editForm.consent_source}
                onChange={(e) => setEditForm({ ...editForm, consent_source: e.target.value as Source | '' })}
              >
                <option value="">No consent on file</option>
                {SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
              {editForm.marketing_status === 'subscribed' ? (
                <p className="muted" style={{ marginTop: '0.35rem' }}>
                  Required to keep this contact subscribed.
                </p>
              ) : null}
              {editFieldErrors.consent_source ? <p className="field-error">{editFieldErrors.consent_source}</p> : null}
            </div>
            {editForm.marketing_status === 'suppressed' ? (
              <div className="field">
                <label htmlFor="mc-edit-suppression">Suppression reason</label>
                <select
                  id="mc-edit-suppression"
                  value={editForm.suppression_reason}
                  onChange={(e) => setEditForm({ ...editForm, suppression_reason: e.target.value as SuppressionReason | '' })}
                >
                  <option value="">Not specified</option>
                  {SUPPRESSION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {SUPPRESSION_REASON_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={editSaving}>
                {editSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {viewing ? (
        <div className="overlay modal-overlay">
          <div className="card card-pad modal-card">
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Marketing Contacts</p>
                <h2>{contactName(viewing)}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setViewing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="detail-grid">
              <p>
                <span>Email</span>
                <strong>{viewing.email}</strong>
              </p>
              <p>
                <span>Audience</span>
                <strong>{AUDIENCE_LABELS[viewing.audience_type]}</strong>
              </p>
              <p>
                <span>Status</span>
                <strong>{STATUS_LABELS[viewing.marketing_status]}</strong>
              </p>
              <p>
                <span>Source</span>
                <strong>{SOURCE_LABELS[viewing.source]}</strong>
              </p>
              <p>
                <span>Consent source</span>
                <strong>{viewing.consent_source ? SOURCE_LABELS[viewing.consent_source] : '—'}</strong>
              </p>
              <p>
                <span>Consent at</span>
                <strong>{viewing.consent_at ? new Date(viewing.consent_at).toLocaleString() : '—'}</strong>
              </p>
              <p>
                <span>Unsubscribed at</span>
                <strong>{viewing.unsubscribed_at ? new Date(viewing.unsubscribed_at).toLocaleString() : '—'}</strong>
              </p>
              <p>
                <span>Suppressed at</span>
                <strong>{viewing.suppressed_at ? new Date(viewing.suppressed_at).toLocaleString() : '—'}</strong>
              </p>
              <p>
                <span>Suppression reason</span>
                <strong>{viewing.suppression_reason ? SUPPRESSION_REASON_LABELS[viewing.suppression_reason] : '—'}</strong>
              </p>
              <p>
                <span>Created</span>
                <strong>{new Date(viewing.created_at).toLocaleString()}</strong>
              </p>
              <p>
                <span>Updated</span>
                <strong>{new Date(viewing.updated_at).toLocaleString()}</strong>
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
