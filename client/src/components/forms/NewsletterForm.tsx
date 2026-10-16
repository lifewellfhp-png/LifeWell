'use client';

import { useId, useState } from 'react';
import { submitNewsletter } from '@/lib/api';
import type { FormStatus } from '@/types/content';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Turnstile } from './Turnstile';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Live footer CTA — all-caps label that reveals the email field. */
export function FooterNewsletter() {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 self-start text-left font-body text-[12px] font-semibold uppercase tracking-[2px] text-white transition-opacity duration-300 hover:opacity-80 sm:mt-2 sm:text-[13px]"
      >
        Sign up to Newsletter
      </button>
    );
  }

  return <NewsletterForm variant="footer" />;
}

export function NewsletterForm({ variant = 'default' }: { variant?: 'default' | 'footer' }) {
  const id = useId();
  const emailId = `${id}-email`;

  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileKey, setTurnstileKey] = useState(0);
  const [status, setStatus] = useState<FormStatus>('idle');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const busy = status === 'submitting';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const value = email.trim();
    if (!value) {
      setError('Please enter your email address.');
      setStatus('error');
      return;
    }
    if (!EMAIL_RE.test(value)) {
      setError('Please enter a valid email address.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    const res = await submitNewsletter({ email: value, company, turnstile_token: turnstileToken });

    if (res.success) {
      setStatus('success');
      setMessage(res.message);
      setEmail('');
    } else {
      setStatus('error');
      setError(res.message);
      // Turnstile tokens are single-use — remount for a fresh one on retry.
      setTurnstileToken('');
      setTurnstileKey((k) => k + 1);
    }
  }

  const footer = variant === 'footer';

  if (status === 'success') {
    return (
      <div
        role="status"
        className={cn(
          'flex items-start gap-3 rounded-md px-6 py-5',
          footer
            ? 'border border-white/30 bg-white/10'
            : 'border border-success/30 bg-brand-accent-soft'
        )}
      >
        <CheckIcon className={footer ? 'text-white' : 'text-success'} />
        <p className={cn('text-sm', footer ? 'text-white' : 'text-text-primary')}>{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={cn('w-full', footer && 'max-w-md')}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label htmlFor={emailId} className="sr-only">
            Email address
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            disabled={busy}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${emailId}-error` : undefined}
            className={cn(
              'min-h-12 w-full px-4 py-3 text-md transition-colors duration-quick',
              'disabled:cursor-not-allowed disabled:opacity-70',
              footer
                ? 'rounded-[30px] border border-white/50 bg-white text-text-primary placeholder:text-text-secondary/60'
                : 'rounded-xs border bg-surface-raised text-text-primary placeholder:text-text-secondary/60',
              error
                ? 'border-error'
                : footer
                  ? ''
                  : 'border-border-input hover:border-brand-primary'
            )}
          />
        </div>

        {/* Honeypot */}
        <div aria-hidden="true" className="sr-only">
          <label htmlFor={`${id}-company`}>Company</label>
          <input
            id={`${id}-company`}
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
          />
        </div>

        {footer ? (
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-[30px] bg-[var(--lw-accent)] px-6 text-[15px] font-semibold text-white transition-colors duration-300 hover:bg-white hover:text-[var(--lw-primary)] disabled:opacity-60"
          >
            {busy ? 'Signing up…' : 'Sign Up'}
          </button>
        ) : (
          <Button type="submit" disabled={busy} className="shrink-0">
            {busy ? 'Signing up…' : 'Sign Up'}
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Turnstile key={turnstileKey} onToken={setTurnstileToken} size="compact" />
      </div>

      <p aria-live="polite" className="min-h-6">
        {error && (
          <span
            id={`${emailId}-error`}
            className={cn('mt-2 block text-sm', footer ? 'text-white' : 'text-error')}
          >
            {error}
          </span>
        )}
      </p>
    </form>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('mt-0.5 shrink-0', className ?? 'text-success')}
    >
      <path d="m2.5 8.5 3.5 3.5 7.5-8" />
    </svg>
  );
}
