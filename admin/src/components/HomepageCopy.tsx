'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';

type SectionRow = {
  id: string;
  page_key: string;
  section_key: string;
  title?: string | null;
  content?: Record<string, unknown> | null;
  published?: boolean;
  updated_at?: string;
};

type HeroForm = { badge: string; headline: string; subhead: string; image: string };
type WelcomeForm = { heading: string; body: string; ctaLabel: string; ctaHref: string; image: string };
type IntroForm = { eyebrow: string; heading: string; body: string; cta: string };
type TextForm = { heading: string; body: string; eyebrow: string };
type StatItem = { value: string; suffix: string; label: string; hidden: boolean; requiresVerification: boolean };

const emptyHero: HeroForm = { badge: '', headline: '', subhead: '', image: '' };
const emptyWelcome: WelcomeForm = { heading: '', body: '', ctaLabel: '', ctaHref: '', image: '' };
const emptyIntro: IntroForm = { eyebrow: '', heading: '', body: '', cta: '' };
const emptyHow: TextForm = { heading: '', body: '', eyebrow: '' };
const emptyStat: StatItem = { value: '', suffix: '', label: '', hidden: false, requiresVerification: false };

/**
 * Kept in sync with the approved figures/labels in client/src/data/marketing.ts —
 * but NOT with their visibility. The owner's current decision is that every
 * homepage stat stays hidden regardless of how well-supported the underlying
 * fact is (the 15+ years figure itself remains approved and visible on
 * /bio — that's a separate decision from whether the homepage stat band
 * shows it). "Reset to approved defaults" must never be a one-click way to
 * publish a stat the owner has asked to keep hidden, so every entry here
 * stays hidden: true until that owner decision changes.
 */
export const APPROVED_STATS: StatItem[] = [
  { value: '1', suffix: '', label: 'Licensed Provider', hidden: true, requiresVerification: false },
  { value: '15', suffix: '+', label: 'Years of Experience', hidden: true, requiresVerification: false },
  { value: '24', suffix: '/7', label: 'Secure Online Access', hidden: true, requiresVerification: false },
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function bodyText(value: unknown) {
  if (Array.isArray(value)) return value.filter((p) => typeof p === 'string').join('\n\n');
  return typeof value === 'string' ? value : '';
}

export function HomepageCopy() {
  const [ids, setIds] = useState<Record<string, string | null>>({});
  const [loadedContent, setLoadedContent] = useState<Record<string, Record<string, unknown>>>({});
  const [hero, setHero] = useState<HeroForm>(emptyHero);
  const [welcome, setWelcome] = useState<WelcomeForm>(emptyWelcome);
  const [services, setServices] = useState<IntroForm>(emptyIntro);
  const [benefitsHeading, setBenefitsHeading] = useState('');
  const [how, setHow] = useState<TextForm>(emptyHow);
  const [statsItems, setStatsItems] = useState<StatItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await api<SectionRow[]>('/api/admin/sections');
    if (!res.success) {
      setError(res.message || 'Could not load homepage copy');
      return;
    }
    const rows = res.data || [];
    const byLatest = (key: string) =>
      [...rows]
        .filter((r) => r.page_key === 'home' && r.section_key === key)
        .sort((a, b) => Date.parse(b.updated_at || '') - Date.parse(a.updated_at || ''))[0];

    const nextIds: Record<string, string | null> = {};
    const nextContent: Record<string, Record<string, unknown>> = {};
    const heroRow = byLatest('hero');
    const welcomeRow = byLatest('welcome');
    const servicesRow = byLatest('services');
    const benefitsRow = byLatest('benefits');
    const howRow = byLatest('how_it_works');
    const statsRow = byLatest('stats');
    nextIds.hero = heroRow?.id ?? null;
    nextIds.welcome = welcomeRow?.id ?? null;
    nextIds.services = servicesRow?.id ?? null;
    nextIds.benefits = benefitsRow?.id ?? null;
    nextIds.how_it_works = howRow?.id ?? null;
    nextIds.stats = statsRow?.id ?? null;
    for (const row of [heroRow, welcomeRow, servicesRow, benefitsRow, howRow, statsRow]) {
      if (row?.section_key) {
        nextContent[row.section_key] = asRecord(row.content);
      }
    }
    setIds(nextIds);
    setLoadedContent(nextContent);

    if (heroRow) {
      const c = asRecord(heroRow.content);
      setHero({
        badge: String(c.badge || ''),
        headline: String(c.headline || c.heading || ''),
        subhead: String(c.subhead || c.subheading || ''),
        image: String(c.image || ''),
      });
    }
    if (welcomeRow) {
      const c = asRecord(welcomeRow.content);
      setWelcome({
        heading: String(c.heading || ''),
        body: bodyText(c.body),
        ctaLabel: String(c.ctaLabel || ''),
        ctaHref: String(c.ctaHref || ''),
        image: String(c.image || ''),
      });
    }
    if (servicesRow) {
      const c = asRecord(servicesRow.content);
      setServices({
        eyebrow: String(c.eyebrow || ''),
        heading: String(c.heading || ''),
        body: String(c.body || ''),
        cta: String(c.cta || ''),
      });
    }
    if (benefitsRow) {
      const c = asRecord(benefitsRow.content);
      setBenefitsHeading(String(c.heading || ''));
    }
    if (howRow) {
      const c = asRecord(howRow.content);
      setHow({
        eyebrow: String(c.eyebrow || ''),
        heading: String(c.heading || ''),
        body: String(c.body || ''),
      });
    }
    if (statsRow) {
      const c = asRecord(statsRow.content);
      const rawItems = Array.isArray(c.items) ? c.items : [];
      setStatsItems(
        rawItems.map((item) => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
          return {
            value: row.value != null ? String(row.value) : '',
            suffix: typeof row.suffix === 'string' ? row.suffix : '',
            label: typeof row.label === 'string' ? row.label : '',
            hidden: Boolean(row.hidden),
            requiresVerification: Boolean(row.requiresVerification),
          };
        })
      );
    } else {
      setStatsItems([]);
    }
  }

  function moveStat(index: number, dir: -1 | 1) {
    setStatsItems((items) => {
      const next = [...items];
      const target = index + dir;
      if (target < 0 || target >= next.length) return items;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateStat(index: number, patch: Partial<StatItem>) {
    setStatsItems((items) => items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeStat(index: number) {
    setStatsItems((items) => items.filter((_, i) => i !== index));
  }

  function addStat() {
    setStatsItems((items) => [...items, { ...emptyStat }]);
  }

  function resetStatsToApproved() {
    setStatsItems(APPROVED_STATS.map((s) => ({ ...s })));
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSection(
    id: string | null,
    section_key: string,
    title: string,
    content: Record<string, unknown>
  ) {
    const payload = { page_key: 'home', section_key, title, published: true, content };
    const mergedContent = { ...(loadedContent[section_key] ?? {}), ...content };
    const mergedPayload = { ...payload, content: mergedContent };
    if (id) return api(`/api/admin/sections/${id}`, { method: 'PATCH', body: JSON.stringify(mergedPayload) });
    return api('/api/admin/sections', { method: 'POST', body: JSON.stringify(mergedPayload) });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const blockedStat = statsItems.find((s) => s.requiresVerification && !s.hidden && s.label.trim());
    if (blockedStat) {
      setError(
        `"${blockedStat.label}" is marked "Requires verification" and can't be published yet. ` +
          'Either turn its visibility back off, or confirm the figure is accurate and clear "Requires verification" first.'
      );
      return;
    }

    setSaving(true);
    const welcomeBody = welcome.body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    const results = await Promise.all([
      saveSection(ids.hero ?? null, 'hero', 'Homepage hero', {
        badge: hero.badge,
        headline: hero.headline,
        subhead: hero.subhead,
        image: hero.image,
      }),
      saveSection(ids.welcome ?? null, 'welcome', 'Welcome', {
        heading: welcome.heading,
        body: welcomeBody,
        ctaLabel: welcome.ctaLabel,
        ctaHref: welcome.ctaHref,
        image: welcome.image,
      }),
      saveSection(ids.services ?? null, 'services', 'Services intro', {
        eyebrow: services.eyebrow,
        heading: services.heading,
        body: services.body,
        cta: services.cta,
      }),
      saveSection(ids.benefits ?? null, 'benefits', 'Why patients choose us', {
        heading: benefitsHeading,
      }),
      saveSection(ids.how_it_works ?? null, 'how_it_works', 'How it works', {
        eyebrow: how.eyebrow,
        heading: how.heading,
        body: how.body,
      }),
      saveSection(ids.stats ?? null, 'stats', 'Stats band', {
        items: statsItems
          .filter((s) => s.label.trim())
          .map((s) => ({
            value: Number(s.value) || 0,
            suffix: s.suffix,
            label: s.label,
            hidden: s.hidden,
            requiresVerification: s.requiresVerification,
          })),
      }),
    ]);
    setSaving(false);
    const failed = results.find((row) => !row.success);
    if (failed) {
      setError(failed.message || 'Save failed');
      return;
    }
    setMessage('Saved to the live website. Open the public site and refresh — homepage text updates immediately.');
    await load();
  }

  return (
    <form className="card card-pad" onSubmit={onSubmit} style={{ marginBottom: '1.25rem' }}>
      <h2>Website text</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        These fields publish to the public homepage on Save. Hard-refresh the client site if a tab was already open.
      </p>
      {error ? <div className="error-banner">{error}</div> : null}
      {message ? <div className="ok-banner">{message}</div> : null}

      <h3>Hero</h3>
      <div className="field">
        <label htmlFor="hero-badge">Hero badge</label>
        <input id="hero-badge" value={hero.badge} onChange={(e) => setHero({ ...hero, badge: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="hero-headline">Hero headline</label>
        <input id="hero-headline" value={hero.headline} onChange={(e) => setHero({ ...hero, headline: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="hero-subhead">Hero subheading</label>
        <textarea id="hero-subhead" rows={3} value={hero.subhead} onChange={(e) => setHero({ ...hero, subhead: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="hero-image">Hero image URL (from Media)</label>
        <input
          id="hero-image"
          value={hero.image}
          placeholder="/images/sections/lifewell.avif or uploaded media URL"
          onChange={(e) => setHero({ ...hero, image: e.target.value })}
        />
      </div>
      <p className="muted">
        The hero&apos;s booking button always uses the site-wide booking label and destination —
        set those on the <a href="/booking">Booking</a> and <a href="/appearance">Appearance</a>
        pages so every &quot;book now&quot; button on the site stays in sync.
      </p>

      <h3>Welcome</h3>
      <div className="field">
        <label htmlFor="welcome-heading">Welcome heading</label>
        <input
          id="welcome-heading"
          value={welcome.heading}
          onChange={(e) => setWelcome({ ...welcome, heading: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="welcome-body">Welcome text (blank line between paragraphs)</label>
        <textarea
          id="welcome-body"
          rows={8}
          value={welcome.body}
          onChange={(e) => setWelcome({ ...welcome, body: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="welcome-image">Welcome image URL (from Media)</label>
        <input
          id="welcome-image"
          value={welcome.image}
          placeholder="/images/sections/lifewell.avif or uploaded media URL"
          onChange={(e) => setWelcome({ ...welcome, image: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="welcome-cta-label">Welcome button label</label>
        <input
          id="welcome-cta-label"
          value={welcome.ctaLabel}
          placeholder="Learn More About the Provider"
          onChange={(e) => setWelcome({ ...welcome, ctaLabel: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="welcome-cta-href">Welcome button link</label>
        <input
          id="welcome-cta-href"
          value={welcome.ctaHref}
          placeholder="/bio"
          onChange={(e) => setWelcome({ ...welcome, ctaHref: e.target.value })}
        />
      </div>

      <h3>Stats band</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Only claims you can support should appear here — each figure needs no supporting evidence
        beyond what is already true of the practice.
      </p>
      {statsItems.length === 0 ? (
        <div className="empty" style={{ marginBottom: '0.75rem' }}>
          No stats saved yet — the site is showing the built-in defaults (1 Licensed Provider, 15+
          Years of Experience, 24/7 Secure Online Access).
        </div>
      ) : null}
      {statsItems.map((stat, i) => (
        <div key={i} style={{ marginBottom: '0.5rem' }}>
          <div
            className="field"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 2fr auto auto auto auto auto',
              gap: '0.5rem',
              alignItems: 'center',
            }}
          >
            <input
              aria-label={`Stat ${i + 1} value`}
              placeholder="Value (e.g. 15)"
              value={stat.value}
              onChange={(e) => updateStat(i, { value: e.target.value })}
            />
            <input
              aria-label={`Stat ${i + 1} suffix`}
              placeholder="Suffix (e.g. +)"
              value={stat.suffix}
              onChange={(e) => updateStat(i, { suffix: e.target.value })}
            />
            <input
              aria-label={`Stat ${i + 1} label`}
              placeholder="Label (e.g. Years of Experience)"
              value={stat.label}
              onChange={(e) => updateStat(i, { label: e.target.value })}
            />
            <label className="check-label" style={{ whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={!stat.hidden}
                onChange={(e) => updateStat(i, { hidden: !e.target.checked })}
              />
              Visible
            </label>
            <label className="check-label" style={{ whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={stat.requiresVerification}
                onChange={(e) => updateStat(i, { requiresVerification: e.target.checked })}
              />
              Requires verification
            </label>
            <button
              type="button"
              className="icon-btn"
              aria-label="Move stat up"
              disabled={i === 0}
              onClick={() => moveStat(i, -1)}
            >
              <ArrowUp size={15} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Move stat down"
              disabled={i === statsItems.length - 1}
              onClick={() => moveStat(i, 1)}
            >
              <ArrowDown size={15} />
            </button>
            <button
              type="button"
              className="btn btn-danger"
              aria-label="Remove stat"
              onClick={() => removeStat(i)}
            >
              <Trash2 size={15} />
            </button>
          </div>
          {stat.requiresVerification && !stat.hidden ? (
            <p className="muted" style={{ margin: '0.25rem 0 0', color: 'var(--danger, #b91c1c)' }}>
              This figure is marked as requiring verification, so it won&apos;t be published even though
              &quot;Visible&quot; is checked — clear &quot;Requires verification&quot; once you&apos;ve confirmed it.
            </p>
          ) : null}
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button type="button" className="btn btn-ghost" onClick={addStat}>
          <Plus size={15} />
          Add stat
        </button>
        <button type="button" className="btn btn-ghost" onClick={resetStatsToApproved}>
          Reset to approved defaults
        </button>
      </div>

      <h3>Services band</h3>
      <div className="field">
        <label htmlFor="svc-eyebrow">Eyebrow</label>
        <input id="svc-eyebrow" value={services.eyebrow} onChange={(e) => setServices({ ...services, eyebrow: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="svc-heading">Heading</label>
        <input id="svc-heading" value={services.heading} onChange={(e) => setServices({ ...services, heading: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="svc-body">Body</label>
        <textarea id="svc-body" rows={3} value={services.body} onChange={(e) => setServices({ ...services, body: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="svc-cta">Button label</label>
        <input id="svc-cta" value={services.cta} onChange={(e) => setServices({ ...services, cta: e.target.value })} />
      </div>

      <h3>Benefits</h3>
      <div className="field">
        <label htmlFor="benefits-heading">Benefits heading</label>
        <input id="benefits-heading" value={benefitsHeading} onChange={(e) => setBenefitsHeading(e.target.value)} />
      </div>
      <p className="muted">Individual benefit cards stay in Homepage sections JSON (`benefits` → `items`).</p>

      <h3>How it works</h3>
      <div className="field">
        <label htmlFor="how-eyebrow">Eyebrow</label>
        <input id="how-eyebrow" value={how.eyebrow} onChange={(e) => setHow({ ...how, eyebrow: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="how-heading">Heading</label>
        <input id="how-heading" value={how.heading} onChange={(e) => setHow({ ...how, heading: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="how-body">Body</label>
        <textarea id="how-body" rows={3} value={how.body} onChange={(e) => setHow({ ...how, body: e.target.value })} />
      </div>

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save homepage text'}
      </button>
    </form>
  );
}
