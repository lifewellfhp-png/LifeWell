'use client';

import { useEffect, useRef, useState } from 'react';

const FAX_NUMBER = '4077108252';

export function FaxReferralBlock() {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function copyFaxNumber() {
    if (!navigator.clipboard) {
      setCopyStatus('error');
      return;
    }

    try {
      await navigator.clipboard.writeText(FAX_NUMBER);
      setCopyStatus('copied');
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setCopyStatus('idle'), 2000);
    } catch {
      setCopyStatus('error');
    }
  }

  return (
    <section
      aria-labelledby="fax-referrals-heading"
      className="rounded-2xl border border-[#cfe8d3] bg-[#eaf6ec] px-6 py-8 text-center sm:px-10 sm:py-9"
    >
      <p
        id="fax-referrals-heading"
        className="text-xs font-bold uppercase tracking-[0.16em] text-[#002574]"
      >
        Fax referrals &amp; records to
      </p>
      <div className="mt-3 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <FaxIcon />
        <p className="tabular-nums text-[36px] font-bold leading-none tracking-tight text-[#02750f] sm:text-[48px]">
          (407) 710-8252
        </p>
      </div>
      <p className="mt-4 text-sm font-semibold leading-relaxed text-[#002574]">
        Phone: (407) 603-1717 <span aria-hidden="true">·</span>{' '}
        <span className="block sm:inline">Include records and the patient&apos;s contact information.</span>
      </p>
      <button
        type="button"
        onClick={copyFaxNumber}
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-sm border border-[#002574] bg-white px-4 py-2.5 text-sm font-semibold text-[#002574] transition-colors hover:bg-[#002574] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#002574]"
      >
        Copy fax number
      </button>
      <p role="status" aria-live="polite" className="mt-2 min-h-5 text-sm font-semibold text-[#002574]">
        {copyStatus === 'copied' ? 'Copied' : copyStatus === 'error' ? 'Unable to copy. Please try again.' : ''}
      </p>
    </section>
  );
}

function FaxIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#028815"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9V3h12v6" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v7H6z" />
      <path d="M18 12h.01" />
    </svg>
  );
}
