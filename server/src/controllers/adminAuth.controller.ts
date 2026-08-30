import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../lib/supabase.js';
import {
  signAdminToken,
  type AdminRole,
  type AuthedRequest,
} from '../middleware/adminAuth.js';
import { loginSchema, adminUserCreate, adminUserUpdate, sendCredentialsSchema } from '../validation/adminSchemas.js';
import { badRequest, unauthorized, notFound } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { writeAuditLog } from '../lib/audit.js';
import { sendOutboundMail } from '../services/email.service.js';
import { env } from '../config/env.js';

export async function handleAdminLogin(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Email and password are required.');

  const email = parsed.data.email.toLowerCase().trim();
  const { data: user, error } = await getSupabase()
    .from('admin_users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!user || !user.active) throw unauthorized('Invalid email or password.');

  const ok = await bcrypt.compare(parsed.data.password, user.password_hash);
  if (!ok) throw unauthorized('Invalid email or password.');

  const token = signAdminToken({
    sub: user.id,
    email: user.email,
    role: user.role as AdminRole,
    permissions: (user.permissions as string[]) ?? [],
  });

  await getSupabase()
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  logger.info('admin login', { role: user.role });
  await writeAuditLog({
    actor: { sub: user.id, email: user.email, name: user.name },
    action: 'login',
    resource: 'auth',
    resourceId: user.id,
    summary: `${user.name} signed in`,
  });

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    },
  });
}

export async function handleAdminMe(req: Request, res: Response): Promise<void> {
  const admin = (req as AuthedRequest).admin;
  if (!admin) throw unauthorized('Sign in required.');

  const { data: user, error } = await getSupabase()
    .from('admin_users')
    .select('id, email, name, role, permissions, active, last_login_at, created_at')
    .eq('id', admin.sub)
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!user || !user.active) throw unauthorized('Account inactive.');

  res.json({ success: true, data: user });
}

export async function listAdminUsers(_req: Request, res: Response): Promise<void> {
  const { data, error } = await getSupabase()
    .from('admin_users')
    .select('id, email, name, role, permissions, active, last_login_at, created_at')
    .order('created_at', { ascending: true });
  if (error) throw badRequest(error.message);
  res.json({ success: true, data });
}

export async function createAdminUser(req: Request, res: Response): Promise<void> {
  const parsed = adminUserCreate.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid user payload.');

  const password_hash = await bcrypt.hash(parsed.data.password, 12);
  const { data, error } = await getSupabase()
    .from('admin_users')
    .insert({
      email: parsed.data.email.toLowerCase().trim(),
      name: parsed.data.name,
      role: 'staff',
      permissions: parsed.data.permissions,
      active: parsed.data.active,
      password_hash,
    })
    .select('id, email, name, role, permissions, active, created_at')
    .single();

  if (error) throw badRequest(error.message);
  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'create',
    resource: 'users',
    resourceId: data.id,
    summary: `Created sub-admin ${data.name} (${data.email})`,
  });

  let invite: { delivered: boolean; error?: string } | null = null;
  if (req.body?.send_invite === true) {
    invite = await emailStaffCredentials({
      name: data.name,
      email: data.email,
      password: parsed.data.password,
      adminUrl: typeof req.body.admin_url === 'string' ? req.body.admin_url : undefined,
    });
  }

  res.status(201).json({ success: true, data, invite });
}

export async function updateAdminUser(req: Request, res: Response): Promise<void> {
  const parsed = adminUserUpdate.safeParse(req.body);
  if (!parsed.success) throw badRequest('Invalid user payload.');

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.active === false) {
    const { data: target } = await getSupabase()
      .from('admin_users')
      .select('role')
      .eq('id', req.params.id)
      .maybeSingle();
    if (target?.role === 'super_admin') {
      throw badRequest('Super Admin accounts cannot be blocked.');
    }
  }
  if (parsed.data.email) patch.email = parsed.data.email.toLowerCase().trim();
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.permissions !== undefined) patch.permissions = parsed.data.permissions;
  if (parsed.data.active !== undefined) patch.active = parsed.data.active;
  if (parsed.data.password) patch.password_hash = await bcrypt.hash(parsed.data.password, 12);

  const { data, error } = await getSupabase()
    .from('admin_users')
    .update(patch)
    .eq('id', req.params.id)
    .select('id, email, name, role, permissions, active, last_login_at, created_at')
    .maybeSingle();

  if (error) throw badRequest(error.message);
  if (!data) throw notFound('User not found.');
  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: parsed.data.password ? 'reset_password' : 'update',
    resource: 'users',
    resourceId: data.id,
    summary: parsed.data.password
      ? `Reset password for ${data.name} (${data.email})`
      : `Updated sub-admin ${data.name} (${data.email})`,
  });
  res.json({ success: true, data });
}

export async function deleteAdminUser(req: Request, res: Response): Promise<void> {
  const admin = (req as AuthedRequest).admin;
  if (admin?.sub === req.params.id) {
    throw badRequest('You cannot delete your own account.');
  }

  const { data: target, error: lookupError } = await getSupabase()
    .from('admin_users')
    .select('id, email, name, role')
    .eq('id', req.params.id)
    .maybeSingle();
  if (lookupError) throw badRequest(lookupError.message);
  if (!target) throw notFound('User not found.');
  if (target.role === 'super_admin') {
    throw badRequest('Super Admin accounts cannot be deleted from this panel.');
  }

  const { error } = await getSupabase().from('admin_users').delete().eq('id', req.params.id);
  if (error) throw badRequest(error.message);
  await writeAuditLog({
    actor: admin,
    action: 'delete',
    resource: 'users',
    resourceId: target.id,
    summary: `Deleted sub-admin ${target.name} (${target.email})`,
  });
  res.json({ success: true });
}

function generateTemporaryPassword(): string {
  return `Lw-${randomBytes(5).toString('hex')}!`;
}

async function emailStaffCredentials(input: {
  name: string;
  email: string;
  password: string;
  adminUrl?: string;
}): Promise<{ delivered: boolean; error?: string }> {
  const signInUrl = input.adminUrl || 'https://lifewellfhp-admin.vercel.app/login';
  const text = [
    `Dear ${input.name},`,
    ``,
    `A website Control Center account has been created for you at LifeWell Family Health & Psychiatry.`,
    ``,
    `Sign in: ${signInUrl}`,
    `Email: ${input.email}`,
    `Temporary password: ${input.password}`,
    ``,
    `Please sign in and change this password after your first visit.`,
    `This access is for website content only. Do not use it for patient records or clinical information.`,
    ``,
    `Kind regards,`,
    `LifeWell Family Health & Psychiatry`,
    env.CONTACT_EMAIL,
  ].join('\n');

  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;color:#374151;line-height:1.65;max-width:560px">
      <p style="margin:0 0 16px">Dear ${escapeHtml(input.name)},</p>
      <p>A website Control Center account has been created for you at <strong>LifeWell Family Health &amp; Psychiatry</strong>.</p>
      <table cellpadding="0" cellspacing="0" style="margin:20px 0;border-collapse:collapse">
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Sign in</td><td style="padding:6px 0"><a href="${escapeHtml(signInUrl)}">${escapeHtml(signInUrl)}</a></td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Email</td><td style="padding:6px 0">${escapeHtml(input.email)}</td></tr>
        <tr><td style="padding:6px 16px 6px 0;color:#5b6675">Temporary password</td><td style="padding:6px 0"><strong>${escapeHtml(input.password)}</strong></td></tr>
      </table>
      <p>Please sign in and change this password after your first visit. This access is for website content only and must never be used for patient records or clinical information.</p>
      <p style="margin-top:24px">Kind regards,<br/>LifeWell Family Health &amp; Psychiatry</p>
    </div>
  `;

  return sendOutboundMail({
    to: input.email,
    toName: input.name,
    subject: 'Your LifeWell website Control Center access',
    body: text,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendStaffCredentials(req: Request, res: Response): Promise<void> {
  const parsed = sendCredentialsSchema.safeParse(req.body || {});
  if (!parsed.success) throw badRequest('Invalid invite payload.');

  const { data: target, error } = await getSupabase()
    .from('admin_users')
    .select('id, email, name, role, active')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!target) throw notFound('User not found.');
  if (target.role === 'super_admin') {
    throw badRequest('Super Admin credentials are not emailed from this panel.');
  }

  const password = parsed.data.password || generateTemporaryPassword();
  const password_hash = await bcrypt.hash(password, 12);
  const { error: updateError } = await getSupabase()
    .from('admin_users')
    .update({ password_hash, updated_at: new Date().toISOString() })
    .eq('id', target.id);
  if (updateError) throw badRequest(updateError.message);

  const invite = await emailStaffCredentials({
    name: target.name,
    email: target.email,
    password,
    adminUrl: parsed.data.admin_url,
  });

  const actor = (req as AuthedRequest).admin;
  await writeAuditLog({
    actor,
    action: 'reset_password',
    resource: 'users',
    resourceId: target.id,
    summary: `Emailed Control Center login details to ${target.name} (${target.email})`,
  });

  res.json({
    success: true,
    data: { delivered: invite.delivered, email: target.email },
    message: invite.delivered
      ? `Login details were emailed to ${target.email}.`
      : invite.error || 'The account was updated but the email could not be sent.',
  });
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 80;
  const { data, error } = await getSupabase()
    .from('admin_audit_logs')
    .select('id, actor_email, actor_name, action, resource, resource_id, summary, meta, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw badRequest(error.message);
  res.json({ success: true, data });
}
