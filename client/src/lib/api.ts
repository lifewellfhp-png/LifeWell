import type { ApiResponse, ContactFormValues } from '@/types/content';

/**
 * Thin client for the Node backend.
 *
 * The base URL is public by design (the browser calls it directly); no secret
 * ever reaches this layer. All credentials live server-side.
 */
const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'https://lifewellfhp-server.vercel.app').replace(/\/$/, '');

const GENERIC_ERROR =
  'We could not send your message just now. Please try again, or call us at (407) 603-1717.';

async function post(path: string, body: unknown): Promise<ApiResponse> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    // The server always returns JSON; guard anyway so an HTML error page from
    // a proxy doesn't surface as an unhandled parse exception.
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      return { success: false, message: GENERIC_ERROR };
    }

    const parsed = data as Partial<ApiResponse> & { errors?: Record<string, string> };

    if (!res.ok || parsed?.success !== true) {
      return {
        success: false,
        message: typeof parsed?.message === 'string' ? parsed.message : GENERIC_ERROR,
        errors: parsed?.errors,
      };
    }

    return {
      success: true,
      message: typeof parsed.message === 'string' ? parsed.message : 'Thank you — your message has been sent.',
      referenceId: (parsed as { referenceId?: string }).referenceId,
    };
  } catch {
    // Network failure, CORS rejection, or the API being unreachable.
    return { success: false, message: GENERIC_ERROR };
  }
}

export interface ContactPayload extends ContactFormValues {
  /** Anti-spam honeypot; must stay empty. */
  company?: string;
}

export const submitContact = (payload: ContactPayload) => post('/api/contact', payload);

export const submitNewsletter = (payload: { email: string; company?: string }) =>
  post('/api/newsletter', payload);

export interface ChatHistoryEntry {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Goes through the real Express server (API_BASE above), not a relative
 * Next.js API route — this app has no server-side route handlers of its
 * own; every backend call in this codebase goes through this same post()
 * helper to the separate server/ deployment.
 */
export const submitChatMessage = (payload: { message: string; history: ChatHistoryEntry[] }) =>
  post('/api/chat', payload);

/**
 * Fail-closed status check for the chat assistant's online indicator: only
 * ever returns true once the server has actually confirmed Gemini is
 * configured (GET /health's `integrations.chat` field). Any network error,
 * non-200, or unexpected shape returns false — the indicator must never
 * claim "online" on uncertain/missing data.
 */
export async function getChatStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) return false;
    const data = (await res.json()) as { integrations?: { chat?: string } };
    return data.integrations?.chat === 'configured';
  } catch {
    return false;
  }
}

/**
 * Marketing unsubscribe (P4-I3). Only the opaque signed token is ever
 * sent — no email address, no other identifying data. Reuses the same
 * post() helper (and its network-failure/JSON-parse fallbacks) as every
 * other public form on this site.
 */
export const submitUnsubscribe = (token: string) => post('/api/marketing/unsubscribe', { token });
