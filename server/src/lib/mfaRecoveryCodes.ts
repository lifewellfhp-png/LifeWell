import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';

const RECOVERY_CODE_COUNT = 10;

/** XXXX-XXXX, uppercase hex — easy to read and type once, never shown again. */
function generateOneCode(): string {
  const hex = randomBytes(4).toString('hex').toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Cost 10, not password_hash's 12 — these are already high-entropy random
 * tokens (32 bits from crypto.randomBytes, not a human-chosen passphrase),
 * so a lower bcrypt cost loses no meaningful security margin while keeping
 * a 10-code enrollment batch fast enough for a single request (10 parallel
 * hashes at cost 12 measured ~10s on this hardware vs ~0.7s at cost 10).
 */
const RECOVERY_CODE_BCRYPT_COST = 10;

/** Plaintext codes (show once to the admin) and their bcrypt hashes (persist, never the plaintext). */
export async function generateRecoveryCodes(): Promise<{ plaintext: string[]; hashes: string[] }> {
  const plaintext = Array.from({ length: RECOVERY_CODE_COUNT }, generateOneCode);
  const hashes = await Promise.all(plaintext.map((code) => bcrypt.hash(code, RECOVERY_CODE_BCRYPT_COST)));
  return { plaintext, hashes };
}

/**
 * Finds the first not-yet-used stored code whose hash matches the candidate.
 * Returns its id so the caller can mark exactly that one used (each code is
 * single-use), or null if none match.
 */
export async function matchRecoveryCode(
  candidate: string,
  stored: Array<{ id: string; code_hash: string; used_at: string | null }>
): Promise<string | null> {
  const normalized = candidate.trim().toUpperCase();
  for (const row of stored) {
    if (row.used_at) continue;
    if (await bcrypt.compare(normalized, row.code_hash)) return row.id;
  }
  return null;
}
