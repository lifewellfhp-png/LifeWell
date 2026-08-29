import type { Request, Response } from 'express';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import { DEFAULT_SITE_SETTINGS, settingsUpdate } from '../validation/adminSchemas.js';
import { writeAuditLog } from '../lib/audit.js';
import { isMissingTable } from '../lib/notify.js';
import { refreshPublicSite } from '../lib/refreshSite.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';

export async function getSiteSettings(_req: Request, res: Response): Promise<void> {
  const { data, error } = await getSupabase()
    .from('site_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      res.json({ success: true, data: DEFAULT_SITE_SETTINGS });
      return;
    }
    throw badRequest(error.message);
  }

  res.json({ success: true, data: data ?? DEFAULT_SITE_SETTINGS });
}

export async function updateSiteSettings(req: Request, res: Response): Promise<void> {
  const parsed = settingsUpdate.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid site settings.');

  // Zod omits keys the caller didn't send, so spreading parsed.data already
  // gives true PATCH semantics for every field — an omitted key here never
  // reaches the upsert payload, so Supabase leaves that column untouched.
  // practice_email/inbox_email are the one exception: '' is an intentional
  // "clear this field" value (see the schema's z.literal('') branch), which
  // only makes sense to normalize to null when the caller actually sent the
  // field — normalizing an *omitted* field would wrongly clear it.
  const payload: Record<string, unknown> = {
    id: 'default',
    ...parsed.data,
    updated_at: new Date().toISOString(),
  };
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'practice_email')) {
    payload.practice_email = parsed.data.practice_email || null;
  }
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'inbox_email')) {
    payload.inbox_email = parsed.data.inbox_email || null;
  }

  const { data, error } = await getSupabase()
    .from('site_settings')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single();

  if (error) {
    if (isMissingTable(error) || /inbox_email/i.test(error.message)) {
      const { inbox_email: _ignored, ...rest } = payload as Record<string, unknown>;
      const retry = await getSupabase().from('site_settings').upsert(rest, { onConflict: 'id' }).select('*').single();
      if (retry.error) {
        if (isMissingTable(retry.error)) {
          throw badRequest('Run server/supabase/ops.sql in Supabase before saving appearance settings.');
        }
        throw badRequest(retry.error.message);
      }
      res.json({ success: true, data: retry.data });
      void refreshPublicSite();
      return;
    }
    throw badRequest(error.message);
  }

  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'update',
    resource: 'settings',
    resourceId: 'default',
    summary: 'Updated site appearance and header settings',
  });

  void refreshPublicSite();
  res.json({ success: true, data });
}
