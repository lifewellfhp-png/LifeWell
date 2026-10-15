export type ApiResult<T> = {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string>;
};

/**
 * Always calls this app's own same-origin /api/* routes, which proxy to the
 * real Express API server-side (see app/api/[...path]/route.ts and the
 * dedicated app/api/admin/auth/* routes). No token handling here at all —
 * the session lives in an httpOnly cookie the browser attaches
 * automatically to same-origin requests; client JS never sees it.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...options, headers });
  const json = (await res.json().catch(() => ({}))) as ApiResult<T>;

  if (res.status === 401 && typeof window !== 'undefined' && !path.includes('/auth/login')) {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    const fallback =
      res.status === 404
        ? 'Login service is not running. In the server folder run npm run build, then npm start — or use npm run dev.'
        : `Request failed (${res.status})`;
    return {
      success: false,
      message: json.message && json.message !== 'Not found' ? json.message : fallback,
      errors: json.errors,
    };
  }

  return json;
}
