'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, MousePointerClick, Smartphone, Monitor, Tablet } from 'lucide-react';
import { api } from '@/lib/api';
import { AreaChart, BarList, DonutChart } from '@/components/charts';

type Summary = {
  from: string;
  to: string;
  timezone: string;
  rangeDays: number;
  totals: { pageViews: number; conversions: number };
  deltas: { pageViews: number; conversions: number };
  popularPages: { path: string; views: number }[];
  devices: Record<string, number>;
  trafficSources: { source: string; visits: number }[];
  trends: { date: string; views: number }[];
  conversionCounts: Record<string, number>;
  topBookingPages: { path: string; clicks: number }[];
  bookingClicksByDevice: Record<string, number>;
  bookingClicksByReferrer: { source: string; visits: number }[];
};

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#3e7fb1',
  mobile: '#5faf6b',
  tablet: '#2f6691',
  unknown: '#9aa6b2',
};

/** `iso` is a plain YYYY-MM-DD calendar date — parsed as local midnight so the
 * displayed day never shifts across a UTC/local boundary. */
function formatDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatDayLong(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const TIMEZONE_LABELS: Record<string, string> = {
  'America/New_York': 'Eastern Time (ET)',
};

type PresetOption = 'today' | '7d' | '30d' | 'custom';

function Delta({ value, days }: { value: number; days: number }) {
  const up = value >= 0;
  return (
    <span className={`kpi-delta ${up ? 'up' : 'down'}`}>
      {up ? '+' : ''}
      {value}% vs prior {days} {days === 1 ? 'day' : 'days'}
    </span>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetOption>('30d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  useEffect(() => {
    if (preset === 'custom') return; // wait for explicit Apply
    setError(null);
    void api<Summary>(`/api/admin/analytics/summary?preset=${preset}`).then((res) => {
      if (!res.success) setError(res.message || 'Failed to load analytics');
      else setData(res.data || null);
    });
  }, [preset]);

  function applyCustomRange() {
    if (!customFrom || !customTo) {
      setError('Choose both a start and end date.');
      return;
    }
    if (customFrom > customTo) {
      setError('Start date must not be after end date.');
      return;
    }
    setError(null);
    const qs = new URLSearchParams({ from: customFrom, to: customTo }).toString();
    void api<Summary>(`/api/admin/analytics/summary?${qs}`).then((res) => {
      if (!res.success) setError(res.message || 'Failed to load analytics');
      else setData(res.data || null);
    });
  }

  const trend = useMemo(
    () => (data?.trends || []).map((t) => ({ label: formatDay(t.date), value: t.views })),
    [data]
  );
  const pages = useMemo(
    () => (data?.popularPages || []).slice(0, 8).map((p) => ({ label: p.path, value: p.views })),
    [data]
  );
  const sources = useMemo(
    () => (data?.trafficSources || []).slice(0, 6).map((p) => ({ label: p.source, value: p.visits })),
    [data]
  );
  const devices = useMemo(
    () =>
      Object.entries(data?.devices || {}).map(([label, value]) => ({
        label,
        value,
        color: DEVICE_COLORS[label.toLowerCase()] || '#9aa6b2',
      })),
    [data]
  );
  const conversions = useMemo(
    () =>
      Object.entries(data?.conversionCounts || {}).map(([label, value]) => ({
        label: label.replace('_', ' '),
        value,
      })),
    [data]
  );
  const bookingPages = useMemo(
    () => (data?.topBookingPages || []).slice(0, 8).map((p) => ({ label: p.path, value: p.clicks })),
    [data]
  );
  const bookingDevices = useMemo(
    () =>
      Object.entries(data?.bookingClicksByDevice || {}).map(([label, value]) => ({
        label,
        value,
        color: DEVICE_COLORS[label.toLowerCase()] || '#9aa6b2',
      })),
    [data]
  );
  const bookingReferrers = useMemo(
    () => (data?.bookingClicksByReferrer || []).slice(0, 6).map((p) => ({ label: p.source, value: p.visits })),
    [data]
  );

  const timezoneLabel = data ? TIMEZONE_LABELS[data.timezone] || data.timezone : '';

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="page-sub">
          {data
            ? `${formatDayLong(data.from)} – ${formatDayLong(data.to)} · ${timezoneLabel} · anonymous public-site traffic.`
            : 'Loading anonymous public-site traffic…'}
        </p>
      </div>

      <div className="filter-bar">
        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value as PresetOption)}
          aria-label="Date range"
        >
          <option value="today">Today</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Custom range</option>
        </select>
        {preset === 'custom' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="Start date"
            />
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="End date"
            />
            <button type="button" className="btn btn-primary" onClick={applyCustomRange}>
              Apply
            </button>
          </>
        )}
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="kpi-grid two">
        <article className="kpi-card static">
          <div className="kpi-top">
            <span className="stat-icon">
              <Eye size={18} />
            </span>
          </div>
          <div className="kpi-value">{data?.totals.pageViews ?? '—'}</div>
          <div className="kpi-label">Page views</div>
          <Delta value={data?.deltas.pageViews ?? 0} days={data?.rangeDays ?? 30} />
        </article>
        <article className="kpi-card static">
          <div className="kpi-top">
            <span className="stat-icon">
              <MousePointerClick size={18} />
            </span>
          </div>
          <div className="kpi-value">{data?.totals.conversions ?? '—'}</div>
          <div className="kpi-label">Conversions</div>
          <Delta value={data?.deltas.conversions ?? 0} days={data?.rangeDays ?? 30} />
        </article>
      </div>

      <section className="card card-pad">
        <h2>Visitor trend</h2>
        <AreaChart points={trend} />
      </section>

      <div className="dash-split">
        <section className="card card-pad">
          <h2>Top pages</h2>
          <BarList points={pages} />
        </section>
        <section className="card card-pad">
          <h2>Devices</h2>
          <DonutChart
            slices={
              devices.length
                ? devices
                : [
                    { label: 'desktop', value: 0, color: DEVICE_COLORS.desktop },
                    { label: 'mobile', value: 0, color: DEVICE_COLORS.mobile },
                    { label: 'tablet', value: 0, color: DEVICE_COLORS.tablet },
                  ]
            }
          />
          <div className="device-pills" style={{ marginTop: '1rem' }}>
            <span className="device-pill">
              <Monitor size={15} /> Desktop
            </span>
            <span className="device-pill">
              <Smartphone size={15} /> Mobile
            </span>
            <span className="device-pill">
              <Tablet size={15} /> Tablet
            </span>
          </div>
        </section>
      </div>

      <div className="dash-split">
        <section className="card card-pad">
          <h2>Traffic sources</h2>
          <BarList points={sources} color="#5faf6b" />
        </section>
        <section className="card card-pad">
          <h2>Conversion mix</h2>
          <BarList points={conversions} color="#2f6691" />
        </section>
      </div>

      <section className="card card-pad">
        <h2>Top booking-intent pages</h2>
        <p className="page-sub">Pages where visitors clicked a Book an Appointment button. A click reflects booking intent, not a confirmed appointment.</p>
        <BarList points={bookingPages} color="#5faf6b" />
      </section>

      <div className="dash-split">
        <section className="card card-pad">
          <h2>Booking clicks by device</h2>
          <p className="page-sub">"Unknown" includes clicks recorded before device attribution existed.</p>
          <DonutChart
            slices={
              bookingDevices.length
                ? bookingDevices
                : [
                    { label: 'desktop', value: 0, color: DEVICE_COLORS.desktop },
                    { label: 'mobile', value: 0, color: DEVICE_COLORS.mobile },
                    { label: 'tablet', value: 0, color: DEVICE_COLORS.tablet },
                  ]
            }
          />
        </section>
        <section className="card card-pad">
          <h2>Booking clicks by referral source</h2>
          <p className="page-sub">"Direct" includes clicks with no referrer and clicks recorded before referrer attribution existed.</p>
          <BarList points={bookingReferrers} color="#2f6691" />
        </section>
      </div>
    </div>
  );
}
