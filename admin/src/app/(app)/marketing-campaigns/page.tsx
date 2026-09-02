'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Plus, Rocket, X } from 'lucide-react';
import { api } from '@/lib/api';
import { PageLoader } from '@/components/PageLoader';

// No shared code exists between admin/ and server/ (separate deployments),
// so these mirror server/src/validation/adminSchemas.ts's marketing
// campaign constants by value.
const CAMPAIGN_STATUSES = ['draft', 'archived'] as const;
const AUDIENCE_TYPES = ['existing_patient', 'prospective_patient', 'subscriber', 'other'] as const;
/** Sentinel for "audience_type IS NULL" (All Subscribed Contacts) in the audience filter/select — matches the Server's NULL_AUDIENCE_SENTINEL. */
const NULL_AUDIENCE_SENTINEL = 'null';

type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
type AudienceType = (typeof AUDIENCE_TYPES)[number];

type Campaign = {
  id: string;
  name: string;
  subject: string;
  preview_text: string | null;
  content: string;
  status: CampaignStatus;
  audience_type: AudienceType | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  delivery_locked?: boolean;
  pending?: number;
  processing?: number;
  sent?: number;
  failed?: number;
  skipped?: number;
  ambiguous_timeout?: number;
};

type Pagination = { page: number; pageSize: number; total: number; totalPages: number };
type ListData = { items: Campaign[]; pagination: Pagination };
type RecipientPreviewData = { eligible_count: number; audience_type: AudienceType | null };
type SendResult = { requested: number; snapshotted: number; sent: number; failed: number; skipped: number };

const STATUS_LABELS: Record<CampaignStatus, string> = { draft: 'Draft', archived: 'Archived' };
const AUDIENCE_LABELS: Record<AudienceType, string> = {
  existing_patient: 'Existing Patient',
  prospective_patient: 'Prospective Patient',
  subscriber: 'Subscriber',
  other: 'Other',
};

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 400;

function statusBadgeClass(status: CampaignStatus | 'delivery-initiated'): string {
  return status === 'draft' || status === 'delivery-initiated' ? 'badge warn' : 'badge';
}

function audienceLabel(audience: AudienceType | null): string {
  return audience ? AUDIENCE_LABELS[audience] : 'All Subscribed Contacts';
}

function campaignStatusLabel(row: Campaign): string {
  return row.delivery_locked ? 'Delivery initiated' : STATUS_LABELS[row.status];
}

const emptyCampaignForm = {
  name: '',
  subject: '',
  preview_text: '',
  content: '',
  audience_type: '' as AudienceType | '',
};
type CampaignForm = typeof emptyCampaignForm;

export default function MarketingCampaignsPage() {
  const [items, setItems] = useState<Campaign[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');
  const [audienceFilter, setAudienceFilter] = useState<AudienceType | typeof NULL_AUDIENCE_SENTINEL | ''>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CampaignForm>(emptyCampaignForm);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createFieldErrors, setCreateFieldErrors] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState<Campaign | null>(null);
  const [editForm, setEditForm] = useState<CampaignForm | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<Record<string, string>>({});

  const [viewing, setViewing] = useState<Campaign | null>(null);

  const [previewing, setPreviewing] = useState<Campaign | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewEligible, setPreviewEligible] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [sending, setSending] = useState<Campaign | null>(null);
  const [sendEligible, setSendEligible] = useState<number | null>(null);
  const [sendEligibleLoading, setSendEligibleLoading] = useState(false);
  const [sendChecked, setSendChecked] = useState(false);
  const [sendSubmitting, setSendSubmitting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  async function load() {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    if (audienceFilter) params.set('audience_type', audienceFilter);

    setLoading(true);
    const res = await api<ListData>(`/api/admin/marketing-campaigns?${params.toString()}`);
    setLoading(false);
    if (!res.success) {
      setError(res.message || 'Failed to load marketing campaigns.');
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
  }, [page, pageSize, debouncedSearch, statusFilter, audienceFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    document.body.style.overflow = createOpen || editing || viewing || previewing || sending ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [createOpen, editing, viewing, previewing, sending]);

  function openCreate() {
    setCreateForm(emptyCampaignForm);
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

    const payload: Record<string, unknown> = {
      name: createForm.name.trim(),
      subject: createForm.subject.trim(),
      preview_text: createForm.preview_text.trim() || null,
      content: createForm.content,
      audience_type: createForm.audience_type || null,
    };

    const res = await api('/api/admin/marketing-campaigns', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setCreateSaving(false);
    if (!res.success) {
      setCreateError(res.message || 'Could not create this campaign draft.');
      setCreateFieldErrors(res.errors || {});
      return;
    }
    setCreateOpen(false);
    setMessage('Campaign draft created.');
    setPage(1);
    await load();
  }

  function openEdit(campaign: Campaign) {
    setEditing(campaign);
    setEditForm({
      name: campaign.name,
      subject: campaign.subject,
      preview_text: campaign.preview_text ?? '',
      content: campaign.content,
      audience_type: campaign.audience_type ?? '',
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
    setEditSaving(true);
    setEditError(null);
    setEditFieldErrors({});

    const payload: Record<string, unknown> = {
      name: editForm.name.trim(),
      subject: editForm.subject.trim(),
      preview_text: editForm.preview_text.trim() || null,
      content: editForm.content,
      audience_type: editForm.audience_type || null,
    };

    const res = await api(`/api/admin/marketing-campaigns/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    setEditSaving(false);
    if (!res.success) {
      setEditError(res.message || 'Could not update this campaign draft.');
      setEditFieldErrors(res.errors || {});
      return;
    }
    setEditing(null);
    setEditForm(null);
    setMessage('Campaign draft updated.');
    await load();
  }

  async function onArchive(campaign: Campaign) {
    if (
      !confirm(
        `Archive "${campaign.name}"? Archived campaigns cannot be edited, and cannot be restored in this version of the Admin panel.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await api(`/api/admin/marketing-campaigns/${campaign.id}/archive`, { method: 'POST' });
    if (!res.success) {
      setError(res.message || 'Could not archive this campaign.');
      return;
    }
    setMessage('Campaign archived.');
    await load();
  }

  function openPreview(campaign: Campaign) {
    setPreviewing(campaign);
    setPreviewError(null);
    setPreviewEligible(null);
    setPreviewLoading(true);
    void api<RecipientPreviewData>(`/api/admin/marketing-campaigns/${campaign.id}/recipient-preview`).then((res) => {
      setPreviewLoading(false);
      if (!res.success) {
        setPreviewError(res.message || 'Could not load the current eligible contact count.');
        return;
      }
      setPreviewEligible(res.data?.eligible_count ?? null);
    });
  }

  function closePreview() {
    setPreviewing(null);
  }

  function openSend(campaign: Campaign) {
    setSending(campaign);
    setSendChecked(false);
    setSendError(null);
    setSendResult(null);
    setSendEligible(null);
    setSendEligibleLoading(true);
    void api<RecipientPreviewData>(`/api/admin/marketing-campaigns/${campaign.id}/recipient-preview`).then((res) => {
      setSendEligibleLoading(false);
      if (!res.success) {
        setSendError(res.message || 'Could not load the current eligible contact count.');
        return;
      }
      setSendEligible(res.data?.eligible_count ?? null);
    });
  }

  function closeSend() {
    if (sendSubmitting) return;
    setSending(null);
  }

  async function onConfirmSend() {
    if (!sending || !sendChecked) return;
    setSendSubmitting(true);
    setSendError(null);
    // Dedicated endpoint only — never generic PATCH, and no campaign
    // content in the request: the server uses the already-persisted
    // campaign row exclusively.
    const res = await api<SendResult>(`/api/admin/marketing-campaigns/${sending.id}/send`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    });
    setSendSubmitting(false);
    if (!res.success) {
      setSendError(res.message || 'Could not send this campaign.');
      return;
    }
    setSendResult(res.data ?? null);
    await load();
  }

  const hasActiveFilter = Boolean(searchInput || statusFilter || audienceFilter);

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-sub">
            Draft marketing campaign content and audience criteria. This is a draft builder only — no email is sent
            from this page.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add campaign draft
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      <div className="filter-bar">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or subject"
          aria-label="Search campaigns"
          style={{ minWidth: '220px' }}
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CampaignStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {CAMPAIGN_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={audienceFilter}
          onChange={(e) => {
            setAudienceFilter(e.target.value as AudienceType | typeof NULL_AUDIENCE_SENTINEL | '');
            setPage(1);
          }}
          aria-label="Filter by audience"
        >
          <option value="">All audiences</option>
          <option value={NULL_AUDIENCE_SENTINEL}>All Subscribed Contacts</option>
          {AUDIENCE_TYPES.map((a) => (
            <option key={a} value={a}>
              {AUDIENCE_LABELS[a]}
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
            <Rocket size={22} />
            <p>{hasActiveFilter ? 'No campaigns match your search or filters.' : 'No campaign drafts yet.'}</p>
          </div>
        ) : (
          <>
            <div className="table-wrap desktop-only">
              <table className="data">
                <thead>
                  <tr>
                    <th>Campaign Name</th>
                    <th>Subject</th>
                    <th>Audience</th>
                    <th>Status</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => {
                    const locked = !!row.delivery_locked;
                    const canEdit = row.status === 'draft' && !locked;
                    const canArchive = row.status === 'draft' && !locked;
                    const canSend = row.status === 'draft' && !locked;
                    return (
                      <tr key={row.id}>
                        <td>{row.name}</td>
                        <td>{row.subject}</td>
                        <td>{audienceLabel(row.audience_type)}</td>
                        <td>
                          <span className={statusBadgeClass(locked ? 'delivery-initiated' : row.status)}>
                            {campaignStatusLabel(row)}
                          </span>
                        </td>
                        <td>{new Date(row.updated_at).toLocaleDateString()}</td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn btn-ghost" onClick={() => setViewing(row)}>
                              View
                            </button>
                            {canEdit ? (
                              <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
                                Edit
                              </button>
                            ) : null}
                            <button type="button" className="btn btn-ghost" onClick={() => openPreview(row)}>
                              Preview
                            </button>
                            {canArchive ? (
                              <button type="button" className="btn btn-ghost" onClick={() => onArchive(row)}>
                                Archive
                              </button>
                            ) : null}
                            {canSend ? (
                              <button type="button" className="btn btn-primary" onClick={() => openSend(row)}>
                                Send
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards">
              {items.map((row) => {
                const locked = !!row.delivery_locked;
                const canEdit = row.status === 'draft' && !locked;
                const canArchive = row.status === 'draft' && !locked;
                const canSend = row.status === 'draft' && !locked;
                return (
                  <article key={row.id} className="mobile-card">
                    <div className="mobile-card-row">
                      <span>Name</span>
                      <strong>{row.name}</strong>
                    </div>
                    <div className="mobile-card-row">
                      <span>Subject</span>
                      <strong>{row.subject}</strong>
                    </div>
                    <div className="mobile-card-row">
                      <span>Audience</span>
                      <span>{audienceLabel(row.audience_type)}</span>
                    </div>
                    <div className="mobile-card-row">
                      <span>Status</span>
                      <span className={statusBadgeClass(locked ? 'delivery-initiated' : row.status)}>
                        {campaignStatusLabel(row)}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button type="button" className="btn btn-ghost" onClick={() => setViewing(row)}>
                        View
                      </button>
                      {canEdit ? (
                        <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                      ) : null}
                      <button type="button" className="btn btn-ghost" onClick={() => openPreview(row)}>
                        Preview
                      </button>
                      {canArchive ? (
                        <button type="button" className="btn btn-ghost" onClick={() => onArchive(row)}>
                          Archive
                        </button>
                      ) : null}
                      {canSend ? (
                        <button type="button" className="btn btn-primary" onClick={() => openSend(row)}>
                          Send
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>

      {pagination ? (
        <div className="row-actions" style={{ justifyContent: 'space-between', marginTop: '0.75rem' }}>
          <span className="muted">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} campaign
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
                <p className="modal-kicker">Campaigns</p>
                <h2>Add campaign draft</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeCreate} aria-label="Close" disabled={createSaving}>
                <X size={18} />
              </button>
            </div>
            {createError ? <div className="error-banner">{createError}</div> : null}

            <div className="field">
              <label htmlFor="mc-name">Campaign name</label>
              <input
                id="mc-name"
                required
                maxLength={200}
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
              {createFieldErrors.name ? <p className="field-error">{createFieldErrors.name}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-subject">Subject</label>
              <input
                id="mc-subject"
                required
                maxLength={200}
                value={createForm.subject}
                onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}
              />
              {createFieldErrors.subject ? <p className="field-error">{createFieldErrors.subject}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-preview">Preview text</label>
              <input
                id="mc-preview"
                maxLength={500}
                value={createForm.preview_text}
                onChange={(e) => setCreateForm({ ...createForm, preview_text: e.target.value })}
              />
              {createFieldErrors.preview_text ? <p className="field-error">{createFieldErrors.preview_text}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-audience">Audience</label>
              <select
                id="mc-audience"
                value={createForm.audience_type}
                onChange={(e) => setCreateForm({ ...createForm, audience_type: e.target.value as AudienceType | '' })}
              >
                <option value="">All Subscribed Contacts</option>
                {AUDIENCE_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Audience classification does not establish marketing consent. Only contacts currently marked
                Subscribed are counted as eligible.
              </p>
            </div>
            <div className="field">
              <label htmlFor="mc-content">Content</label>
              <textarea
                id="mc-content"
                required
                rows={10}
                value={createForm.content}
                onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
              />
              {createFieldErrors.content ? <p className="field-error">{createFieldErrors.content}</p> : null}
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Plain text only.
              </p>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeCreate} disabled={createSaving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={createSaving}>
                {createSaving ? 'Saving…' : 'Save draft'}
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
                <p className="modal-kicker">Campaigns</p>
                <h2>Edit campaign draft</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeEdit} aria-label="Close" disabled={editSaving}>
                <X size={18} />
              </button>
            </div>
            {editError ? <div className="error-banner">{editError}</div> : null}

            <div className="field">
              <label htmlFor="mc-edit-name">Campaign name</label>
              <input
                id="mc-edit-name"
                required
                maxLength={200}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
              {editFieldErrors.name ? <p className="field-error">{editFieldErrors.name}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-edit-subject">Subject</label>
              <input
                id="mc-edit-subject"
                required
                maxLength={200}
                value={editForm.subject}
                onChange={(e) => setEditForm({ ...editForm, subject: e.target.value })}
              />
              {editFieldErrors.subject ? <p className="field-error">{editFieldErrors.subject}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-edit-preview">Preview text</label>
              <input
                id="mc-edit-preview"
                maxLength={500}
                value={editForm.preview_text}
                onChange={(e) => setEditForm({ ...editForm, preview_text: e.target.value })}
              />
              {editFieldErrors.preview_text ? <p className="field-error">{editFieldErrors.preview_text}</p> : null}
            </div>
            <div className="field">
              <label htmlFor="mc-edit-audience">Audience</label>
              <select
                id="mc-edit-audience"
                value={editForm.audience_type}
                onChange={(e) => setEditForm({ ...editForm, audience_type: e.target.value as AudienceType | '' })}
              >
                <option value="">All Subscribed Contacts</option>
                {AUDIENCE_TYPES.map((a) => (
                  <option key={a} value={a}>
                    {AUDIENCE_LABELS[a]}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Audience classification does not establish marketing consent. Only contacts currently marked
                Subscribed are counted as eligible.
              </p>
            </div>
            <div className="field">
              <label htmlFor="mc-edit-content">Content</label>
              <textarea
                id="mc-edit-content"
                required
                rows={10}
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              />
              {editFieldErrors.content ? <p className="field-error">{editFieldErrors.content}</p> : null}
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                Plain text only.
              </p>
            </div>

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
                <p className="modal-kicker">Campaigns</p>
                <h2>{viewing.name}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={() => setViewing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="detail-grid">
              <p>
                <span>Subject</span>
                <strong>{viewing.subject}</strong>
              </p>
              <p>
                <span>Preview text</span>
                <strong>{viewing.preview_text || '—'}</strong>
              </p>
              <p>
                <span>Audience</span>
                <strong>{audienceLabel(viewing.audience_type)}</strong>
              </p>
              <p>
                <span>Status</span>
                <strong>{campaignStatusLabel(viewing)}</strong>
              </p>
              <p>
                <span>Created</span>
                <strong>{new Date(viewing.created_at).toLocaleString()}</strong>
              </p>
              <p>
                <span>Updated</span>
                <strong>{new Date(viewing.updated_at).toLocaleString()}</strong>
              </p>
              {viewing.archived_at ? (
                <p>
                  <span>Archived</span>
                  <strong>{new Date(viewing.archived_at).toLocaleString()}</strong>
                </p>
              ) : null}
            </div>
            {viewing.delivery_locked ? (
              <>
                <p className="muted" style={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                  Delivery diagnostics (aggregate counts only — no recipient details are shown here).
                </p>
                <div className="detail-grid">
                  <p>
                    <span>Pending</span>
                    <strong>{viewing.pending ?? 0}</strong>
                  </p>
                  <p>
                    <span>Processing</span>
                    <strong>{viewing.processing ? `${viewing.processing} (Review needed)` : 0}</strong>
                  </p>
                  <p>
                    <span>Accepted by provider</span>
                    <strong>{viewing.sent ?? 0}</strong>
                  </p>
                  <p>
                    <span>Failed</span>
                    <strong>{viewing.failed ?? 0}</strong>
                  </p>
                  <p>
                    <span>Skipped</span>
                    <strong>{viewing.skipped ?? 0}</strong>
                  </p>
                  <p>
                    <span>Ambiguous timeout</span>
                    <strong>
                      {viewing.ambiguous_timeout ? `${viewing.ambiguous_timeout} (Review needed)` : 0}
                    </strong>
                  </p>
                </div>
              </>
            ) : null}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setViewing(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewing ? (
        <div className="overlay modal-overlay">
          <div className="card card-pad modal-card">
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Campaign Preview</p>
                <h2>{previewing.name}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closePreview} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="muted" style={{ marginTop: 0 }}>
              This is a plain-text approximation and does not represent exactly how this will appear in a
              recipient&rsquo;s email client.
            </p>
            {previewError ? <div className="error-banner">{previewError}</div> : null}

            <div className="detail-grid" style={{ marginBottom: '1rem' }}>
              <p>
                <span>Subject</span>
                <strong>{previewing.subject}</strong>
              </p>
              <p>
                <span>Preview text</span>
                <strong>{previewing.preview_text || '—'}</strong>
              </p>
              <p>
                <span>Current eligible contacts</span>
                <strong>{previewLoading ? 'Loading…' : previewEligible !== null ? previewEligible : '—'}</strong>
              </p>
            </div>

            <div className="card card-pad" style={{ whiteSpace: 'pre-wrap' }}>
              {previewing.content}
            </div>

            <p className="muted" style={{ marginTop: '1rem' }}>
              An unsubscribe option will be included when this campaign is delivered.
            </p>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closePreview}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sending ? (
        <div className="overlay modal-overlay">
          <div className="card card-pad modal-card">
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Marketing Campaigns</p>
                <h2>Send {sending.name}</h2>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={closeSend}
                aria-label="Close"
                disabled={sendSubmitting}
              >
                <X size={18} />
              </button>
            </div>
            {sendError ? <div className="error-banner">{sendError}</div> : null}

            {!sendResult ? (
              <>
                <div className="detail-grid" style={{ marginBottom: '1rem' }}>
                  <p>
                    <span>Campaign name</span>
                    <strong>{sending.name}</strong>
                  </p>
                  <p>
                    <span>Subject</span>
                    <strong>{sending.subject}</strong>
                  </p>
                  <p>
                    <span>Audience</span>
                    <strong>{audienceLabel(sending.audience_type)}</strong>
                  </p>
                  <p>
                    <span>Current eligible contacts</span>
                    <strong>{sendEligibleLoading ? 'Loading…' : sendEligible !== null ? sendEligible : '—'}</strong>
                  </p>
                </div>

                {!sendEligibleLoading && sendEligible === 0 ? (
                  <div className="error-banner" style={{ marginBottom: '1rem' }}>
                    No eligible subscribed recipients right now. This audience currently has 0 contacts with
                    marketing status &ldquo;Subscribed&rdquo;{sending.audience_type ? ' matching this audience' : ''}.
                    Sending will complete with 0 emails sent.
                  </div>
                ) : null}

                <p className="muted" style={{ marginTop: 0 }}>
                  Content preview:
                </p>
                <div className="card card-pad" style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                  {sending.content}
                </div>

                <ul className="muted" style={{ paddingLeft: '1.1rem', margin: '0 0 1rem' }}>
                  <li>Unsubscribed and suppressed contacts will not receive this campaign.</li>
                  <li>Eligibility is checked again for each contact at the moment of sending.</li>
                  <li>Paubox account limits and billing may apply.</li>
                </ul>

                <label className="access-tile" style={{ marginBottom: '1rem' }}>
                  <input type="checkbox" checked={sendChecked} onChange={(e) => setSendChecked(e.target.checked)} />
                  <span>
                    I confirm this campaign is ready to send to currently subscribed marketing contacts.
                  </span>
                </label>

                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={closeSend} disabled={sendSubmitting}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={onConfirmSend}
                    disabled={!sendChecked || sendSubmitting || sendEligibleLoading}
                  >
                    {sendSubmitting ? 'Sending…' : 'Send'}
                  </button>
                </div>
              </>
            ) : (
              <>
                {sendResult.requested === 0 ? (
                  <div className="error-banner" style={{ marginBottom: '1rem' }}>
                    No eligible recipients were found at send time — 0 emails were sent. No recipient records
                    were created and this campaign remains a draft (not locked), so it can be edited or sent
                    again once there are eligible subscribed contacts.
                  </div>
                ) : null}
                <div className="detail-grid" style={{ marginBottom: '1rem' }}>
                  <p>
                    <span>Requested</span>
                    <strong>{sendResult.requested}</strong>
                  </p>
                  <p>
                    <span>Snapshotted</span>
                    <strong>{sendResult.snapshotted}</strong>
                  </p>
                  <p>
                    <span>Accepted by email provider</span>
                    <strong>{sendResult.sent}</strong>
                  </p>
                  <p>
                    <span>Failed</span>
                    <strong>{sendResult.failed}</strong>
                  </p>
                  <p>
                    <span>Skipped (no longer subscribed)</span>
                    <strong>{sendResult.skipped}</strong>
                  </p>
                </div>
                <p className="muted">
                  &ldquo;Accepted&rdquo; means the email provider accepted the message for processing — it does not
                  confirm the message reached the recipient&rsquo;s inbox.
                </p>
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={closeSend}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
