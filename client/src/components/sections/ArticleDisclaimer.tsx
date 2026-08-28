import { site } from '@/data/site';

/**
 * Standard YMYL disclaimer shown at the end of every Wellness Resource Hub
 * article — educational content is never a substitute for personalized care,
 * and readers in crisis need the 988 line front and center.
 */
export function ArticleDisclaimer() {
  return (
    <div className="mt-11 rounded-md border border-border-subtle bg-surface-muted px-6 py-6 text-sm leading-relaxed text-text-secondary">
      <p>
        This article is for general educational purposes and is not a substitute for personalized
        medical advice, diagnosis, or treatment. Always talk with a qualified healthcare provider
        about your specific situation.
      </p>
      <p className="mt-3">
        If you are experiencing a mental health emergency, call or text{' '}
        <a href={site.crisis.phoneHref} className="font-semibold text-crisis">
          {site.crisis.phone}
        </a>{' '}
        ({site.crisis.lineName}).
      </p>
    </div>
  );
}
