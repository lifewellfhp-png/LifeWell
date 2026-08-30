'use client';

import { useId, useRef, useState } from 'react';
import Link from 'next/link';
import { submitContact } from '@/lib/api';
import { trackConversion } from '@/lib/cms';
import type { FormStatus } from '@/types/content';
import { site } from '@/data/site';
import { Button } from '@/components/ui/Button';
import { TextField, TextAreaField, CheckboxField, Honeypot } from './Field';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MESSAGE_MAX = 2000;

type Errors = Partial<Record<'name' | 'email' | 'phone' | 'message' | 'consent', string>>;

const EMPTY = {
  name: '',
  email: '',
  phone: '',
  subject: '',
  message: '',
  consent: false,
};

export function ContactForm({ variant = 'full' }: { variant?: 'full' | 'compact' }) {
  const uid = useId();
  const [values, setValues] = useState(EMPTY);
  const [company, setCompany] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [feedback, setFeedback] = useState('');
  const statusRef = useRef<HTMLDivElement>(null);

  const compact = variant === 'compact';
  const busy = status === 'submitting';
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validate(): Errors {
    const next: Errors = {};
    const name = values.name.trim();
    const email = values.email.trim();
    const phone = values.phone.trim();
    const message = values.message.trim();

    if (!name) next.name = 'Please enter your name.';
    else if (name.length < 2) next.name = 'Please enter your full name.';
    else if (name.length > 100) next.name = 'Please use 100 characters or fewer.';

    if (!email) next.email = 'Please enter your email address.';
    else if (!EMAIL_RE.test(email)) next.email = 'Please enter a valid email address.';

    if (phone && !/^[\d\s()+.-]{7,20}$/.test(phone))
      next.phone = 'Please enter a valid phone number.';

    if (!message) next.message = 'Please enter your message.';
    else if (message.length < 10) next.message = 'Please provide a little more detail.';
    else if (message.length > MESSAGE_MAX)
      next.message = `Please use ${MESSAGE_MAX} characters or fewer.`;

    if (!compact && !values.consent) next.consent = 'Please confirm before sending.';

    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      setStatus('error');
      setFeedback('Please correct the highlighted fields and try again.');
      // Move the user to the first field that failed.
      const firstKey = Object.keys(found)[0];
      document.getElementById(`${uid}-${firstKey}`)?.focus();
      return;
    }

    setStatus('submitting');
    setFeedback('');

    const res = await submitContact({
      name: values.name.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      subject: values.subject.trim(),
      message: values.message.trim(),
      consent: compact ? true : values.consent,
      company,
    });

    if (res.success) {
      setStatus('success');
      setFeedback(res.message);
      setValues(EMPTY);
      void trackConversion('contact', typeof window !== 'undefined' ? window.location.pathname : undefined);
    } else {
      setStatus('error');
      setFeedback(res.message);
      if (res.errors) setErrors(res.errors as Errors);
      statusRef.current?.focus();
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        tabIndex={-1}
        className="rounded-md border border-success/30 bg-brand-accent-soft p-8"
      >
        <h3 className="text-h5">Thank you — your message has been sent.</h3>
        <p className="mt-3 text-text-secondary">{feedback}</p>
        <p className="mt-4 text-sm text-text-secondary">
          If your matter is urgent, please call{' '}
          <a href={site.contact.phoneHref} className="font-semibold text-text-link">
            {site.contact.phone}
          </a>
          . In an emergency, call 988 or 911.
        </p>
        <Button
          variant="outline"
          className="mt-6"
          onClick={() => {
            setStatus('idle');
            setFeedback('');
          }}
        >
          Send another message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className={compact ? 'space-y-5' : 'space-y-6'}>
      {!compact && (
        <div className="rounded-md border border-border-subtle bg-surface-muted px-5 py-4">
          <p className="text-sm text-text-secondary">
            <strong className="font-semibold text-text-primary">Please note:</strong> do not include
            sensitive medical or personal health information in this form. For clinical matters,
            please call our office at{' '}
            <a href={site.contact.phoneHref} className="font-semibold text-text-link">
              {site.contact.phone}
            </a>
            .
          </p>
        </div>
      )}

      <div className={compact ? 'grid gap-5 sm:grid-cols-2' : 'grid gap-6 sm:grid-cols-2'}>
        <TextField
          id={`${uid}-name`}
          label={compact ? 'Name' : 'Your name'}
          required
          compact={compact}
          autoComplete="name"
          value={values.name}
          onChange={(v) => set('name', v)}
          error={errors.name}
          disabled={busy}
        />
        <TextField
          id={`${uid}-email`}
          label={compact ? 'E-mail' : 'Email address'}
          type="email"
          required
          compact={compact}
          autoComplete="email"
          value={values.email}
          onChange={(v) => set('email', v)}
          error={errors.email}
          disabled={busy}
        />
        {!compact && (
          <>
            <TextField
              id={`${uid}-phone`}
              label="Phone number"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(v) => set('phone', v)}
              error={errors.phone}
              disabled={busy}
            />
            <TextField
              id={`${uid}-subject`}
              label="Subject"
              value={values.subject}
              onChange={(v) => set('subject', v)}
              disabled={busy}
            />
          </>
        )}
      </div>

      <TextAreaField
        id={`${uid}-message`}
        label={compact ? 'Your Message' : 'How can we help?'}
        required
        compact={compact}
        rows={compact ? 5 : 6}
        maxLength={MESSAGE_MAX}
        hint={compact ? undefined : 'Please keep your message general — avoid clinical details.'}
        value={values.message}
        onChange={(v) => set('message', v)}
        error={errors.message}
        disabled={busy}
      />

      {!compact && (
        <CheckboxField
          id={`${uid}-consent`}
          checked={values.consent}
          onChange={(v) => set('consent', v)}
          error={errors.consent}
          disabled={busy}
        >
          I understand this form is not for emergencies or clinical advice, and I consent to being
          contacted about my enquiry. See our{' '}
          <Link href="/privacy-policy" className="font-semibold text-text-link underline">
            Privacy Policy
          </Link>
          .
        </CheckboxField>
      )}

      <Honeypot value={company} onChange={setCompany} />

      <div
        ref={statusRef}
        tabIndex={-1}
        role="alert"
        aria-live="assertive"
        className="focus:outline-none"
      >
        {status === 'error' && feedback && (
          <p className="rounded-xs border border-error/30 bg-crisis-soft px-4 py-3 text-sm text-error">
            {feedback}
          </p>
        )}
      </div>

      {compact ? (
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-[51px] items-center justify-center rounded-[30px] bg-[var(--lw-primary)] px-[30px] py-[14px] text-[16px] font-semibold text-white transition-colors duration-300 hover:bg-[var(--lw-accent)] disabled:cursor-not-allowed disabled:opacity-60 min-[1181px]:text-[18px]"
        >
          {busy ? 'Sending…' : 'Send Message'}
        </button>
      ) : (
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? 'Sending…' : 'Send Message'}
        </Button>
      )}
    </form>
  );
}
