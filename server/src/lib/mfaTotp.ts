import { authenticator } from 'otplib';

/**
 * otplib defaults (30s step, SHA1, 6 digits, ±1 step verification window)
 * are deliberately left unchanged — this is exactly what every standard
 * authenticator app (Google Authenticator, Authy, 1Password, etc.) assumes.
 */
const ISSUER = 'LifeWell Admin';

export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** otpauth:// URI for QR-code enrollment; also usable as manual-entry text. */
export function buildOtpAuthUri(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

export function verifyTotpCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch {
    return false;
  }
}
