import type { Metadata } from 'next';
import { Suspense } from 'react';
import { UnsubscribeLanding } from '@/components/sections/UnsubscribeLanding';
import { site } from '@/data/site';

export const metadata: Metadata = {
  title: `Unsubscribe | ${site.name}`,
  // Transactional utility page reached only via a private per-contact
  // link — not a page anyone should find through search.
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeLanding />
    </Suspense>
  );
}
