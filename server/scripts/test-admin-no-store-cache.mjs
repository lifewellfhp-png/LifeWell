/**
 * Regression tests for P4-G4B1 (centralized Cache-Control: no-store on the
 * entire /api/admin namespace).
 *
 * Two layers, following this codebase's established convention (see
 * test-change-password-crypto.mjs) of testing real production code without
 * a live Supabase connection:
 *
 *   1. Behavioral tests mount the REAL adminRouter (imported directly from
 *      admin.routes.js, not a copy) with the REAL errorHandler, and hit it
 *      over HTTP for every case reachable WITHOUT Supabase being
 *      configured: missing auth, malformed/wrong-algorithm tokens, and
 *      unknown routes. No SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY is set in
 *      this environment (confirmed — matches every other test file here),
 *      so any code path that actually calls getSupabase() (a real login
 *      attempt, requireAdmin's DB check, any controller's query) throws
 *      "Supabase is not configured" and surfaces as a 500 via the same
 *      real errorHandler — which is still a real response from the real
 *      router, still proving the header is present regardless of outcome.
 *
 *   2. For the specific claim "a genuinely SUCCESSFUL login/me/change-
 *      password/read/write response also carries no-store" — which
 *      requires a live Supabase round-trip this environment doesn't have —
 *      a small representative stub app reproduces the exact same
 *      registration pattern (the identical middleware, registered before
 *      any route) in front of stub 200 handlers standing in for those
 *      success responses. This proves the middleware is unconditional
 *      (registered before ANY route, so it cannot distinguish success from
 *      failure) rather than re-testing business logic already covered
 *      elsewhere (P4-G4A's revocation tests, test-change-password-crypto.mjs).
 *
 * No live Supabase connection, no real Production credentials, no
 * token/secret values printed.
 *
 *   ADMIN_JWT_SECRET=test-only-admin-jwt-secret-not-for-production-000000 \
 *     npx tsx --test scripts/test-admin-no-store-cache.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { adminRouter } from '../src/routes/admin.routes.js';
import { errorHandler, notFoundHandler } from '../src/middleware/index.js';
import { getPublicContent, getPublicBlogPost } from '../src/controllers/publicContent.controller.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const adminRoutesSource = readFileSync(join(root, 'src/routes/admin.routes.ts'), 'utf8');
const SECRET = process.env.ADMIN_JWT_SECRET;

function startRealAdminApp() {
  return new Promise((resolve) => {
    const app = express();
    app.use(express.json());
    app.use('/api/admin', adminRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
    const server = app.listen(0, () => resolve(server));
  });
}

async function get(port, path, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
  return { status: res.status, cacheControl: res.headers.get('cache-control') };
}

async function post(port, path, body, headers = {}) {
  const res = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, cacheControl: res.headers.get('cache-control') };
}

// --- 1. Source structure: registered before any route ----------------------

test('1. adminRouter source registers the no-store middleware before any route definition', () => {
  const middlewareIndex = adminRoutesSource.indexOf("res.setHeader('Cache-Control', 'no-store')");
  const firstRouteIndex = adminRoutesSource.indexOf("adminRouter.post('/auth/login'");
  assert.ok(middlewareIndex > -1, 'expected the no-store middleware to exist');
  assert.ok(firstRouteIndex > -1, 'expected to find the login route registration');
  assert.ok(middlewareIndex < firstRouteIndex, 'middleware must be registered before the first route');
});

test('14. the header value is exactly "no-store" (no extra directives)', () => {
  const match = adminRoutesSource.match(/res\.setHeader\('Cache-Control',\s*'([^']+)'\)/);
  assert.ok(match, 'expected to find the setHeader call');
  assert.equal(match[1], 'no-store');
});

test('5. Do-not-add check: no Pragma, Expires, or Vary:Authorization header calls introduced, and the Cache-Control value carries no extra directives', () => {
  assert.doesNotMatch(adminRoutesSource, /setHeader\(\s*'Pragma'/);
  assert.doesNotMatch(adminRoutesSource, /setHeader\(\s*'Expires'/);
  assert.doesNotMatch(adminRoutesSource, /setHeader\(\s*'Vary'/);
  // Scoped to the actual header value string, not prose — a comment
  // explaining *why* the policy exists is allowed to use the word
  // "private" in English without that being a directive.
  const match = adminRoutesSource.match(/res\.setHeader\('Cache-Control',\s*'([^']+)'\)/);
  assert.ok(match);
  assert.equal(match[1], 'no-store');
});

// --- 2. Real adminRouter, behavioral (no Supabase needed for these paths) --

test('9. missing Authorization on a protected read receives 401 + no-store', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const { status, cacheControl } = await get(port, '/api/admin/dashboard');
    assert.equal(status, 401);
    assert.equal(cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('12. a malformed token receives 401 + no-store (generic error path)', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const { status, cacheControl } = await get(port, '/api/admin/dashboard', {
      Authorization: 'Bearer not-a-real-jwt',
    });
    assert.equal(status, 401);
    assert.equal(cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('a wrong-algorithm token (P4-G4A pinning) still receives 401 + no-store', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const wrongAlg = jwt.sign({ sub: 'x', email: 'x@example.invalid', role: 'staff', permissions: [], tv: 0 }, SECRET, {
      algorithm: 'HS384',
    });
    const { status, cacheControl } = await get(port, '/api/admin/dashboard', {
      Authorization: `Bearer ${wrongAlg}`,
    });
    assert.equal(status, 401);
    assert.equal(cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('11. an unknown /api/admin route receives 404 + no-store', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const { status, cacheControl } = await get(port, '/api/admin/this-route-does-not-exist');
    assert.equal(status, 404);
    assert.equal(cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('8/10. a nested createCrudRouter resource inherits the header even on a 401 (proves parent-router middleware reaches sub-routers)', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const { status, cacheControl } = await get(port, '/api/admin/services');
    assert.equal(status, 401);
    assert.equal(cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('13. /api/admin/health inherits the header even when unauthenticated', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const { status, cacheControl } = await get(port, '/api/admin/health');
    assert.equal(status, 401);
    assert.equal(cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('2/3. a login attempt (Supabase unconfigured in this environment) still receives no-store on both the invalid-input and downstream-error paths', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    // Missing email/password: fails validation before ever reaching Supabase.
    const invalidInput = await post(port, '/api/admin/auth/login', {});
    assert.equal(invalidInput.status, 400);
    assert.equal(invalidInput.cacheControl, 'no-store');

    // Well-formed but unreachable-without-live-Supabase request: this
    // environment has no SUPABASE_URL configured, so handleAdminLogin's
    // getSupabase() call throws and surfaces as a 500 via the real
    // errorHandler — still a genuine response from the real login route,
    // still proving the header applies regardless of what happens inside
    // the handler. A live Supabase connection would be needed to observe
    // the actual "wrong password" 401 case end-to-end; that business logic
    // is already covered without Supabase in test-change-password-crypto.mjs
    // and P4-G4A's revocation tests.
    const noBackend = await post(port, '/api/admin/auth/login', {
      email: 'nonexistent-synthetic-user@example.invalid',
      password: 'clearly-wrong-password-value',
    });
    assert.equal(noBackend.status, 500);
    assert.equal(noBackend.cacheControl, 'no-store');
  } finally {
    server.close();
  }
});

test('15. no duplicate/conflicting Cache-Control value appears on a single response', async () => {
  const server = await startRealAdminApp();
  const { port } = server.address();
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/admin/dashboard`);
    // fetch's Headers merges duplicate same-name headers into one
    // comma-joined value; a single clean "no-store" with no comma proves
    // there is exactly one Cache-Control directive, not two conflicting ones.
    const cacheControl = res.headers.get('cache-control');
    assert.equal(cacheControl, 'no-store');
    assert.doesNotMatch(cacheControl, /,/);
  } finally {
    server.close();
  }
});

// --- 3. Representative synthetic execution: unconditional on success too ---

test('4/6/7. a representative success response (stub, standing in for /auth/me, protected read, protected write) also receives no-store — the middleware is unconditional, registered before any handler', async () => {
  const app = express();
  // Identical registration pattern to the real adminRouter: the same
  // middleware, registered before any route, on a router mounted the same
  // way — proving the guarantee doesn't depend on whether the downstream
  // handler succeeds or fails, without needing a live Supabase round-trip
  // to observe a real 200 from /auth/me or a CRUD read/write.
  const stubAdminRouter = express.Router();
  stubAdminRouter.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  stubAdminRouter.get('/auth/me', (_req, res) => res.status(200).json({ success: true, data: {} }));
  stubAdminRouter.get('/leads', (_req, res) => res.status(200).json({ success: true, data: [] }));
  stubAdminRouter.patch('/services/:id', (_req, res) => res.status(200).json({ success: true, data: {} }));
  stubAdminRouter.post('/auth/change-password', (_req, res) => res.status(200).json({ success: true, data: { token: 'stub' } }));
  app.use('/api/admin', stubAdminRouter);
  const server = app.listen(0);
  const { port } = server.address();
  try {
    for (const [method, path] of [
      ['GET', '/api/admin/auth/me'],
      ['GET', '/api/admin/leads'],
      ['PATCH', '/api/admin/services/1'],
      ['POST', '/api/admin/auth/change-password'],
    ]) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, { method });
      assert.equal(res.status, 200);
      assert.equal(res.headers.get('cache-control'), 'no-store');
    }
  } finally {
    server.close();
  }
});

// --- 4. Public isolation -----------------------------------------------------

test('16/17. public content source still sets its own pre-existing no-store, untouched by this phase', () => {
  const publicContentSource = readFileSync(
    join(root, 'src/controllers/publicContent.controller.ts'),
    'utf8'
  );
  const setHeaderCalls = publicContentSource.match(/res\.setHeader\('Cache-Control', 'no-store'\)/g) || [];
  assert.equal(setHeaderCalls.length, 2, 'expected exactly the two pre-existing calls (content + blog post)');
  assert.equal(typeof getPublicContent, 'function');
  assert.equal(typeof getPublicBlogPost, 'function');
});

test('18/19/20/21/22/23. public/root routes are registered outside adminRouter and never see its middleware', async () => {
  const routesIndexSource = readFileSync(join(root, 'src/routes/index.ts'), 'utf8');
  const adminMountIndex = routesIndexSource.indexOf("router.use('/api/admin', adminRouter)");
  assert.ok(adminMountIndex > -1);
  for (const publicRoute of [
    "router.get('/'",
    "router.get('/health'",
    "router.post('/api/contact'",
    "router.post('/api/newsletter'",
    "router.get('/api/public/content'",
    "router.get('/api/public/blog/:slug'",
    "router.post('/api/public/analytics'",
    "router.post('/api/public/conversions'",
  ]) {
    const idx = routesIndexSource.indexOf(publicRoute);
    assert.ok(idx > -1, `expected to find ${publicRoute}`);
    // Every public route is registered directly on the base router, never
    // nested inside adminRouter's mount, so it structurally cannot inherit
    // adminRouter's middleware regardless of source-file ordering.
    assert.doesNotMatch(routesIndexSource.slice(idx, idx + publicRoute.length + 60), /adminRouter/);
  }
});

test('24. CORS configuration is unchanged (untouched file)', () => {
  const appSource = readFileSync(join(root, 'src/app.ts'), 'utf8');
  assert.match(appSource, /cors\(\{/);
  assert.match(appSource, /methods: \['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'\]/);
});

test('25. requireAdmin/adminAuth.controller.ts source is unchanged by this phase (no Cache-Control reference introduced there)', () => {
  const middlewareSource = readFileSync(join(root, 'src/middleware/adminAuth.ts'), 'utf8');
  const controllerSource = readFileSync(join(root, 'src/controllers/adminAuth.controller.ts'), 'utf8');
  assert.doesNotMatch(middlewareSource, /Cache-Control/);
  assert.doesNotMatch(controllerSource, /Cache-Control/);
});
