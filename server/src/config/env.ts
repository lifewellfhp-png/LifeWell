import 'dotenv/config';
import { z } from 'zod';

/**
 * Environment schema.
 *
 * Validated once at boot so a misconfigured deployment fails immediately and
 * loudly rather than at the moment a patient submits a form.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  /** Comma-separated list of origins permitted to call this API. */
  CORS_ORIGINS: z
    .string()
    .default(
      'http://localhost:3000,http://localhost:3001,https://www.lifewellfhp.com,https://lifewellfhp.com,https://lifewellfhp-client.vercel.app,https://lifewellfhp-admin.vercel.app'
    ),

  /** Destination for contact-form notifications. */
  CONTACT_EMAIL: z.string().email().default('contact@lifewellfhp.com'),
  PAUBOX_API_KEY: z.string().optional(),

  /* SMTP. When unset the server runs in log-only mode — useful locally and in
     CI, and it prevents silent data loss from being mistaken for delivery. */
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),

  /* Newsletter provider. Left unset until the client chooses one; the service
     layer degrades to log-only rather than pretending to subscribe. */
  NEWSLETTER_PROVIDER: z.enum(['none', 'mailchimp', 'convertkit']).default('none'),
  NEWSLETTER_API_KEY: z.string().optional(),
  NEWSLETTER_LIST_ID: z.string().optional(),

  /** Rate limits, per IP per hour (contact/newsletter) or per 15 minutes (admin login). */
  RATE_LIMIT_CONTACT: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_NEWSLETTER: z.coerce.number().int().positive().default(3),
  RATE_LIMIT_ADMIN_LOGIN: z.coerce.number().int().positive().default(5),

  /* Supabase — admin CMS + leads persistence. */
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),

  /**
   * JWT secret for admin sessions. Required — deliberately no default.
   * Admin auth guards leads/contact PII, so a misconfigured deployment must
   * fail at boot rather than silently sign tokens with a known value.
   */
  ADMIN_JWT_SECRET: z
    .string()
    .min(32, 'ADMIN_JWT_SECRET must be set to a random value at least 32 characters long.'),

  /**
   * Shared with the admin app (same value in both Vercel projects). Gates
   * trust of the admin proxy's x-lifewell-client-ip header for rate
   * limiting — see middleware/index.ts's trustedClientIp(). Optional: when
   * unset, that header is never trusted and every request (including the
   * admin proxy's own) falls back to Express's normal trust-proxy-derived
   * req.ip, same as before this existed.
   */
  ADMIN_PROXY_SECRET: z.string().optional(),

  GA4_MEASUREMENT_ID: z.string().optional(),
  GOOGLE_SEARCH_CONSOLE_SITE: z.string().optional(),

  /**
   * P4-I5B: canonical public Client origin, needed server-side to build a
   * marketing-unsubscribe link for outbound campaign email
   * (<origin>/unsubscribe?token=...). The Client already has its own
   * equivalent (client/src/data/site.ts's NEXT_PUBLIC_SITE_URL), but there
   * is no shared code between apps, so the Server needs its own copy of
   * the same default rather than reusing CORS_ORIGINS (a multi-origin
   * allowlist that also includes localhost/preview domains — the wrong
   * tool for "the one canonical link destination").
   */
  PUBLIC_SITE_URL: z.string().url().default('https://www.lifewellfhp.com'),

  /*
   * Chat assistant (Gemini). Left unset until configured; the route
   * degrades to a clear "not configured" error rather than crashing at
   * boot — same posture as SMTP above. GEMINI_MODEL has no safe default:
   * Google's model identifiers change over time, so a placeholder that
   * merely "looks like" a model name would fail silently at the API call
   * instead of loudly at boot. The operator must set a real, currently
   * valid model id before this route is usable.
   */
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('CONFIRM-BEFORE-DEPLOY'),
  RATE_LIMIT_CHAT: z.coerce.number().int().positive().default(10),

  /**
   * Phase 1 item 5: AES-256-GCM key (base64-encoded, 32 raw bytes — generate
   * with `openssl rand -base64 32`) used to encrypt each admin's TOTP secret
   * at rest. A TOTP secret must stay decryptable for login verification,
   * unlike password_hash/recovery-code hashes, so it can't be one-way
   * hashed like those. Optional, same degrade-gracefully posture as SMTP/
   * Gemini above: until this is set, MFA setup is blocked with a clear
   * error rather than crashing at boot — see mfaConfigured below and
   * handleMfaSetupStart in controllers/mfa.controller.ts.
   */
  MFA_ENCRYPTION_KEY: z.string().optional(),

  /**
   * Phase 1 item 7: Cloudflare Turnstile server-side verification for the
   * public contact/newsletter forms. Optional, same degrade-gracefully
   * posture as every other integration above — until this is set,
   * verifyTurnstile() treats every submission as passed (honeypot alone
   * still applies) rather than rejecting every visitor because a key
   * hasn't been configured yet.
   */
  TURNSTILE_SECRET_KEY: z.string().optional(),

  /**
   * IndexNow (indexnow.org) — pings participating search engines
   * (currently Bing, and others that opt in) when content changes, so
   * they don't have to wait for their own next crawl. Optional, same
   * degrade-gracefully posture as every other integration above —
   * pingIndexNow() just logs and no-ops until this is set. The key is
   * any string the operator generates; IndexNow verifies ownership via a
   * matching `<key>.txt` file at the site root (see
   * src/lib/indexNow.ts's doc comment for the exact setup steps).
   */
  INDEXNOW_API_KEY: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  console.error(`Invalid environment configuration:\n${issues}`);
  process.exit(1);
}

export const env = parsed.data;

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

/** True once SMTP is fully configured; otherwise mail is logged, not sent. */
export const mailConfigured = Boolean(
  env.PAUBOX_API_KEY || (env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASSWORD)
);

/** True once a Gemini API key is present; otherwise /api/chat answers with a clear "not configured" error. */
export const geminiConfigured = Boolean(env.GEMINI_API_KEY);

/** True once an IndexNow key is present; otherwise pingIndexNow() just logs and no-ops. */
export const indexNowConfigured = Boolean(env.INDEXNOW_API_KEY);

/** True once MFA_ENCRYPTION_KEY is set; otherwise MFA setup is blocked with a clear error. */
export const mfaConfigured = Boolean(env.MFA_ENCRYPTION_KEY);

/** True once TURNSTILE_SECRET_KEY is set; otherwise verifyTurnstile() treats every submission as passed. */
export const turnstileConfigured = Boolean(env.TURNSTILE_SECRET_KEY);

export const isProduction = env.NODE_ENV === 'production';
