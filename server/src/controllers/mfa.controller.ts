import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import qrcode from 'qrcode';
import { getSupabase } from '../lib/supabase.js';
import { AppError, badRequest, unauthorized } from '../utils/errors.js';
import { mfaConfigured } from '../config/env.js';
import { encryptMfaSecret, decryptMfaSecret } from '../lib/mfaCrypto.js';
import { generateTotpSecret, buildOtpAuthUri, verifyTotpCode } from '../lib/mfaTotp.js';
import { generateRecoveryCodes, matchRecoveryCode } from '../lib/mfaRecoveryCodes.js';
import { mfaSetupVerifySchema, mfaDisableSchema, mfaLoginVerifySchema } from '../validation/adminSchemas.js';
import { fieldErrors } from '../validation/schemas.js';
import {
  signAdminToken,
  verifyMfaPendingToken,
  type AdminRole,
  type AuthedRequest,
} from '../middleware/adminAuth.js';
import { writeAuditLog } from '../lib/audit.js';
import { logger } from '../utils/logger.js';

function mfaNotConfiguredError(): AppError {
  return new AppError(
    'MFA is not configured on this server yet. An administrator must set MFA_ENCRYPTION_KEY first.',
    503,
    { expose: true }
  );
}

export async function handleMfaStatus(req: Request, res: Response): Promise<void> {
  const admin = (req as AuthedRequest).admin;
  if (!admin) throw unauthorized('Sign in required.');

  const { data, error } = await getSupabase()
    .from('admin_users')
    .select('mfa_enabled, mfa_enrolled_at')
    .eq('id', admin.sub)
    .maybeSingle();
  if (error) throw badRequest(error.message);

  res.json({
    success: true,
    data: { enabled: Boolean(data?.mfa_enabled), enrolledAt: data?.mfa_enrolled_at ?? null },
  });
}

/**
 * Starts (or restarts) enrollment: generates a brand-new secret and
 * recovery-code batch and stores them, but leaves mfa_enabled=false until
 * handleMfaSetupVerify confirms the admin can actually produce a valid code
 * from it. Calling this again before verifying simply replaces the pending
 * secret/codes — nothing live depends on them yet, so there's no harm in
 * overwriting.
 */
export async function handleMfaSetupStart(req: Request, res: Response): Promise<void> {
  const admin = (req as AuthedRequest).admin;
  if (!admin) throw unauthorized('Sign in required.');
  if (!mfaConfigured) throw mfaNotConfiguredError();

  const secret = generateTotpSecret();
  const { plaintext: recoveryCodes, hashes } = await generateRecoveryCodes();

  const sb = getSupabase();
  const { error: updateError } = await sb
    .from('admin_users')
    .update({ mfa_secret_encrypted: encryptMfaSecret(secret), mfa_enabled: false, mfa_enrolled_at: null })
    .eq('id', admin.sub);
  if (updateError) throw badRequest(updateError.message);

  // A restarted enrollment must never leave a stale prior batch active
  // alongside the new one.
  await sb.from('admin_mfa_recovery_codes').delete().eq('admin_user_id', admin.sub);
  const { error: codesError } = await sb
    .from('admin_mfa_recovery_codes')
    .insert(hashes.map((code_hash) => ({ admin_user_id: admin.sub, code_hash })));
  if (codesError) throw badRequest(codesError.message);

  const otpAuthUri = buildOtpAuthUri(admin.email, secret);
  const qrCodeDataUri = await qrcode.toDataURL(otpAuthUri);

  res.json({
    success: true,
    data: { secret, otpAuthUri, qrCodeDataUri, recoveryCodes },
  });
}

export async function handleMfaSetupVerify(req: Request, res: Response): Promise<void> {
  const admin = (req as AuthedRequest).admin;
  if (!admin) throw unauthorized('Sign in required.');

  const parsed = mfaSetupVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Please correct the highlighted fields and try again.', fieldErrors(parsed.error));
  }

  const { data: user, error } = await getSupabase()
    .from('admin_users')
    .select('mfa_secret_encrypted')
    .eq('id', admin.sub)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!user?.mfa_secret_encrypted) throw badRequest('Start MFA setup first.');

  const secret = decryptMfaSecret(user.mfa_secret_encrypted as string);
  if (!verifyTotpCode(secret, parsed.data.code)) {
    throw unauthorized('That code is incorrect or has expired. Try the latest code from your app.');
  }

  const { error: updateError } = await getSupabase()
    .from('admin_users')
    .update({ mfa_enabled: true, mfa_enrolled_at: new Date().toISOString() })
    .eq('id', admin.sub);
  if (updateError) throw badRequest(updateError.message);

  logger.info('admin mfa enrolled', { role: admin.role });
  await writeAuditLog({
    actor: admin,
    action: 'mfa_enroll',
    resource: 'auth',
    resourceId: admin.sub,
    summary: `${admin.email} enabled two-factor authentication`,
  });

  res.json({ success: true });
}

export async function handleMfaDisable(req: Request, res: Response): Promise<void> {
  const admin = (req as AuthedRequest).admin;
  if (!admin) throw unauthorized('Sign in required.');

  const parsed = mfaDisableSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Please correct the highlighted fields and try again.', fieldErrors(parsed.error));
  }

  const { data: user, error } = await getSupabase()
    .from('admin_users')
    .select('password_hash')
    .eq('id', admin.sub)
    .maybeSingle();
  if (error) throw badRequest(error.message);
  if (!user) throw unauthorized('Account inactive.');

  const ok = await bcrypt.compare(parsed.data.current_password, user.password_hash);
  if (!ok) throw unauthorized('Current password is incorrect.');

  const sb = getSupabase();
  const { error: updateError } = await sb
    .from('admin_users')
    .update({ mfa_enabled: false, mfa_secret_encrypted: null, mfa_enrolled_at: null })
    .eq('id', admin.sub);
  if (updateError) throw badRequest(updateError.message);
  await sb.from('admin_mfa_recovery_codes').delete().eq('admin_user_id', admin.sub);

  logger.info('admin mfa disabled', { role: admin.role });
  await writeAuditLog({
    actor: admin,
    action: 'mfa_disable',
    resource: 'auth',
    resourceId: admin.sub,
    summary: `${admin.email} disabled two-factor authentication`,
  });

  res.json({ success: true });
}

/**
 * Step 2 of login for an account with MFA enabled. Exchanges the short-lived
 * mfa-pending token (from handleAdminLogin) plus a TOTP or recovery code for
 * a real session — same response shape as a non-MFA successful login.
 * last_login_at and the 'login' audit entry are written here, not in
 * handleAdminLogin, since this is the point sign-in actually completes.
 */
export async function handleMfaLoginVerify(req: Request, res: Response): Promise<void> {
  const parsed = mfaLoginVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Please correct the highlighted fields and try again.', fieldErrors(parsed.error));
  }

  let pending;
  try {
    pending = verifyMfaPendingToken(parsed.data.mfa_token);
  } catch {
    throw unauthorized('Your sign-in attempt expired. Please sign in again.');
  }

  const sb = getSupabase();
  const { data: user, error } = await sb.from('admin_users').select('*').eq('id', pending.sub).maybeSingle();
  if (error) throw badRequest(error.message);
  if (!user || !user.active || !user.mfa_enabled) {
    throw unauthorized('Your sign-in attempt expired. Please sign in again.');
  }

  let verified = false;
  let usedRecoveryCode = false;
  if (parsed.data.code) {
    // decryptMfaSecret throws if MFA_ENCRYPTION_KEY is missing, has changed
    // since enrollment, or the stored value is corrupted — a server
    // configuration problem, not the admin's fault. Left uncaught, this
    // would surface as a generic 500 with no indication of what's actually
    // wrong. Caught here so the account's owner (and whoever's checking
    // Logs) gets a clear signal instead — see README.md's "Locked out of
    // admin" section for the manual recovery path.
    let secret: string;
    try {
      secret = decryptMfaSecret(user.mfa_secret_encrypted as string);
    } catch (err) {
      logger.error('mfa secret decryption failed', { reason: err instanceof Error ? err.message : 'unknown' });
      await writeAuditLog({
        actor: { sub: user.id, email: user.email, name: user.name, role: user.role as AdminRole },
        action: 'mfa_decryption_failed',
        resource: 'auth',
        resourceId: user.id,
        summary: `MFA secret decryption failed for ${user.email} — MFA_ENCRYPTION_KEY may be missing or changed since enrollment`,
      });
      throw new AppError(
        'Two-factor verification is temporarily unavailable due to a server configuration issue. Please contact an administrator.',
        503,
        { expose: true }
      );
    }
    verified = verifyTotpCode(secret, parsed.data.code);
  } else if (parsed.data.recovery_code) {
    const { data: codes, error: codesError } = await sb
      .from('admin_mfa_recovery_codes')
      .select('id, code_hash, used_at')
      .eq('admin_user_id', user.id);
    if (codesError) throw badRequest(codesError.message);
    const matchedId = await matchRecoveryCode(parsed.data.recovery_code, codes ?? []);
    if (matchedId) {
      await sb.from('admin_mfa_recovery_codes').update({ used_at: new Date().toISOString() }).eq('id', matchedId);
      verified = true;
      usedRecoveryCode = true;
    }
  }

  if (!verified) {
    // Never records the submitted code/recovery_code value — only which
    // method was attempted. Excluded from the staff-action notification
    // spam (writeAuditLog's own filter) — same "routine, high-frequency,
    // already rate-limited by mfaVerifyLimiter" reasoning as login_failed.
    await writeAuditLog({
      actor: { sub: user.id, email: user.email, name: user.name, role: user.role as AdminRole },
      action: 'mfa_verify_failed',
      resource: 'auth',
      resourceId: user.id,
      summary: `Failed MFA verification attempt for ${user.email}`,
      meta: { method: parsed.data.recovery_code ? 'recovery_code' : 'totp' },
    });
    throw unauthorized('That code is incorrect.');
  }

  const token = signAdminToken({
    sub: user.id,
    email: user.email,
    role: user.role as AdminRole,
    permissions: (user.permissions as string[]) ?? [],
    tv: (user.token_version as number | null) ?? 0,
  });

  await sb.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

  /**
   * A recovery-code login gets its own distinct action — recovery codes are
   * single-use, emergency-only credentials, so this account having just used
   * one is itself worth flagging (e.g. the authenticator device may be
   * lost), not just folded silently into a generic 'login' entry. A normal
   * TOTP-completed login still records as plain 'login', unchanged.
   */
  logger.info('admin login', { role: user.role, via: usedRecoveryCode ? 'recovery_code' : 'totp' });
  await writeAuditLog({
    actor: { sub: user.id, email: user.email, name: user.name },
    action: usedRecoveryCode ? 'mfa_recovery_code_used' : 'login',
    resource: 'auth',
    resourceId: user.id,
    summary: usedRecoveryCode ? `${user.name} signed in using a recovery code` : `${user.name} signed in`,
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
