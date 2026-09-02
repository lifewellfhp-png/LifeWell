import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { LazyEmbed } from '@/components/sections/LazyEmbed';
import { SwapButton } from '@/components/ui/SwapButton';
import { resolveVideoEmbed } from '@/lib/videoEmbed';

const YOUTUBE_ALLOW =
  'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
const VIMEO_ALLOW = 'autoplay; fullscreen; picture-in-picture';

export function VideosSection({
  videos,
}: {
  videos: { title: string; url: string; provider: string; description?: string | null }[];
}) {
  if (!videos.length) return null;

  return (
    <Section tone="raised" id="videos" aria-labelledby="videos-heading">
      <Container>
        <SectionHeading
          eyebrow="Education"
          eyebrowVariant="badge"
          title="Watch"
          accent="and Learn"
          id="videos-heading"
          align="center"
        />
        <ul className="mt-10 grid list-none gap-8 md:grid-cols-2">
          {videos.slice(0, 4).map((video) => {
            const resolved = resolveVideoEmbed(video.provider, video.url);
            return (
              <li key={video.url || video.title} className="min-w-0">
                <div className="overflow-hidden rounded-[20px] bg-surface-muted">
                  {resolved.kind === 'youtube' ? (
                    <LazyEmbed
                      title={video.title}
                      src={`https://www.youtube-nocookie.com/embed/${resolved.id}`}
                      allow={YOUTUBE_ALLOW}
                      className="aspect-video"
                    />
                  ) : resolved.kind === 'vimeo' ? (
                    <LazyEmbed
                      title={video.title}
                      src={`https://player.vimeo.com/video/${resolved.id}`}
                      allow={VIMEO_ALLOW}
                      className="aspect-video"
                    />
                  ) : resolved.kind === 'file' ? (
                    <video className="aspect-video w-full" controls src={resolved.url} aria-label={video.title} />
                  ) : resolved.url ? (
                    <a href={resolved.url} className="block p-8 text-center text-text-link" target="_blank" rel="noreferrer">
                      Watch {video.title}
                    </a>
                  ) : (
                    <p className="p-8 text-center text-text-secondary">{video.title}</p>
                  )}
                </div>
                <h3 className="mt-4 font-heading text-[22px] text-text-primary">{video.title}</h3>
                {video.description ? (
                  <p className="mt-2 text-[16px] leading-relaxed text-text-secondary">{video.description}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="mt-10 flex justify-center md:mt-[60px]">
          <SwapButton href="/videos">Watch More Videos</SwapButton>
        </div>
      </Container>
    </Section>
  );
}
