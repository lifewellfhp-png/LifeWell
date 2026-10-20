import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UnsubscribeLanding } from '@/components/sections/UnsubscribeLanding';
import { pageMetadata } from '@/lib/seo';

// pageMetadata() (not a hand-rolled object) so this page gets its own
// canonical (/unsubscribe) and description instead of silently inheriting
// the root layout's ("/", the homepage's description) — the two were
// previously omitted here and fell through to those sitewide defaults.
// noIndex: true keeps the existing intent (transactional utility page
// reached only via a private per-contact link — not one anyone should
// find through search) via the same robots shape pageMetadata() already
// produces for it, just derived consistently instead of set by hand.
export const metadata: Metadata = pageMetadata({
  title: 'Unsubscribe',
  description:
    "Unsubscribe from marketing emails from LifeWell Family Health & Psychiatry. We'll stop sending you promotional messages right away.",
  path: '/unsubscribe',
  noIndex: true,
});

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeLanding />
    </Suspense>
  );
}
