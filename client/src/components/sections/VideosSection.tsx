import { Container, Section, SectionHeading } from '@/components/ui/Section';
import { LazyEmbed } from '@/components/sections/LazyEmbed';

function youtubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  return match?.[1] ?? null;
}

function vimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

export function VideosSection({
  videos,
}: {
  videos: { title: string; url: string; provider: string; description?: string | null; embedHtml?: string | null }[];
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
            const yt = video.provider === 'youtube' ? youtubeId(video.url) : null;
            const vimeo = video.provider === 'vimeo' ? vimeoId(video.url) : null;
            return (
              <li key={video.url || video.title} className="min-w-0">
                <div className="overflow-hidden rounded-[20px] bg-[#EEF3F7]">
                  {video.embedHtml ? (
                    <LazyEmbed html={video.embedHtml} className="aspect-video" />
                  ) : yt ? (
                    <LazyEmbed
                      html={`<iframe title="${video.title}" src="https://www.youtube-nocookie.com/embed/${yt}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`}
                      className="aspect-video"
                    />
                  ) : vimeo ? (
                    <LazyEmbed
                      html={`<iframe title="${video.title}" src="https://player.vimeo.com/video/${vimeo}" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>`}
                      className="aspect-video"
                    />
                  ) : video.provider === 'file' ? (
                    <video className="aspect-video w-full" controls src={video.url} />
                  ) : (
                    <a href={video.url} className="block p-8 text-center text-[#2f6691]" target="_blank" rel="noreferrer">
                      Watch {video.title}
                    </a>
                  )}
                </div>
                <h3 className="mt-4 font-heading text-[22px] text-[#374151]">{video.title}</h3>
                {video.description ? (
                  <p className="mt-2 text-[16px] leading-relaxed text-[#5b6675]">{video.description}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
