'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, Globe, MousePointerClick, Smartphone, Monitor, Tablet } from 'lucide-react';
import { api } from '@/lib/api';
import { AreaChart, BarList, DonutChart } from '@/components/charts';

type Summary = {
  rangeDays: number;
  totals: { pageViews: number; sessions: number; conversions: number };
  deltas: { pageViews: number; sessions: number; conversions: number };
  popularPages: { path: string; views: number }[];
  devices: Record<string, number>;
  trafficSources: { source: string; visits: number }[];
  trends: { date: string; views: number }[];
  conversionCounts: Record<string, number>;
  topBookingPages: { path: string; clicks: number }[];
};

const DEVICE_COLORS: Record<string, string> = {
  desktop: '#3e7fb1',
  mobile: '#5faf6b',
  tablet: '#2f6691',
  unknown: '#9aa6b2',
};

function formatDay(iso: string) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function Delta({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className={`kpi-delta ${up ? 'up' : 'down'}`}>
      {up ? '+' : ''}
      {value}% vs prior 30 days
    </span>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api<Summary>('/api/admin/analytics/summary').then((res) => {
      if (!res.success) setError(res.message || 'Failed to load analytics');
      else setData(res.data || null);
    });
  }, []);

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

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Analytics</h1>
        <p className="page-sub">Last {data?.rangeDays ?? 30} days of anonymous public-site traffic.</p>
      </div>

      {error ? <div className="error-banner">{error}</div> : null}

      <div className="kpi-grid three">
        <article className="kpi-card static">
          <div className="kpi-top">
            <span className="stat-icon">
              <Eye size={18} />
            </span>
          </div>
          <div className="kpi-value">{data?.totals.pageViews ?? '—'}</div>
          <div className="kpi-label">Page views</div>
          <Delta value={data?.deltas.pageViews ?? 0} />
        </article>
        <article className="kpi-card static">
          <div className="kpi-top">
            <span className="stat-icon">
              <Globe size={18} />
            </span>
          </div>
          <div className="kpi-value">{data?.totals.sessions ?? '—'}</div>
          <div className="kpi-label">Sessions</div>
          <Delta value={data?.deltas.sessions ?? 0} />
        </article>
        <article className="kpi-card static">
          <div className="kpi-top">
            <span className="stat-icon">
              <MousePointerClick size={18} />
            </span>
          </div>
          <div className="kpi-value">{data?.totals.conversions ?? '—'}</div>
          <div className="kpi-label">Conversions</div>
          <Delta value={data?.deltas.conversions ?? 0} />
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
    </div>
  );
}
