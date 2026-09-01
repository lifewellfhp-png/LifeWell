import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { env, isProduction, corsOrigins } from '../config/env.js';

/** Attaches a request id used to correlate logs with client-facing references. */
export const requestId: RequestHandler = (req, _res, next) => {
  (req as Request & { id: string }).id = randomUUID();
  next();
};

/** Logs method, path and outcome — never the body. */
export const requestLogger: RequestHandler = (req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
    });
  });
  next();
};

const limiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    // Failed validation still counts, so a scripted probe cannot loop freely.
    skipFailedRequests: false,
  });

const HOUR_MS = 60 * 60 * 1000;

export const contactLimiter = limiter(
  HOUR_MS,
  env.RATE_LIMIT_CONTACT,
  'Too many messages sent from this connection. Please try again later, or call us directly.'
);

export const newsletterLimiter = limiter(
  HOUR_MS,
  env.RATE_LIMIT_NEWSLETTER,
  'Too many signup attempts. Please try again later.'
);

/**
 * Admin login. A bounded per-IP limiter, not a distributed account lockout —
 * counts every attempt (success or failure) so a scripted probe can't loop
 * freely, but doesn't track per-account state or reveal whether a given
 * email exists (that stays the login handler's job, via one generic error).
 */
export const adminLoginLimiter = limiter(
  15 * 60 * 1000,
  env.RATE_LIMIT_ADMIN_LOGIN,
  'Too many sign-in attempts. Please wait a few minutes and try again.'
);

/**
 * Admin change-password. Same window/threshold as login — this endpoint
 * still requires guessing the current password, so it's the same
 * brute-force surface for anyone holding a stolen but still-valid token.
 */
export const changePasswordLimiter = limiter(
  15 * 60 * 1000,
  env.RATE_LIMIT_ADMIN_LOGIN,
  'Too many password change attempts. Please wait a few minutes and try again.'
);

/**
 * Public analytics beacon (P4-G2). Unauthenticated and previously
 * unprotected — a single page load fires at most one of these, so this
 * threshold is generous relative to real browsing while still bounding a
 * scripted flood. Hardcoded (not env-configurable) — see P4-G2A.
 */
export const analyticsLimiter = limiter(
  5 * 60 * 1000,
  60,
  'Too many analytics requests. Please try again later.'
);

/**
 * Public conversion beacon (P4-G2). Unauthenticated and previously
 * unprotected — the only current caller fires this at most once per
 * successful Contact submission, so this threshold stays tight relative to
 * that naturally low legitimate volume. Hardcoded — see P4-G2A.
 */
export const conversionLimiter = limiter(
  60 * 60 * 1000,
  10,
  'Too many tracking requests. Please try again later.'
);

/**
 * Public marketing unsubscribe (P4-I3). Unauthenticated and low-stakes —
 * the worst a flood can do is repeatedly no-op an already-unsubscribed
 * contact (the operation is idempotent) — so, like analyticsLimiter/
 * conversionLimiter, this is a simple hardcoded per-IP bound rather than an
 * env-configurable one. Generous relative to a single real click: a shared
 * office/NAT IP could plausibly have several people unsubscribing the same
 * hour, and a mail client may retry a link-open once or twice.
 */
export const marketingUnsubscribeLimiter = limiter(
  60 * 60 * 1000,
  20,
  'Too many requests. Please try again later.'
);

/** Wraps async handlers so rejections reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    void fn(req, res, next).catch(next);
  };

/**
 * Blocks cross-origin requests from origins outside the allowlist.
 *
 * The CORS layer withholds its headers for unknown origins, which stops the
 * browser but still lets a direct (non-browser) caller reach the handler. This
 * closes that gap with an explicit 403.
 */
export const disallowedOrigin: RequestHandler = (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || corsOrigins.includes(origin)) {
    next();
    return;
  }
  logger.warn('Blocked request from disallowed origin', { origin });
  res.status(403).json({ success: false, message: 'Origin not permitted' });
};

/**
 * Converts body-parser failures (malformed JSON, payload too large) into
 * client errors. Without this Express reports them as 500s.
 */
export const jsonErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ success: false, message: 'Request body is not valid JSON.' });
    return;
  }
  if ((err as { type?: string })?.type === 'entity.too.large') {
    res.status(413).json({ success: false, message: 'Request body is too large.' });
    return;
  }
  next(err);
};

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ success: false, message: 'Not found' });
};

/**
 * Terminal error handler.
 *
 * Only messages explicitly marked safe are returned. Stack traces and internal
 * details never reach the client.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const id = (req as Request & { id?: string }).id ?? 'unknown';

  if (err instanceof AppError) {
    if (!err.expose) {
      logger.error('handled error', { id, status: err.status, reason: err.message });
    }
    res.status(err.status).json({
      success: false,
      message: err.expose
        ? err.message
        : 'Something went wrong on our end. Please try again shortly.',
      ...(err.fields ? { errors: err.fields } : {}),
    });
    return;
  }

  logger.error('unhandled error', {
    id,
    reason: err instanceof Error ? err.message : 'unknown',
    ...(isProduction ? {} : { stack: err instanceof Error ? err.stack : undefined }),
  });

  res.status(500).json({
    success: false,
    message: 'Something went wrong on our end. Please try again shortly.',
  });
};
