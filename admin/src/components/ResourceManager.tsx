'use client';

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Eye, Pencil, Plus, Trash2, X } from 'lucide-react';
import { api } from '@/lib/api';
import { PageLoader } from '@/components/PageLoader';
import { PreviewShell } from '@/components/PreviewShell';

type Field = {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'number' | 'checkbox' | 'select' | 'url' | 'json';
  options?: { value: string; label: string }[];
  full?: boolean;
  /**
   * Phase 11: optional helper text shown below the input, driven by the
   * field's own current value — e.g. "Appears in the Fees & Insurance FAQ
   * section." for a category picker. Returns null/empty to show nothing.
   * Purely presentational, never affects validation/save.
   */
  hint?: (value: unknown, form: Record<string, unknown>) => string | null;
};

type PreviewConfig = {
  render: (form: Record<string, unknown>, rows: Record<string, unknown>[]) => ReactNode;
  liveHref?: (row: Record<string, unknown>) => string | null;
  hint?: string;
};

/** Phase 11: an optional client-side filter control above the list — narrows the visible rows only, never mutates data or the underlying fetch. */
type FilterConfig = {
  key: string;
  label: string;
  options: { value: string; label: string }[];
  allLabel?: string;
};

/**
 * Phase 11: when editing an existing row and this field's value actually
 * changes, ask for confirmation before saving — e.g. moving a FAQ between
 * categories, which can silently move it to a different public page. Never
 * triggered on create, and never triggered when the field didn't change.
 */
type ConfirmFieldChangeConfig = {
  key: string;
  message: (from: string, to: string) => string;
};

type Props = {
  title: string;
  subtitle: string;
  endpoint: string;
  columns: { key: string; label: string; render?: (row: Record<string, unknown>) => ReactNode }[];
  fields: Field[];
  createDefaults?: Record<string, unknown>;
  preview?: PreviewConfig;
  itemLabel?: (row: Record<string, unknown>) => string;
  filters?: FilterConfig[];
  confirmFieldChange?: ConfirmFieldChangeConfig;
};

/** Phase 12: structural equality for a single field's coerced form value vs. the row's stored value (JSON/array fields compare by content, not reference). */
function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a != null && b != null && typeof a === 'object' && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/** Phase 12: keeps only the keys in `body` whose value actually differs from `original` — used so a PATCH never resends (and can't clobber) a field the current edit session didn't touch. */
function diffAgainst(body: Record<string, unknown>, original: Record<string, unknown> | null): Record<string, unknown> {
  if (!original) return body;
  return Object.fromEntries(Object.entries(body).filter(([key, value]) => !valuesEqual(value, original[key])));
}

export function ResourceManager({
  title,
  subtitle,
  endpoint,
  columns,
  fields,
  createDefaults = {},
  preview,
  itemLabel,
  filters,
  confirmFieldChange,
}: Props) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(createDefaults);
  const [saving, setSaving] = useState(false);
  const [previewRow, setPreviewRow] = useState<Record<string, unknown> | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    const res = await api<Record<string, unknown>[]>(endpoint);
    if (!res.success) setError(res.message || 'Failed to load');
    else {
      setError(null);
      setRows(res.data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [endpoint]);

  useEffect(() => {
    document.body.style.overflow = editing || previewRow ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [editing, previewRow]);

  const isEdit = Boolean(editing?.id);

  // Phase 11: client-side only — narrows which rows render, never mutates
  // data, never re-fetches, never touches sort_order. Each filter with a
  // non-empty selected value must match; empty ("All ...") never excludes.
  const visibleRows = useMemo(() => {
    if (!filters || !filters.length) return rows;
    return rows.filter((row) =>
      filters.every((f) => {
        const selected = filterValues[f.key];
        if (!selected) return true;
        return String(row[f.key] ?? '') === selected;
      })
    );
  }, [rows, filters, filterValues]);

  function labelOf(row: Record<string, unknown>) {
    if (itemLabel) return itemLabel(row);
    return String(row.title || row.question || row.name || row.path || 'this item');
  }

  function openCreate() {
    setEditing({});
    const next = { ...createDefaults };
    for (const field of fields) {
      if (field.type === 'json' && next[field.key] != null && typeof next[field.key] !== 'string') {
        next[field.key] = JSON.stringify(next[field.key], null, 2);
      }
    }
    setForm(next);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditing(row);
    const next = { ...row };
    if ((next.image_url == null || next.image_url === '') && typeof next.icon === 'string' && next.icon) {
      next.image_url = next.icon;
    }
    for (const field of fields) {
      if (field.type === 'json' && next[field.key] != null && typeof next[field.key] !== 'string') {
        next[field.key] = JSON.stringify(next[field.key], null, 2);
      }
    }
    setForm(next);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);

    const body: Record<string, unknown> = {};
    for (const field of fields) {
      let value = form[field.key];
      if (field.type === 'checkbox') value = Boolean(value);
      if (field.type === 'number') value = value === '' || value == null ? null : Number(value);
      if (field.type === 'json') {
        try {
          if (typeof value === 'string') {
            value = value.trim() ? JSON.parse(value) : {};
          } else if (value == null) {
            value = {};
          }
        } catch {
          setSaving(false);
          setError(`Invalid JSON in ${field.label}`);
          return;
        }
      }
      body[field.key] = value;
    }

    if (fields.some((field) => field.key === 'image_url') && body.image_url) {
      body.icon = body.image_url;
    }

    // Phase 11: only asks when editing an EXISTING row AND the configured
    // field's value actually changed — never on create, never on an
    // unrelated field, never when the value is unchanged.
    if (isEdit && confirmFieldChange) {
      const from = String(editing?.[confirmFieldChange.key] ?? '');
      const to = String(body[confirmFieldChange.key] ?? '');
      if (from !== to && !window.confirm(confirmFieldChange.message(from, to))) {
        setSaving(false);
        return;
      }
    }

    // Phase 12: a PATCH only sends fields that actually changed from the
    // row as it was when the edit modal opened — every field used to be
    // resent unconditionally (every configured field, every save), which
    // meant an edit that only touched one field could silently overwrite
    // any other field (e.g. `published`) with a stale value if something
    // else changed that field in the DB between opening the modal and
    // saving. create (POST) is unaffected — it still sends every field.
    const payloadForRequest = isEdit ? diffAgainst(body, editing) : body;

    const res = isEdit
      ? await api(`${endpoint}/${editing?.id}`, { method: 'PATCH', body: JSON.stringify(payloadForRequest) })
      : await api(endpoint, { method: 'POST', body: JSON.stringify(payloadForRequest) });

    setSaving(false);
    if (!res.success) {
      setError(res.message || 'Save failed');
      return;
    }
    setEditing(null);
    setMessage('Saved to the live website. Refresh the public site to see this change.');
    await load();
  }

  async function onDelete(row: Record<string, unknown>) {
    const name = labelOf(row);
    if (!confirm(`Delete “${name}”? Visitors will no longer see it on the website after this.`)) return;
    const res = await api(`${endpoint}/${row.id}`, { method: 'DELETE' });
    if (!res.success) setError(res.message || 'Delete failed');
    else await load();
  }

  const empty = useMemo(() => !loading && rows.length === 0, [loading, rows]);
  const emptyFiltered = useMemo(
    () => !loading && rows.length > 0 && visibleRows.length === 0,
    [loading, rows, visibleRows]
  );

  function ActionButtons({ row }: { row: Record<string, unknown> }) {
    return (
      <div className="row-actions">
        {preview ? (
          <button type="button" className="btn btn-ghost" onClick={() => setPreviewRow(row)}>
            <Eye size={15} />
            Preview
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={() => openEdit(row)}>
          <Pencil size={15} />
          Edit
        </button>
        <button type="button" className="btn btn-danger" onClick={() => onDelete(row)}>
          <Trash2 size={15} />
          Delete
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-sub">{subtitle}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          <Plus size={16} />
          Add new
        </button>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      {filters && filters.length ? (
        <div className="filter-bar">
          {filters.map((f) => (
            <select
              key={f.key}
              value={filterValues[f.key] ?? ''}
              onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              aria-label={f.label}
            >
              <option value="">{f.allLabel || `All ${f.label}`}</option>
              {f.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ))}
        </div>
      ) : null}

      <div className="card">
        {loading ? (
          <PageLoader />
        ) : (
          <>
            <div className="table-wrap desktop-only">
              {empty ? (
                <div className="empty">No items yet. Add the first one.</div>
              ) : emptyFiltered ? (
                <div className="empty">No items match this filter.</div>
              ) : (
                <table className="data">
                  <thead>
                    <tr>
                      {columns.map((c) => (
                        <th key={c.key}>{c.label}</th>
                      ))}
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={String(row.id)}>
                        {columns.map((c) => (
                          <td key={c.key}>{c.render ? c.render(row) : String(row[c.key] ?? '—')}</td>
                        ))}
                        <td>
                          <ActionButtons row={row} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="mobile-cards">
              {empty ? (
                <div className="empty">No items yet. Add the first one.</div>
              ) : emptyFiltered ? (
                <div className="empty">No items match this filter.</div>
              ) : (
                visibleRows.map((row) => (
                  <article key={String(row.id)} className="mobile-card">
                    {columns.slice(0, 4).map((c) => (
                      <div key={c.key} className="mobile-card-row">
                        <span>{c.label}</span>
                        <strong>{c.render ? c.render(row) : String(row[c.key] ?? '—')}</strong>
                      </div>
                    ))}
                    <ActionButtons row={row} />
                  </article>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {editing ? (
        <div className="overlay modal-overlay">
          <form className={`card card-pad modal-card ${preview ? 'modal-card-split' : ''}`} onSubmit={onSubmit}>
            <div className="modal-head">
              <h2>{isEdit ? `Edit ${labelOf(form)}` : 'Create item'}</h2>
              <button type="button" className="icon-btn" onClick={() => setEditing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className={preview ? 'split-edit' : undefined}>
              <div className="form-grid two">
                {fields.map((field) => (
                  <div className="field" key={field.key} style={field.full ? { gridColumn: '1 / -1' } : undefined}>
                    <label htmlFor={field.key}>{field.label}</label>
                    {field.type === 'textarea' || field.type === 'json' ? (
                      <textarea
                        id={field.key}
                        value={String(form[field.key] ?? (field.type === 'json' ? '{}' : ''))}
                        onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      />
                    ) : field.type === 'checkbox' ? (
                      <label className="check-label">
                        <input
                          id={field.key}
                          type="checkbox"
                          checked={Boolean(form[field.key])}
                          onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.checked }))}
                        />
                        Enabled
                      </label>
                    ) : field.type === 'select' ? (
                      <select
                        id={field.key}
                        value={String(form[field.key] ?? '')}
                        onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      >
                        {(field.options || []).map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={field.key}
                        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
                        value={String(form[field.key] ?? '')}
                        onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      />
                    )}
                    {field.hint ? (
                      (() => {
                        const hintText = field.hint(form[field.key], form);
                        return hintText ? <p className="field-hint">{hintText}</p> : null;
                      })()
                    ) : null}
                  </div>
                ))}
              </div>
              {preview ? (
                <aside className="live-preview-pane">
                  <p className="preview-kicker">Live preview</p>
                  <p className="preview-hint">{preview.hint || 'Updates as you type. Visitors see this only after Save.'}</p>
                  {preview.render(form, rows)}
                </aside>
              ) : null}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save to website'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {preview && previewRow ? (
        <PreviewShell
          title={labelOf(previewRow)}
          hint={preview.hint}
          livePath={preview.liveHref?.(previewRow)}
          onClose={() => setPreviewRow(null)}
        >
          {preview.render(previewRow, rows)}
        </PreviewShell>
      ) : null}
    </div>
  );
}
