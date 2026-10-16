'use client';

import { FormEvent, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const { login, verifyMfa, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Phase 1 item 5 (MFA) — step 2, only entered when login() reports
  // mfaRequired. mfaToken is short-lived (5 minutes) and useless on its own
  // without a valid TOTP/recovery code, so holding it in component state is
  // no greater a risk than the brief window a password sits in this same
  // state during step 1.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);

  if (!loading && user) {
    router.replace('/');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await login(email, password);
    setBusy(false);
    if (result.mfaRequired && result.mfaToken) {
      setMfaToken(result.mfaToken);
      return;
    }
    if (result.error) setError(result.error);
    else router.replace('/');
  }

  async function onSubmitMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setBusy(true);
    setError(null);
    const err = await verifyMfa(mfaToken, useRecoveryCode ? undefined : mfaCode, useRecoveryCode ? mfaCode : undefined);
    setBusy(false);
    if (err) setError(err);
    else router.replace('/');
  }

  if (mfaToken) {
    return (
      <div className="login-shell">
        <aside className="login-visual" aria-hidden="true">
          <Image
            src="/images/brand/login-bg.avif"
            alt=""
            fill
            priority
            sizes="(min-width: 960px) 48vw, 100vw"
            className="login-visual-photo"
          />
          <div className="login-visual-scrim" />
          <div className="login-visual-copy">
            <p className="login-visual-kicker">LifeWell Family Health &amp; Psychiatry</p>
            <h2>
              Compassionate care.
              <em> Calm control.</em>
            </h2>
          </div>
        </aside>

        <main className="login-panel">
          <form className="login-form" onSubmit={onSubmitMfa} noValidate>
            <Image
              src="/images/brand/logo-v2.avif"
              alt="LifeWell Family Health & Psychiatry"
              width={945}
              height={191}
              priority
              className="login-logo"
            />

            <p className="login-kicker">Staff portal</p>
            <h1 className="login-title">
              <span>Two-factor </span>
              <em>verification</em>
            </h1>
            <p className="login-lead">
              {useRecoveryCode
                ? 'Enter one of your saved recovery codes.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </p>

            {error ? (
              <div className="error-banner" role="alert">
                {error}
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="mfa-code">{useRecoveryCode ? 'Recovery code' : 'Authentication code'}</label>
              <input
                id="mfa-code"
                type="text"
                inputMode={useRecoveryCode ? 'text' : 'numeric'}
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder={useRecoveryCode ? 'XXXX-XXXX' : '123456'}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
              />
            </div>

            <button type="submit" className="login-submit" disabled={busy}>
              <span className="login-submit-label">{busy ? 'Verifying…' : 'Verify'}</span>
              <span className="login-submit-chip" aria-hidden="true">
                <ArrowRight size={18} />
              </span>
            </button>

            <button
              type="button"
              className="login-footnote"
              style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => {
                setUseRecoveryCode((v) => !v);
                setMfaCode('');
                setError(null);
              }}
            >
              {useRecoveryCode ? 'Use an authenticator code instead' : 'Use a recovery code instead'}
            </button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="login-shell">
      <aside className="login-visual" aria-hidden="true">
        <Image
          src="/images/brand/login-bg.avif"
          alt=""
          fill
          priority
          sizes="(min-width: 960px) 48vw, 100vw"
          className="login-visual-photo"
        />
        <div className="login-visual-scrim" />
        <div className="login-visual-copy">
          <p className="login-visual-kicker">LifeWell Family Health &amp; Psychiatry</p>
          <h2>
            Compassionate care.
            <em> Calm control.</em>
          </h2>
          <p>
            A private workspace for website content, insurance, reviews, and patient inquiries —
            never clinical charts.
          </p>
        </div>
      </aside>

      <main className="login-panel">
        <form className="login-form" onSubmit={onSubmit} noValidate>
          <Image
            src="/images/brand/logo-v2.avif"
            alt="LifeWell Family Health & Psychiatry"
            width={945}
            height={191}
            priority
            className="login-logo"
          />

          <p className="login-kicker">Staff portal</p>
          <h1 className="login-title">
            <span>Welcome </span>
            <em>back</em>
          </h1>
          <p className="login-lead">Sign in to manage the LifeWell website with care and privacy.</p>

          {error ? (
            <div className="error-banner" role="alert">
              {error}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              placeholder="you@lifewellfhp.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="password-wrap">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-submit" disabled={busy}>
            <span className="login-submit-label">{busy ? 'Signing in…' : 'Sign in'}</span>
            <span className="login-submit-chip" aria-hidden="true">
              <ArrowRight size={18} />
            </span>
          </button>

          <p className="login-footnote">Authorized staff only. Sessions expire automatically.</p>
        </form>
      </main>
    </div>
  );
}
