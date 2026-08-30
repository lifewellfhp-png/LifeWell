'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Eye, KeyRound, LoaderCircle, Lock, Mail, Plus, ShieldBan, ShieldCheck, Trash2, X } from 'lucide-react';
import { api, setToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { STAFF_ACCESS, STAFF_MODULES } from '@/lib/nav';
import { NAV_ICONS } from '@/lib/icons';

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'staff';
  permissions: string[];
  active: boolean;
  last_login_at?: string | null;
  created_at?: string;
};

const emptyForm: { name: string; email: string; password: string; permissions: string[] } = {
  name: '',
  email: '',
  password: '',
  permissions: [...STAFF_MODULES],
};

export default function UsersPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'view' | 'reset' | 'change-password' | null>(null);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [sendInvite, setSendInvite] = useState(true);
  const [ownPasswordForm, setOwnPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function load() {
    const res = await api<UserRow[]>('/api/admin/users');
    if (!res.success) setError(res.message || 'Failed to load users');
    else setRows(res.data || []);
  }

  useEffect(() => {
    if (user?.role === 'super_admin') void load();
  }, [user?.role]);

  useEffect(() => {
    document.body.style.overflow = mode ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mode]);

  if (user?.role !== 'super_admin') {
    return (
      <div className="card card-pad">
        <h1 className="page-title">Staff</h1>
        <p className="muted">Only the Super Admin can view accounts and create sub-admins.</p>
      </div>
    );
  }

  function closeModal() {
    if (saving) return;
    setMode(null);
    setSelected(null);
    setNewPassword('');
    setOwnPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setFieldErrors({});
    setError(null);
  }

  function togglePermission(module: string) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(module)
        ? current.permissions.filter((item) => item !== module)
        : [...current.permissions, module],
    }));
  }

  function generatePassword() {
    const slice = crypto.getRandomValues(new Uint32Array(2));
    return `Lw-${slice[0].toString(16)}${slice[1].toString(16).slice(0, 4)}!`;
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await api('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        ...form,
        role: 'staff',
        active: true,
        send_invite: sendInvite,
        admin_url: `${window.location.origin}/login`,
      }),
    });
    setSaving(false);
    if (!res.success) setError(res.message || 'Create failed');
    else {
      setMode(null);
      setForm(emptyForm);
      setMessage(
        sendInvite
          ? `Account created. Login details were sent to ${form.email}.`
          : `Account created for ${form.email}. Use Email login to forward credentials.`
      );
      await load();
    }
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError(null);
    const res = await api(`/api/admin/users/${selected.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ password: newPassword }),
    });
    setSaving(false);
    if (!res.success) setError(res.message || 'Reset failed');
    else {
      setMode(null);
      setNewPassword('');
      await load();
    }
  }

  async function onChangeOwnPassword(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const res = await api<{ token: string }>('/api/admin/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(ownPasswordForm),
    });
    setSaving(false);
    if (!res.success) {
      setError(res.message || 'Password change failed.');
      setFieldErrors(res.errors || {});
      return;
    }
    // Keep this session working under the new token version rather than
    // forcing an immediate re-login — other sessions/devices are the ones
    // this change is meant to log out.
    if (res.data?.token) setToken(res.data.token);
    setMode(null);
    setOwnPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    setMessage('Your password was changed. Other signed-in sessions have been signed out.');
  }

  async function onDelete(row: UserRow) {
    if (row.role === 'super_admin') return;
    if (!confirm(`Delete ${row.name}'s account? They will lose access immediately.`)) return;
    const res = await api(`/api/admin/users/${row.id}`, { method: 'DELETE' });
    if (!res.success) setError(res.message || 'Delete failed');
    else {
      setMessage(`${row.name}'s account was deleted.`);
      await load();
    }
  }

  async function onBlock(row: UserRow, active: boolean) {
    if (row.role === 'super_admin') return;
    const res = await api(`/api/admin/users/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ active }),
    });
    if (!res.success) setError(res.message || 'Update failed');
    else {
      setMessage(active ? `${row.name} can sign in again.` : `${row.name} is blocked from signing in.`);
      await load();
    }
  }

  async function onEmailCredentials(row: UserRow) {
    if (row.role === 'super_admin') return;
    if (!confirm(`Email a new temporary password to ${row.email}? Their current password will stop working.`)) return;
    setError(null);
    const res = await api(`/api/admin/users/${row.id}/invite`, {
      method: 'POST',
      body: JSON.stringify({ admin_url: `${window.location.origin}/login` }),
    });
    if (!res.success) setError(res.message || 'Invite email failed');
    else setMessage(res.message || `Login details were emailed to ${row.email}.`);
  }

  const allSelected = STAFF_MODULES.every((module) => form.permissions.includes(module));

  return (
    <div>
      <div className="toolbar">
        <div>
          <h1 className="page-title">Staff</h1>
          <p className="page-sub">Only Super Admin can view accounts, reset passwords, block access, or email login details.</p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setForm(emptyForm);
            setError(null);
            setMode('create');
          }}
        >
          <Plus size={16} />
          Add sub-admin
        </button>
      </div>

      {error && !mode ? <div className="error-banner">{error}</div> : null}
      {message && !mode ? <div className="ok-banner">{message}</div> : null}

      {user ? (
        <article className="card card-pad account-card" style={{ marginBottom: '1.5rem' }}>
          <div className="account-card-head">
            <div className="sidebar-avatar">{user.name.slice(0, 1).toUpperCase()}</div>
            <div>
              <strong>{user.name}</strong>
              <span className="muted">{user.email}</span>
            </div>
            <span className="badge ok">Your Account</span>
          </div>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setError(null);
                setFieldErrors({});
                setOwnPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
                setMode('change-password');
              }}
            >
              <Lock size={15} />
              Change password
            </button>
          </div>
        </article>
      ) : null}

      <div className="account-grid">
        {rows.map((row) => (
          <article key={row.id} className="card card-pad account-card">
            <div className="account-card-head">
              <div className="sidebar-avatar">{row.name.slice(0, 1).toUpperCase()}</div>
              <div>
                <strong>{row.name}</strong>
                <span className="muted">{row.email}</span>
              </div>
              <span className={`badge ${row.role === 'super_admin' ? 'ok' : row.active ? '' : 'warn'}`}>
                {row.role === 'super_admin' ? 'Super Admin' : row.active ? 'Sub-admin' : 'Blocked'}
              </span>
            </div>
            <p className="muted account-meta">
              Last sign-in: {row.last_login_at ? new Date(row.last_login_at).toLocaleString() : 'Never'}
            </p>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setSelected(row);
                  setMode('view');
                }}
              >
                <Eye size={15} />
                View
              </button>
              {row.role !== 'super_admin' ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setSelected(row);
                      setNewPassword('');
                      setMode('reset');
                    }}
                  >
                    <KeyRound size={15} />
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void onEmailCredentials(row)}
                  >
                    <Mail size={15} />
                    Email login
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => void onBlock(row, !row.active)}
                  >
                    {row.active ? <ShieldBan size={15} /> : <ShieldCheck size={15} />}
                    {row.active ? 'Block' : 'Unblock'}
                  </button>
                  <button type="button" className="btn btn-danger" onClick={() => onDelete(row)}>
                    <Trash2 size={15} />
                    Delete
                  </button>
                </>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {mode === 'create' ? (
        <div className="overlay modal-overlay">
          <form className="card card-pad modal-card staff-modal" onSubmit={onCreate}>
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Access</p>
                <h2>New sub-admin</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <p className="page-sub">They can edit the public website — never clinical charts, staff accounts, or the audit log.</p>
            {error ? <div className="error-banner">{error}</div> : null}

            <div className="staff-form-grid">
              <div className="field">
                <label htmlFor="staff-name">Full name</label>
                <input
                  id="staff-name"
                  required
                  placeholder="e.g. Lourdie Chachoute"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="staff-email">Email</label>
                <input
                  id="staff-email"
                  type="email"
                  required
                  placeholder="name@lifewellfhp.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="field full">
                <label htmlFor="staff-password">Temporary password</label>
                <div className="password-row">
                  <input
                    id="staff-password"
                    type="text"
                    required
                    minLength={10}
                    placeholder="At least 10 characters"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button type="button" className="btn btn-ghost" onClick={() => setForm({ ...form, password: generatePassword() })}>
                    Generate
                  </button>
                </div>
              </div>
              <label className="access-tile full" style={{ marginTop: '0.2rem' }}>
                <input
                  type="checkbox"
                  checked={sendInvite}
                  onChange={(e) => setSendInvite(e.target.checked)}
                />
                <span className="access-ico" aria-hidden>
                  <Mail size={16} />
                </span>
                <span>Email these login details to the sub-admin now</span>
              </label>
              <div className="field full">
                <div className="access-head">
                  <div>
                    <label>Website access</label>
                    <p>Choose the pages this person may manage.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setForm({ ...form, permissions: allSelected ? [] : [...STAFF_MODULES] })}
                  >
                    {allSelected ? 'Clear all' : 'Select all'}
                  </button>
                </div>
                <div className="perm-grid">
                  {STAFF_ACCESS.map((item) => {
                    const checked = form.permissions.includes(item.module);
                    const Icon = NAV_ICONS[item.icon];
                    return (
                    <label key={`${item.module}-${item.label}`} className={`access-tile ${checked ? 'is-on' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermission(item.module)}
                        />
                        <span className="access-ico" aria-hidden>
                          <Icon size={16} />
                        </span>
                        <span>{item.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving || form.permissions.length === 0}>
                {saving ? <LoaderCircle className="nav-spinner" size={16} /> : <Plus size={16} />}
                {saving ? 'Creating…' : 'Create account'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {mode === 'view' && selected ? (
        <div className="overlay modal-overlay">
          <div className="card card-pad modal-card">
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Account</p>
                <h2>{selected.name}</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="detail-grid">
              <p>
                <span>Email</span>
                <strong>{selected.email}</strong>
              </p>
              <p>
                <span>Role</span>
                <strong>{selected.role === 'super_admin' ? 'Super Admin' : 'Sub-admin'}</strong>
              </p>
              <p>
                <span>Password</span>
                <strong>••••••••••</strong>
              </p>
              <p>
                <span>Last sign-in</span>
                <strong>{selected.last_login_at ? new Date(selected.last_login_at).toLocaleString() : 'Never'}</strong>
              </p>
            </div>
            {selected.role !== 'super_admin' ? (
              <div className="perm-grid" style={{ marginBottom: '1rem' }}>
                {STAFF_ACCESS.map((item) => {
                  const on = selected.permissions.includes(item.module) || selected.permissions.includes('*');
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <div key={`${item.module}-${item.label}`} className={`access-tile ${on ? 'is-on' : ''}`}>
                      <span className="access-ico" aria-hidden>
                        <Icon size={16} />
                      </span>
                      <span>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="muted">Super Admin can open every module.</p>
            )}
            <p className="muted">Passwords are hashed and cannot be revealed. Use Reset to issue a new one.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mode === 'reset' && selected ? (
        <div className="overlay modal-overlay">
          <form className="card card-pad modal-card" onSubmit={onReset}>
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Security</p>
                <h2>Reset password</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {error ? <div className="error-banner">{error}</div> : null}
            <p className="muted">
              New password for <strong>{selected.name}</strong> · {selected.email}
            </p>
            <div className="field">
              <label htmlFor="new-password">New password</label>
              <input
                id="new-password"
                type="text"
                required
                minLength={10}
                placeholder="At least 10 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <LoaderCircle className="nav-spinner" size={16} /> : <KeyRound size={16} />}
                {saving ? 'Saving…' : 'Save password'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {mode === 'change-password' ? (
        <div className="overlay modal-overlay">
          <form className="card card-pad modal-card" onSubmit={onChangeOwnPassword}>
            <div className="modal-head">
              <div>
                <p className="modal-kicker">Security</p>
                <h2>Change your password</h2>
              </div>
              <button type="button" className="icon-btn" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {error ? <div className="error-banner">{error}</div> : null}
            <div className="field">
              <label htmlFor="current-password">Current password</label>
              <input
                id="current-password"
                type="password"
                required
                autoComplete="current-password"
                value={ownPasswordForm.current_password}
                onChange={(e) =>
                  setOwnPasswordForm({ ...ownPasswordForm, current_password: e.target.value })
                }
              />
              {fieldErrors.current_password ? (
                <p className="field-error">{fieldErrors.current_password}</p>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="new-own-password">New password</label>
              <input
                id="new-own-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={ownPasswordForm.new_password}
                onChange={(e) => setOwnPasswordForm({ ...ownPasswordForm, new_password: e.target.value })}
              />
              {fieldErrors.new_password ? <p className="field-error">{fieldErrors.new_password}</p> : null}
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                At least 12 characters, with an uppercase letter, a lowercase letter, a number, and a
                symbol.
              </p>
            </div>
            <div className="field">
              <label htmlFor="confirm-own-password">Confirm new password</label>
              <input
                id="confirm-own-password"
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                value={ownPasswordForm.confirm_password}
                onChange={(e) =>
                  setOwnPasswordForm({ ...ownPasswordForm, confirm_password: e.target.value })
                }
              />
              {fieldErrors.confirm_password ? (
                <p className="field-error">{fieldErrors.confirm_password}</p>
              ) : null}
            </div>
            <p className="muted">Changing your password signs out every other device or browser tab.</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? <LoaderCircle className="nav-spinner" size={16} /> : <Lock size={16} />}
                {saving ? 'Saving…' : 'Change password'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
