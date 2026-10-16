import type { Request, Response } from 'express';
import { z } from 'zod';
import { getSupabase } from '../lib/supabase.js';
import { badRequest } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { writeAuditLog, recordLabel } from '../lib/audit.js';
import type { AuthedRequest } from '../middleware/adminAuth.js';

const BUCKET = 'media';

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  alt_text: z.string().max(500).optional().nullable(),
  folder: z.string().max(80).default('general'),
  filename: z.string().min(1).max(200),
  mime_type: z.string().min(3).max(120),
  /** Base64 payload without data: URL prefix. Max ~4MB decoded. */
  content_base64: z.string().min(1).max(6_000_000),
});

async function ensureBucket(): Promise<void> {
  const sb = getSupabase();
  const { data: buckets } = await sb.storage.listBuckets();
  if (buckets?.some((b) => b.name === BUCKET)) return;
  const { error } = await sb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 4 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/svg+xml'],
  });
  if (error && !/already exists/i.test(error.message)) {
    throw badRequest(`Could not create media bucket: ${error.message}`);
  }
}

export async function handleMediaUpload(req: Request, res: Response): Promise<void> {
  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid upload payload.');

  const { title, alt_text, folder, filename, mime_type, content_base64 } = parsed.data;
  if (!mime_type.startsWith('image/')) {
    throw badRequest('Only image uploads are allowed.');
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(content_base64, 'base64');
  } catch {
    throw badRequest('Invalid file encoding.');
  }
  if (buffer.length > 4 * 1024 * 1024) {
    throw badRequest('File is too large (max 4 MB).');
  }

  await ensureBucket();

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;
  const sb = getSupabase();

  const { error: uploadError } = await sb.storage.from(BUCKET).upload(path, buffer, {
    contentType: mime_type,
    upsert: false,
  });
  if (uploadError) throw badRequest(uploadError.message);

  const { data: publicData } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = publicData.publicUrl;

  const { data, error } = await sb
    .from('media_assets')
    .insert({
      title,
      url,
      alt_text: alt_text ?? null,
      mime_type,
      folder,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('media row insert failed', { reason: error.message });
    throw badRequest(error.message);
  }

  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'create',
    resource: 'media',
    resourceId: data?.id ? String(data.id) : null,
    summary: `Uploaded media: ${recordLabel(data as Record<string, unknown>)}`,
  });

  res.status(201).json({ success: true, data });
}
