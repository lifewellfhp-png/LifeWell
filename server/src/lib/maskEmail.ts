/**
 * Masks an email-like string for safe display in a security log, keeping
 * only the first two characters of the local part. Used specifically for
 * the raw, unverified email a visitor typed on a failed login attempt
 * (handleAdminLogin's unknown-email/inactive-account branch) — that value
 * could in principle be a password pasted into the wrong field by mistake,
 * so nothing beyond this is ever shown. If the value doesn't even look like
 * an email (no '@', or nothing before it), it's fully masked rather than
 * partially revealed, since there's then no safe structure to preserve.
 */
export function maskEmail(value: string): string {
  const at = value.indexOf('@');
  if (at <= 0) return '***';
  const local = value.slice(0, at);
  const domain = value.slice(at);
  const visible = local.slice(0, 2);
  return `${visible}***${domain}`;
}
