import type { RequestHandler, Router } from 'express';
import { Router as createRouter } from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase.js';
import { asyncHandler } from '../middleware/index.js';
import {
  requireAdmin,
  requirePermission,
  type AdminModule,
  type AuthedRequest,
} from '../middleware/adminAuth.js';
import { badRequest, notFound } from '../utils/errors.js';
import { diffChanges, recordLabel, writeAuditLog } from '../lib/audit.js';
import { refreshPublicSite } from '../lib/refreshSite.js';

function withoutOptionalMediaFields(payload: Record<string, unknown>) {
  const next = { ...payload };
  if (typeof next.image_url === 'string' && next.image_url && !next.icon) {
    next.icon = next.image_url;
  }
  delete next.image_url;
  delete next.category;
  return next;
}

type CrudOptions = {
  table: string;
  module: AdminModule;
  createSchema: z.ZodTypeAny;
  updateSchema: z.ZodTypeAny;
  orderBy?: { column: string; ascending?: boolean };
  beforeCreate?: (data: Record<string, unknown>) => Record<string, unknown>;
  beforeUpdate?: (data: Record<string, unknown>) => Record<string, unknown>;
};

export function createCrudRouter(options: CrudOptions): Router {
  const router = createRouter();
  const {
    table,
    module,
    createSchema,
    updateSchema,
    orderBy = { column: 'created_at', ascending: false },
    beforeCreate,
    beforeUpdate,
  } = options;

  const guard: RequestHandler[] = [requireAdmin, requirePermission(module)];

  router.get(
    '/',
    ...guard,
    asyncHandler(async (_req, res) => {
      const sb = getSupabase();
      let query = sb.from(table).select('*');
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? false });
      const { data, error } = await query;
      if (error) throw badRequest(error.message);
      res.json({ success: true, data });
    })
  );

  router.get(
    '/:id',
    ...guard,
    asyncHandler(async (req, res) => {
      const { data, error } = await getSupabase()
        .from(table)
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();
      if (error) throw badRequest(error.message);
      if (!data) throw notFound('Record not found.');
      res.json({ success: true, data });
    })
  );

  router.post(
    '/',
    ...guard,
    asyncHandler(async (req, res) => {
      const parsed = createSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest('Invalid payload.', Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join('.') || 'body', i.message])
        ));
      }
      let payload = parsed.data as Record<string, unknown>;
      if (beforeCreate) payload = beforeCreate(payload);
      if (module === 'testimonials') {
        const { published, consent_confirmed } = payload;
        if (published === true && consent_confirmed !== true) {
          throw badRequest('Published testimonials require consent_confirmed=true.');
        }
      }
      let { data, error } = await getSupabase().from(table).insert(payload).select('*').single();
      if (error && /does not exist|schema cache/i.test(error.message)) {
        const retry = await getSupabase().from(table).insert(withoutOptionalMediaFields(payload)).select('*').single();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw badRequest(error.message);
      const actor = (req as AuthedRequest).admin;
      await writeAuditLog({
        actor,
        action: 'create',
        resource: module,
        resourceId: data?.id ? String(data.id) : null,
        summary: `Created ${module}: ${recordLabel(data as Record<string, unknown>)}`,
      });
      void refreshPublicSite();
      res.status(201).json({ success: true, data });
    })
  );

  router.patch(
    '/:id',
    ...guard,
    asyncHandler(async (req, res) => {
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest('Invalid payload.', Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join('.') || 'body', i.message])
        ));
      }
      let payload: Record<string, unknown> = {
        ...(parsed.data as Record<string, unknown>),
        updated_at: new Date().toISOString(),
      };
      if (beforeUpdate) payload = beforeUpdate(payload);

      // Best-effort: read the prior row so the audit log can record exactly
      // which fields changed. Never blocks the update if it fails.
      const { data: before } = await getSupabase()
        .from(table)
        .select('*')
        .eq('id', req.params.id)
        .maybeSingle();

      if (module === 'testimonials') {
        const effective = { ...(before ?? {}), ...payload } as Record<string, unknown>;
        if (effective.published === true && effective.consent_confirmed !== true) {
          throw badRequest('Published testimonials require consent_confirmed=true.');
        }
      }

      let { data, error } = await getSupabase()
        .from(table)
        .update(payload)
        .eq('id', req.params.id)
        .select('*')
        .maybeSingle();
      if (error && /does not exist|schema cache/i.test(error.message)) {
        const retry = await getSupabase()
          .from(table)
          .update(withoutOptionalMediaFields(payload))
          .eq('id', req.params.id)
          .select('*')
          .maybeSingle();
        data = retry.data;
        error = retry.error;
      }
      if (error) throw badRequest(error.message);
      if (!data) throw notFound('Record not found.');
      const actor = (req as AuthedRequest).admin;
      const changes = diffChanges(before as Record<string, unknown> | null, payload);
      await writeAuditLog({
        actor,
        action: 'update',
        resource: module,
        resourceId: String(req.params.id),
        summary: `Updated ${module}: ${recordLabel(data as Record<string, unknown>)}`,
        meta: changes ? { changes, origin: { method: 'PATCH', endpoint: `/${table}/:id` } } : undefined,
      });
      void refreshPublicSite();
      res.json({ success: true, data });
    })
  );

  router.delete(
    '/:id',
    ...guard,
    asyncHandler(async (req, res) => {
      const { error } = await getSupabase().from(table).delete().eq('id', req.params.id);
      if (error) throw badRequest(error.message);
      const actor = (req as AuthedRequest).admin;
      await writeAuditLog({
        actor,
        action: 'delete',
        resource: module,
        resourceId: String(req.params.id),
        summary: `Deleted ${module} record`,
      });
      void refreshPublicSite();
      res.json({ success: true });
    })
  );

  return router;
}
