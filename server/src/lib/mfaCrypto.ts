import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { env } from '../config/env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

function getKey(): Buffer {
  if (!env.MFA_ENCRYPTION_KEY) {
    throw new Error('MFA_ENCRYPTION_KEY is not configured.');
  }
  const key = Buffer.from(env.MFA_ENCRYPTION_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error('MFA_ENCRYPTION_KEY must decode to exactly 32 bytes (base64 of an AES-256 key).');
  }
  return key;
}

/** iv.authTag.ciphertext, each base64 — a self-contained, parseable format. */
export function encryptMfaSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
}

export function decryptMfaSecret(stored: string): string {
  const parts = stored.split('.');
  if (parts.length !== 3) throw new Error('Malformed encrypted MFA secret.');
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivB64 as string, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64 as string, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataB64 as string, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
