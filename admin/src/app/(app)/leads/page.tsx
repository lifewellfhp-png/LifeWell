'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Inbox, Send, X } from 'lucide-react';
import { api } from '@/lib/api';

type Lead = {
  id: string;
  type: string;
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  message?: string;
  status: string;
  reference_id?: string;
  created_at: string;
};

type BookingRow = { booking_url?: string; label?: string; active?: boolean };

export default function LeadsPage() {
  const [rows, setRows] = useState<Lead[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [bookingUrl, setBookingUrl] = useState('/book-telehealth-mental-health-appointment');

  async function load(nextStatus = status, nextType = type) {
    const params = new URLSearchParams();
    if (nextStatus) params.set('status', nextStatus);
    if (nextType) params.set('type', nextType);
    const query = params.toString() ? `?${params}` : '';
    const res = await api<Lead[]>(`/api/admin/leads${query}`);
    if (!res.success) setError(res.message || 'Failed to load leads');
    else {
      setError(null);
      setRows(res.data || []);
    }
  }

  useEffect(() => {
    void load();
    void api<BookingRow[]>('/api/admin/booking').then((res) => {
      const active = (res.data || []).find((row) => row.active !== false && row.booking_url);
      if (active?.booking_url) setBookingUrl(active.booking_url);
    });
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected || compose ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [selected, compose]);

  const recipients = useMemo(
    () => rows.filter((row) => checked.includes(row.id) && row.email),
    [rows, checked]
  );

  function toggle(id: string) {
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function setLeadStatus(id: string, next: string) {
    const res = await api(`/api/admin/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: next }),
    });
    if (!res.success) setError(res.message || 'Update failed');
    else {
      await load();
      if (selected?.id === id) setSelected({ ...selected, status: next });
    }
  }

  function openCompose(kind: 'custom' | 'booking', lead?: Lead) {
    const ids = lead ? [lead.id] : checked;
    if (lead) setChecked(ids);
    const people = rows.filter((row) => ids.includes(row.id) && row.email);
    if (!people.length) {
      setError('Select at least one lead with an email address.');
      return;
    }
    setError(null);
    if (kind === 'booking') {
      setSubject('Your LifeWell appointment booking link');
      setBody(
        `Hello,\n\nThank you for reaching out to LifeWell Family Health & Psychiatry. You can book your appointment here:\n${bookingUrl}\n\nThis message is not for emergencies. If you are in crisis, call 911 or 988.\n\nWarm regards,\nLifeWell Family Health & Psychiatry`
      );
    } else {
      setSubject('');
      setBody('Hello,\n\n');
    }
    setCompose(true);
  }

  async function onSend(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    const res = await api('/api/admin/emails/send', {
      method: 'POST',
      body: JSON.stringify({
        to: recipients.map((row) => ({ email: row.email, name: row.name, lead_id: row.id })),
        subject,
        body,
      }),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.message || 'Send failed');
      return;
    }
    setMessage('Email queued. Check Emails for sent and failed items.');
    setCompose(false);
    setChecked([]);
  }

  return (
    <div>
      <h1 className="page-title">Leads</h1>
      <p className="page-sub">
        Contact and newsletter inquiries from the public site. Filter, then email selected people. Do not copy clinical details into other tools.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      <div className="filter-bar">
        <select value={type} onChange={(e) => { setType(e.target.value); void load(status, e.target.value); }} aria-label="Filter by type">
          <option value="">All types</option>
          <option value="contact">Contact</option>
          <option value="support">Support</option>
          <option value="newsletter">Newsletter</option>
        </select>
        <select value={status} onChange={(e) => { setStatus(e.target.value); void load(e.target.value, type); }} aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="open">Open</option>
          <option value="replied">Replied</option>
          <option value="closed">Closed</option>
          <option value="spam">Spam</option>
        </select>
        <button type="button" className="btn btn-primary" onClick={() => openCompose('custom')} disabled={!checked.length}>
          <Send size={16} />
          Email selected
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => openCompose('booking')} disabled={!checked.length}>
          Send booking link
        </button>
      </div>

      <div className="card">
        <div className="table-wrap desktop-only">
          {rows.length === 0 ? (
            <div className="empty">
              <Inbox size={22} />
              <p>No leads yet.</p>
            </div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th />
                  <th>When</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={checked.includes(row.id)}
                        disabled={!row.email}
                        onChange={() => toggle(row.id)}
                        aria-label={`Select ${row.email || row.name || row.id}`}
                      />
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      <span className="badge">{row.type}</span>
                    </td>
                    <td>
                      <div>{row.name || '—'}</div>
                      <div className="muted">{row.email}</div>
                    </td>
                    <td>{row.subject || '—'}</td>
                    <td>
                      <span className={`badge ${row.status === 'new' ? 'warn' : 'ok'}`}>{row.status}</span>
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost" onClick={() => setSelected(row)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="mobile-cards">
          {rows.length === 0 ? (
            <div className="empty">No leads yet.</div>
          ) : (
            rows.map((row) => (
              <article key={row.id} className="mobile-card">
                <div className="mobile-card-row">
                  <span>Select</span>
                  <input
                    type="checkbox"
                    checked={checked.includes(row.id)}
                    disabled={!row.email}
                    onChange={() => toggle(row.id)}
                  />
                </div>
                <div className="mobile-card-row">
                  <span>When</span>
                  <strong>{new Date(row.created_at).toLocaleString()}</strong>
                </div>
                <div className="mobile-card-row">
                  <span>From</span>
                  <strong>{row.name || row.email || '—'}</strong>
                </div>
                <div className="mobile-card-row">
                  <span>Type</span>
                  <span className="badge">{row.type}</span>
                </div>
                <div className="mobile-card-row">
                  <span>Status</span>
                  <span className={`badge ${row.status === 'new' ? 'warn' : 'ok'}`}>{row.status}</span>
                </div>
                <div className="row-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setSelected(row)}>
                    Open
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      </div>

      {selected ? (
        <div className="overlay modal-overlay">
          <div className="card card-pad modal-card">
            <div className="modal-head">
              <h2>Inquiry {selected.reference_id || ''}</h2>
              <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="inquiry-meta">
              <strong>{selected.name}</strong>
              <span>· {selected.email}</span>
              <span>· {selected.phone || 'no phone'}</span>
            </p>
            <p className="muted">{selected.subject || '—'}</p>
            <div className="card card-pad inquiry-body">{selected.message || '—'}</div>
            <div className="row-actions" style={{ marginTop: '1rem' }}>
              {['new', 'open', 'replied', 'closed', 'spam'].map((s) => (
                <button key={s} type="button" className="btn btn-ghost" onClick={() => setLeadStatus(selected.id, s)}>
                  Mark {s}
                </button>
              ))}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  openCompose('custom', selected);
                  setSelected(null);
                }}
                disabled={!selected.email}
              >
                Email this person
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  openCompose('booking', selected);
                  setSelected(null);
                }}
                disabled={!selected.email}
              >
                Send booking link
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {compose ? (
        <div className="overlay modal-overlay">
          <form className="card card-pad modal-card" onSubmit={onSend}>
            <div className="modal-head">
              <h2>Send email</h2>
              <button type="button" className="icon-btn" onClick={() => setCompose(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="muted">
              To: {recipients.map((row) => row.email).join(', ')}
            </p>
            <div className="field">
              <label htmlFor="lead-subject">Subject</label>
              <input id="lead-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="lead-body">Message</label>
              <textarea id="lead-body" rows={8} value={body} onChange={(e) => setBody(e.target.value)} required />
            </div>
            <div className="row-actions">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Sending…' : 'Send'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCompose(false)}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
