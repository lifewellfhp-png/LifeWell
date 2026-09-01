'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { submitUnsubscribe } from '@/lib/api';

type Stage = 'ready' | 'submitting' | 'success' | 'problem';

const NO_TOKEN_MESSAGE = 'This link is invalid or has expired.';

/**
 * Public marketing-unsubscribe landing page (P4-I3). Deliberately never
 * fires the actual unsubscribe request on load/render — only an explicit
 * click on "Unsubscribe me" does. A GET of this page (including one made
 * by a link-scanning security tool or a browser's prefetch, even one that
 * fully renders and executes this component's JavaScript) never mutates
 * anything by itself; the mutation is gated behind a real user click,
 * which no automated scanner simulates. See onUnsubscribe below.
 *
 * Displays no PII: the token identifies a contact only to the server, and
 * the server's own response is a neutral message that never reveals the
 * person's email, name, audience, or suppression state (P4-I3 section 9)
 * — this page simply renders whatever neutral text the server returns.
 */
export function UnsubscribeLanding() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [stage, setStage] = useState<Stage>(token ? 'ready' : 'problem');
  const [message, setMessage] = useState(token ? '' : NO_TOKEN_MESSAGE);

  async function onUnsubscribe() {
    if (!token) return;
    setStage('submitting');
    const res = await submitUnsubscribe(token);
    setStage(res.success ? 'success' : 'problem');
    setMessage(res.message);
  }

  return (
    <Section tone="base" spacing="lg">
      <Container size="narrow">
        <div className="mx-auto max-w-md text-center">
          {stage === 'ready' && (
            <>
              <h1 className="text-[28px] font-normal leading-tight text-text-primary sm:text-[34px]">
                Unsubscribe from marketing emails
              </h1>
              <p className="mt-4 text-md leading-relaxed text-text-secondary">
                Click below to confirm you no longer want to receive marketing communications from LifeWell Family
                Health &amp; Psychiatry. This will not affect appointment reminders or billing communications.
              </p>
              <div className="mt-8">
                <Button type="button" onClick={onUnsubscribe}>
                  Unsubscribe me
                </Button>
              </div>
            </>
          )}

          {stage === 'submitting' && (
            <p role="status" aria-live="polite" className="text-md text-text-secondary">
              Processing…
            </p>
          )}

          {stage === 'success' && (
            <div role="status" aria-live="polite">
              <h1 className="text-[28px] font-normal leading-tight text-text-primary sm:text-[34px]">
                You&rsquo;re unsubscribed
              </h1>
              <p className="mt-4 text-md leading-relaxed text-text-secondary">{message}</p>
            </div>
          )}

          {stage === 'problem' && (
            <div role="status" aria-live="polite">
              <h1 className="text-[28px] font-normal leading-tight text-text-primary sm:text-[34px]">
                We couldn&rsquo;t process this link
              </h1>
              <p className="mt-4 text-md leading-relaxed text-text-secondary">{message}</p>
            </div>
          )}
        </div>
      </Container>
    </Section>
  );
}
