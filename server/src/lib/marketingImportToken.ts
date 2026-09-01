import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { MarketingAudienceType, MarketingSource, MarketingStatus } from '../validation/adminSchemas.js';

/**
 * Signs/verifies the short-lived preview token that bridges CSV import's two
 * stages (P4-I2E). Reuses ADMIN_JWT_SECRET — already a boot-validated,
 * >=32-char secret used to sign real admin sessions — rather than inventing
 * a second secret. Deliberately NOT built on signAdminToken/verifyAdminToken
 * (middleware/adminAuth.ts): the payload shape here has no `sub`/`role`/
 * `permissions`/`tv`, and carries a `type` claim those tokens never set, so
 * a token from one scheme can never be mistaken for the other — an import
 * preview token fed into requireAdmin fails safely (no `sub` to look up),
 * and an admin session token fed into verifyImportPreviewToken fails the
 * `type` check.
 */

const TOKEN_TYPE = 'marketing_contacts_import_preview';

/** Suggested range was 10-30 minutes; 20 balances a real admin review pause against limiting the exposure window of a captured token. */
export const PREVIEW_TOKEN_TTL_MINUTES = 20;

export type ImportPreviewRow = {
  email: string;
  first_name: string | null;
  last_name: string | null;
  audience_type: MarketingAudienceType;
  marketing_status: MarketingStatus;
  consent_source: MarketingSource | null;
};

export type ImportPreviewTokenPayload = {
  type: typeof TOKEN_TYPE;
  adminId: string;
  rows: ImportPreviewRow[];
};

export function signImportPreviewToken(input: { adminId: string; rows: ImportPreviewRow[] }): string {
  const payload: ImportPreviewTokenPayload = { type: TOKEN_TYPE, adminId: input.adminId, rows: input.rows };
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: `${PREVIEW_TOKEN_TTL_MINUTES}m`,
  });
}

/** Throws (jwt's own TokenExpiredError/JsonWebTokenError, or a plain Error for a type mismatch) on any invalid, tampered, or expired token. */
export function verifyImportPreviewToken(token: string): ImportPreviewTokenPayload {
  // Explicitly restricts accepted algorithms rather than trusting the
  // token header — same defense-in-depth choice as verifyAdminToken.
  const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET, { algorithms: ['HS256'] }) as ImportPreviewTokenPayload;
  if (decoded.type !== TOKEN_TYPE) {
    throw new Error('Not a marketing contacts import preview token.');
  }
  return decoded;
}
