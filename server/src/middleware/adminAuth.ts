import type { NextFunction, Request, Response, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { forbidden, unauthorized } from '../utils/errors.js';

export type AdminRole = 'super_admin' | 'staff';

export type AdminTokenPayload = {
  sub: string;
  email: string;
  role: AdminRole;
  permissions: string[];
};

export type AuthedRequest = Request & {
  admin?: AdminTokenPayload;
};

const ALL_MODULES = [
  'leads',
  'announcements',
  'services',
  'providers',
  'insurance',
  'testimonials',
  'faqs',
  'locations',
  'telehealth_states',
  'blog',
  'media',
  'videos',
  'sections',
  'booking',
  'seo',
  'analytics',
  'users',
  'emails',
  'settings',
] as const;

export type AdminModule = (typeof ALL_MODULES)[number];

export function signAdminToken(payload: AdminTokenPayload): string {
  return jwt.sign(payload, env.ADMIN_JWT_SECRET, { expiresIn: '30d' });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  return jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminTokenPayload;
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Sign in required.'));
    return;
  }
  try {
    const payload = verifyAdminToken(header.slice(7));
    (req as AuthedRequest).admin = payload;
    next();
  } catch {
    next(unauthorized('Session expired. Please sign in again.'));
  }
};

export function requirePermission(module: AdminModule): RequestHandler {
  return requireAnyPermission([module]);
}

export function requireAnyPermission(modules: AdminModule[]): RequestHandler {
  return (req, _res, next) => {
    const admin = (req as AuthedRequest).admin;
    if (!admin) {
      next(unauthorized('Sign in required.'));
      return;
    }
    if (admin.role === 'super_admin') {
      next();
      return;
    }
    if (admin.permissions.includes('*') || modules.some((module) => admin.permissions.includes(module))) {
      next();
      return;
    }
    next(forbidden('You do not have permission for this module.'));
  };
}

export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): void {
  const admin = (req as AuthedRequest).admin;
  if (!admin || admin.role !== 'super_admin') {
    next(forbidden('Super admin access required.'));
    return;
  }
  next();
}

export { ALL_MODULES };
