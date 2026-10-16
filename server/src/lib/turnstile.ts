import { env, turnstileConfigured } from '../config/env.js';
import { logger } from '../utils/logger.js';

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Cloudflare Turnstile response token server-side (Phase 1 item
 * 7). Two distinct "pass" cases, deliberately different from a real
 * Cloudflare rejection:
 *
 *  - Not configured (TURNSTILE_SECRET_KEY unset): returns true. Every form
 *    this guards already has the honeypot as a baseline, and failing closed
 *    here would reject every real visitor the moment this ships, before
 *    Cloudflare keys exist — same degrade-gracefully posture as SMTP/
 *    Gemini/MFA elsewhere in this config.
 *  - Configured but the verify call itself errors (network failure,
 *    Cloudflare outage, malformed response): also returns true, logged for
 *    operator visibility. This app is a healthcare practice's contact
 *    form — losing real patient inquiries during a transient Cloudflare
 *    outage is a worse outcome than briefly relying on the honeypot alone.
 *
 * A token Cloudflare actually evaluated and rejected (`success: false` in
 * its response) returns false — that is the one case this function is
 * actually meant to catch.
 */
export async function verifyTurnstile(token: string, remoteIp?: string): Promise<boolean> {
  if (!turnstileConfigured) return true;

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
      return true;
    }

    const json = (await res.json()) as { success?: boolean };
    return json.success === true;
  } catch (err) {
    logger.error('turnstile verify failed', { reason: err instanceof Error ? err.message : 'unknown' });
    return true;
  }
}
