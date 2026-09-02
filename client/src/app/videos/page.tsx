import type { Metadata } from 'next';

import { Container, Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { InnerPageHero } from '@/components/sections/InnerPageHero';
import { VideosSection } from '@/components/sections/VideosSection';
import { JsonLd } from '@/components/seo/JsonLd';
import { CmsCta } from '@/components/CmsCta';
import { cmsMetadata } from '@/lib/cms-seo';
import { pageGraph } from '@/lib/schema';
import { getResolvedContent } from '@/lib/cms-resolve';

const DESCRIPTION =
  'Watch and learn with educational videos from LifeWell Family Health & Psychiatry — practical mental health guidance from a board-certified PMHNP.';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  const cms = await getResolvedContent();
  return cmsMetadata(cms, {
    title: 'Videos — Mental Health Education',
    description: DESCRIPTION,
    path: '/videos',
    noIndex: cms.videos.length === 0,
  });
}

export default async function VideosPage() {
  const cms = await getResolvedContent();

  return (
    <>
      <JsonLd
        data={pageGraph('/videos', 'Videos', DESCRIPTION, [
          { name: 'Home', href: '/' },
          { name: 'Videos', href: '/videos' },
        ])}
        id="videos-page-schema"
      />

      <InnerPageHero
        title="Watch and"
        accent="Learn"
        lead="Educational videos on mental health topics, published from the LifeWell admin panel."
        leadSize="subhead"
      />

      {cms.videos.length > 0 ? (
        <VideosSection videos={cms.videos} />
      ) : (
        <Section tone="base">
          <Container>
            <div className="mx-auto max-w-2xl rounded-md border border-border-subtle bg-surface-raised px-6 py-10 text-center sm:px-10">
              <h2 className="text-h4">Videos coming soon</h2>
              <p className="mt-4 text-text-secondary">
                Published videos from Admin will appear here automatically.
              </p>
              <div className="mt-8">
                <Button href="/our-services" size="lg">
                  Explore Services
                </Button>
              </div>
            </div>
          </Container>
        </Section>
      )}

      <CmsCta />
    </>
  );
}
