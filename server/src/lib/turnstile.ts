import { env, turnstileConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Cloudflare error codes that mean OUR secret is wrong or absent from the
 * request — a server misconfiguration, not a failed bot check. Every other
 * `error-codes` value (missing/invalid-input-response, timeout-or-
 * duplicate, bad-request, internal-error) describes a real problem with
 * the visitor's token and still rejects normally.
 */
const SECRET_MISCONFIGURATION_CODES = new Set(['missing-input-secret', 'invalid-input-secret']);

export type TurnstileResult = {
  /** Whether the submission should proceed. */
  ok: boolean;
  /** True when `ok` is true specifically because the secret is misconfigured, not because verification genuinely passed. */
  misconfigured?: boolean;
  errorCodes?: string[];
};

/**
 * Verifies a Cloudflare Turnstile response token server-side (Phase 1 item
 * 7). Three distinct cases:
 *
 *  - Not configured (TURNSTILE_SECRET_KEY unset): `{ ok: true }`. Every form
 *    this guards already has the honeypot as a baseline, and failing closed
 *    here would reject every real visitor the moment this ships, before
 *    Cloudflare keys exist — same degrade-gracefully posture as SMTP/
 *    Gemini/MFA elsewhere in this config.
 *  - Configured but the secret itself is wrong (Cloudflare's error-codes say
 *    missing/invalid-input-secret): `{ ok: true, misconfigured: true }`.
 *    This is OUR bug, not the visitor's — rejecting every submission over a
 *    typo'd secret would be worse than briefly relying on the honeypot
 *    alone. Logged as a server error AND surfaced to the controller so it
 *    can write an audit log entry an operator will actually see.
 *  - Configured but the verify call itself errors (network failure,
 *    Cloudflare outage, malformed response): also `{ ok: true }`, logged.
 *    This app is a healthcare practice's contact form — losing real patient
 *    inquiries during a transient outage is a worse outcome than briefly
 *    relying on the honeypot alone.
 *
 * A token Cloudflare actually evaluated and rejected as a real bot-check
 * failure returns `{ ok: false }` — that is the one case meant to block
 * the submission.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<TurnstileResult> {
  if (!turnstileConfigured) return { ok: true };

  try {
    const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY as string, response: token });
    if (remoteIp) body.set('remoteip', remoteIp);

    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      logger.error('turnstile verify http error', { status: res.status });
      return { ok: true };
    }

    const json = (await res.json()) as { success?: boolean; 'error-codes'?: unknown };
    if (json.success === true) return { ok: true };

    const errorCodes = Array.isArray(json['error-codes'])
      ? json['error-codes'].filter((c): c is string => typeof c === 'string')
      : [];
    const misconfigured = errorCodes.some((code) => SECRET_MISCONFIGURATION_CODES.has(code));

    if (misconfigured) {
      logger.error('turnstile secret misconfigured — accepting submission, fix TURNSTILE_SECRET_KEY', { errorCodes });
      return { ok: true, misconfigured: true, errorCodes };
    }

    return { ok: false, errorCodes };
  } catch (err) {
    logger.error('turnstile verify failed', { reason: err instanceof Error ? err.message : 'unknown' });
    return { ok: true };
  }
}
