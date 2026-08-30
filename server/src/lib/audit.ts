import { getSupabase } from './supabase.js';
import type { AdminTokenPayload } from '../middleware/adminAuth.js';
import { logger } from '../utils/logger.js';
import { writeNotification } from './notify.js';

export type AuditInput = {
  actor?: Pick<AdminTokenPayload, 'sub' | 'email'> & { name?: string; role?: AdminTokenPayload['role'] };
  action: string;
  resource: string;
  resourceId?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
};

/**
 * Field names that must never be copied into audit metadata, regardless of
 * which table they come from — a defensive net for any current or future
 * CRUD resource, not a list tied to today's known schemas.
 */
const SENSITIVE_KEY_PATTERN =
  /password|passwd|token|secret|api[_-]?key|credential|authorization|private[_-]?key|hash/i;

/** Caps how much of any single value's stringified form lands in audit meta. */
const MAX_VALUE_CHARS = 500;

function summarize(value: unknown): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  const asString = typeof value === 'string' ? value : JSON.stringify(value);
  if (asString === undefined) return null;
  if (asString.length <= MAX_VALUE_CHARS) return typeof value === 'string' ? value : JSON.parse(asString);
  return `${asString.slice(0, MAX_VALUE_CHARS)}… (truncated, ${asString.length} chars total)`;
}

/**
 * Builds a `{ field: { from, to } }` diff between the row as it was before an
 * update and the payload actually written. Only fields present in `payload`
 * (excluding `ignoreKeys`) are considered, so omitted PATCH fields never
 * appear; fields whose value didn't actually change are dropped too. Any
 * field name matching `SENSITIVE_KEY_PATTERN` is redacted rather than
 * recorded, on any table.
 */
export function diffChanges(
  before: Record<string, unknown> | null | undefined,
  payload: Record<string, unknown>,
  ignoreKeys: string[] = ['updated_at']
): Record<string, { from: unknown; to: unknown }> | undefined {
  if (!before) return undefined;
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(payload)) {
    if (ignoreKeys.includes(key)) continue;
    const beforeValue = before[key] ?? null;
    const afterValue = payload[key] ?? null;
    const changed = JSON.stringify(beforeValue) !== JSON.stringify(afterValue);
    if (!changed) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      changes[key] = { from: '[redacted]', to: '[redacted]' };
      continue;
    }
    changes[key] = { from: summarize(beforeValue), to: summarize(afterValue) };
  }
  return Object.keys(changes).length ? changes : undefined;
}

/** Best-effort activity log. Must never block the primary request. */
export async function writeAuditLog(input: AuditInput): Promise<void> {
  try {
    const { error } = await getSupabase().from('admin_audit_logs').insert({
      actor_id: input.actor?.sub ?? null,
      actor_email: input.actor?.email ?? null,
      actor_name: input.actor?.name ?? input.actor?.email ?? null,
      action: input.action,
      resource: input.resource,
      resource_id: input.resourceId ?? null,
      summary: input.summary,
      meta: input.meta ?? {},
    });
    if (error) logger.info('audit skip', { message: error.message });
    if (input.action !== 'login' && input.actor?.role === 'staff') {
      await writeNotification({
        type: 'staff_action',
        audience: 'super_admin',
        title: input.summary,
        body: input.actor.email ? `${input.actor.email} · ${input.action} ${input.resource}` : input.action,
        href: '/logs',
      });
    }
  } catch (err) {
    logger.info('audit skip', { message: err instanceof Error ? err.message : 'unknown' });
  }
}

export function recordLabel(row: Record<string, unknown> | null | undefined): string {
  if (!row) return 'item';
  const value = row.title || row.name || row.question || row.slug || row.path || row.email || row.id;
  return String(value || 'item');
}
