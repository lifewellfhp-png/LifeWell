'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const CONTROL =
  'w-full border bg-surface-raised px-4 py-3 text-md text-text-primary ' +
  'placeholder:text-text-secondary/60 transition-colors duration-quick ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70';

const CONTROL_COMPACT =
  'w-full rounded-[20px] border border-[#E6ECF1] bg-[#F4F7FA] px-5 py-3.5 text-[16px] text-text-primary ' +
  'placeholder:text-text-secondary/60 transition-colors duration-quick ' +
  'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-70';

/** Input borders carry meaning, so they use the 3:1 border token. */
const borderFor = (invalid?: boolean, compact?: boolean) =>
  invalid
    ? 'border-error focus:border-error'
    : compact
      ? 'border-[#E6ECF1] hover:border-[var(--lw-primary)] focus:border-[var(--lw-primary)]'
      : 'border-border-input hover:border-brand-primary';

interface BaseProps {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  compact?: boolean;
}

function Wrapper({
  id,
  label,
  error,
  hint,
  required,
  compact,
  children,
}: BaseProps & { children: ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className={
          compact
            ? 'mb-2.5 block text-[11px] font-bold uppercase tracking-[1.6px] text-[var(--lw-accent)]'
            : 'mb-2 block text-sm font-semibold text-text-primary'
        }
      >
        {label}
        {required && !compact ? (
          <span className="ml-1 text-error" aria-hidden="true">
            *
          </span>
        ) : (
          !required && !compact && <span className="ml-2 font-normal text-text-secondary">(optional)</span>
        )}
      </label>
      {hint && !compact && (
        <p id={`${id}-hint`} className="mb-2 text-xs text-text-secondary">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${id}-error`} className="mt-2 flex items-start gap-1.5 text-sm text-error">
          <AlertIcon />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) =>
  [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ') || undefined;

export function TextField({
  type = 'text',
  autoComplete,
  placeholder,
  value,
  onChange,
  ...base
}: BaseProps & {
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Wrapper {...base}>
      <input
        id={base.id}
        name={base.id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={base.required}
        disabled={base.disabled}
        autoComplete={autoComplete}
        placeholder={placeholder}
        aria-invalid={base.error ? true : undefined}
        aria-describedby={describedBy(base.id, base.error, base.hint)}
        className={cn(base.compact ? CONTROL_COMPACT : CONTROL, !base.compact && 'rounded-xs', borderFor(!!base.error, base.compact), 'min-h-12')}
      />
    </Wrapper>
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder,
  ...base
}: BaseProps & {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Wrapper {...base}>
      <select
        id={base.id}
        name={base.id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={base.required}
        disabled={base.disabled}
        aria-invalid={base.error ? true : undefined}
        aria-describedby={describedBy(base.id, base.error, base.hint)}
        className={cn(base.compact ? CONTROL_COMPACT : CONTROL, !base.compact && 'rounded-xs', borderFor(!!base.error, base.compact), 'min-h-12')}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </Wrapper>
  );
}

export function TextAreaField({
  rows = 6,
  placeholder,
  value,
  onChange,
  maxLength,
  ...base
}: BaseProps & {
  rows?: number;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
}) {
  return (
    <Wrapper {...base}>
      <textarea
        id={base.id}
        name={base.id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={base.required}
        disabled={base.disabled}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={base.error ? true : undefined}
        aria-describedby={describedBy(base.id, base.error, base.hint)}
        className={cn(base.compact ? CONTROL_COMPACT : CONTROL, !base.compact && 'rounded-xs', borderFor(!!base.error, base.compact), 'min-h-[140px] resize-y')}
      />
    </Wrapper>
  );
}

export function CheckboxField({
  id,
  checked,
  onChange,
  error,
  disabled,
  children,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      {/* Padding gives the whole row a >=44px activation target. */}
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 py-1.5">
        <input
          id={id}
          name={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            'mt-0.5 h-6 w-6 shrink-0 cursor-pointer rounded-xs border-2 accent-brand-primary-solid',
            error ? 'border-error' : 'border-border-input'
          )}
        />
        <span className="text-sm leading-relaxed text-text-secondary">{children}</span>
      </label>
      {error && (
        <p id={`${id}-error`} className="mt-1 flex items-start gap-1.5 text-sm text-error">
          <AlertIcon />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/** Off-screen honeypot. Real users never see or focus it. */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div aria-hidden="true" className="sr-only">
      <label htmlFor="company">Company (leave this field empty)</label>
      <input
        id="company"
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function AlertIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      className="mt-0.5 shrink-0"
    >
      <path d="M8 1.5 15 14H1L8 1.5Zm0 4.2a.8.8 0 0 0-.8.9l.2 2.9a.6.6 0 0 0 1.2 0l.2-3a.8.8 0 0 0-.8-.8Zm0 5.4a.9.9 0 1 0 0 1.8.9.9 0 0 0 0-1.8Z" />
    </svg>
  );
}
