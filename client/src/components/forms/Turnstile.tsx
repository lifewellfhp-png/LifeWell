'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

/**
 * Cloudflare Turnstile widget (Phase 1 item 7) — a real bot-detection layer
 * on top of the existing honeypot field, verified server-side
 * (server/src/lib/turnstile.ts).
 *
 * Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, so this
 * component is safe to drop into a form before Cloudflare keys exist — the
 * server already treats an absent/empty token as "not configured yet" and
 * falls back to the honeypot alone (never rejects a real visitor over it).
 *
 * The parent remounts this component (change the `key` prop) to get a
 * fresh widget/token after a failed submission — Turnstile tokens are
 * single-use, and remounting is simpler and more robust than managing the
 * imperative reset() API by hand.
 */
export function Turnstile({
  onToken,
  size = 'normal',
}: {
  onToken: (token: string) => void;
  size?: 'normal' | 'compact' | 'flexible';
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!scriptLoaded || !SITE_KEY || !containerRef.current || !window.turnstile) return;
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: onToken,
      'error-callback': () => onToken(''),
      'expired-callback': () => onToken(''),
      size,
    });
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
    // onToken/size are stable for a given mount (the parent remounts via
    // `key` rather than changing these in place) — re-running this effect
    // on every render would re-render a brand new widget pointlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptLoaded]);

  if (!SITE_KEY) return null;

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
      />
      <div ref={containerRef} />
    </>
  );
}
