import { isProduction } from '../config/env.js';

/**
 * Minimal structured logger with PHI redaction.
 *
 * The contact form can receive protected health information. Logging raw
 * submissions would copy that into log storage, which would drag the logging
 * stack into HIPAA scope. Message bodies and contact details are therefore
 * never logged — only non-identifying metadata.
 */

const REDACTED = '[redacted]';

/** Keys whose values must never reach the logs. */
const SENSITIVE = new Set([
  'message',
  'messages',
  'content',
  'name',
  'email',
  'phone',
  'subject',
  'body',
  'password',
  'authorization',
  'cookie',
  'token',
  'apikey',
  'api_key',
]);

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return REDACTED;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE.has(key.toLowerCase()) ? REDACTED : redact(val, depth + 1);
  }
  return out;
}

type Level = 'info' | 'warn' | 'error';

function emit(level: Level, message: string, meta?: Record<string, unknown>) {
  const entry = {
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };

  const line = isProduction ? JSON.stringify(entry) : `${entry.time} ${level.toUpperCase()} ${message}${meta ? ` ${JSON.stringify(redact(meta))}` : ''}`;

  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => emit('info', message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => emit('warn', message, meta),
  error: (message: string, meta?: Record<string, unknown>) => emit('error', message, meta),
};
