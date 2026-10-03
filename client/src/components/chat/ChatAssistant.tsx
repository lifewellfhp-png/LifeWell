'use client';

/**
 * Site-wide chat assistant — hybrid design.
 *
 * "Book an Appointment" and "Request a Callback" stay as fixed, deterministic
 * actions (a tracked SwapButton and the real validated/consented/honeypot-
 * protected ContactForm) rather than LLM-generated text: trackAs="booking_click"
 * conversion tracking and ContactForm's consent checkbox are structural, not
 * cosmetic, and an LLM reply can't legitimately reproduce either. Free text
 * is additive, for general Q&A (pricing/services/hours/areas) only.
 *
 * The free-text box is a deliberate, scoped exception to this codebase's
 * usual "no free-text field anywhere public-facing" rule (see
 * ContactForm.tsx / test-contact-non-clinical-boundary.mjs) — safety is kept
 * server-side instead: a deterministic crisis-keyword gate runs before any
 * Gemini call (server/src/lib/chatCrisis.ts), the system prompt forbids
 * clinical/medical advice, and nothing typed here is ever persisted — no
 * database write, no localStorage/sessionStorage — state lives only in this
 * component and is lost on refresh.
 */

import { useId, useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { site } from '@/data/site';
import { submitChatMessage } from '@/lib/api';
import type { ChatHistoryEntry } from '@/lib/api';
import { SwapButton } from '@/components/ui/SwapButton';
import { ContactForm } from '@/components/forms/ContactForm';
import type { PsychiatricStatePricing } from '@/types/content';

type Message = { sender: 'bot' | 'user'; content: ReactNode };

const GREETING: Message = {
  sender: 'bot',
  content:
    "Hello! I'm the LifeWell Assistant. Ask me about pricing, services, hours, or service areas — or use the buttons below to book an appointment or request a callback.",
};

function CrisisFooter() {
  return (
    <div className="border-t border-border-subtle p-2.5 text-center text-[11px] text-text-secondary">
      In crisis? Call or text{' '}
      <a href={site.crisis.phoneHref} className="font-semibold text-text-link">
        {site.crisis.phone}
      </a>
      . Prefer to talk now? Call{' '}
      <a href={site.contact.phoneHref} className="font-semibold text-text-link">
        {site.contact.phone}
      </a>
      . AI-generated replies — please confirm anything important by calling the office.
    </div>
  );
}

export function ChatAssistant(props: {
  /** Kept for interface parity with the layout's resolved CMS content; the
   *  free-text Q&A path gets its own live-resolved pricing server-side
   *  (server/src/lib/chatFacts.ts), so this prop isn't read directly here. */
  psychiatricStatePricing: PsychiatricStatePricing[];
  bookingUrl: string;
}) {
  const { bookingUrl } = props;
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [history, setHistory] = useState<ChatHistoryEntry[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const close = () => {
    setOpen(false);
    setMessages([GREETING]);
    setHistory([]);
    setInput('');
  };

  const handleBook = () => {
    setMessages((prev) => [
      ...prev,
      { sender: 'user', content: 'Book an Appointment' },
      {
        sender: 'bot',
        content: (
          <div className="space-y-3">
            <p>Great — you can book directly online:</p>
            <SwapButton href={bookingUrl} trackAs="booking_click" size="sm">
              Book an Appointment
            </SwapButton>
          </div>
        ),
      },
    ]);
  };

  const handleCallback = () => {
    setMessages((prev) => [
      ...prev,
      { sender: 'user', content: 'Request a Callback' },
      {
        sender: 'bot',
        content: (
          <div className="w-full">
            <p className="mb-3">Sure — leave your details and we&apos;ll call you back:</p>
            <ContactForm variant="compact" />
          </div>
        ),
      },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { sender: 'user', content: text }]);
    const nextHistory: ChatHistoryEntry[] = [...history, { role: 'user', content: text }];
    setHistory(nextHistory);
    setSending(true);

    const res = await submitChatMessage({ message: text, history });

    if (res.success) {
      setMessages((prev) => [...prev, { sender: 'bot', content: res.message }]);
      setHistory([...nextHistory, { role: 'assistant', content: res.message }]);
    } else {
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', content: `${res.message} You can also call us at ${site.contact.phone}.` },
      ]);
    }
    setSending(false);
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${uid}-heading`}
          className="flex h-[30rem] w-[min(360px,calc(100vw-2rem))] flex-col rounded-md border border-border-subtle bg-surface-raised shadow-lg"
        >
          <div className="flex items-center justify-between rounded-t-md bg-[var(--lw-primary)] p-3">
            <h2 id={`${uid}-heading`} className="text-sm font-semibold text-white">
              {site.shortName} Assistant
            </h2>
            <button type="button" onClick={close} aria-label="Close chat" className="font-bold text-white">
              &times;
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-3 text-sm">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`rounded-lg p-2.5 text-text-primary ${
                    m.sender === 'user'
                      ? 'max-w-[85%] bg-[var(--lw-primary)] text-white'
                      : 'w-full max-w-full bg-surface-muted'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-start">
                <div className="rounded-lg bg-surface-muted p-2.5 text-xs text-text-secondary">Thinking…</div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="flex gap-2 border-t border-border-subtle p-2">
            <button
              type="button"
              onClick={handleBook}
              className="flex-1 rounded-sm border border-border-strong p-2 text-xs font-semibold text-text-link hover:border-brand-primary hover:bg-brand-primary-soft"
            >
              Book an Appointment
            </button>
            <button
              type="button"
              onClick={handleCallback}
              className="flex-1 rounded-sm border border-border-strong p-2 text-xs font-semibold text-text-link hover:border-brand-primary hover:bg-brand-primary-soft"
            >
              Request a Callback
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border-subtle p-2">
            <label htmlFor={`${uid}-input`} className="sr-only">
              Ask a question
            </label>
            <input
              id={`${uid}-input`}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about pricing, services, hours…"
              disabled={sending}
              className="flex-1 rounded-sm border border-border-strong px-3 py-2 text-xs text-text-primary placeholder-text-secondary focus:border-brand-primary focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-sm bg-[var(--lw-primary)] px-3 py-2 text-xs font-semibold text-white transition-colors duration-300 hover:bg-[var(--lw-accent)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Send
            </button>
          </form>

          <CrisisFooter />
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex min-h-14 items-center justify-center rounded-full bg-[var(--lw-primary)] px-5 text-sm font-semibold text-white shadow-lg transition-colors duration-300 hover:bg-[var(--lw-accent)]"
      >
        {open ? 'Close' : 'Chat with Us'}
      </button>
    </div>
  );
}
