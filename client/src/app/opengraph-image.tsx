import { ImageResponse } from 'next/og';

/**
 * Branded 1200x630 social card, generated at build time.
 *
 * The source site used its 512x512 favicon as the Open Graph image while
 * declaring `summary_large_image`, so every share rendered as a cropped icon.
 */
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'LifeWell Family Health & Psychiatry — compassionate telehealth mental health care';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #f4f7fa 0%, #eef3f7 55%, #e8f0f7 100%)',
          padding: '72px 80px',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Brand rule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 6, background: '#3e7fb1', borderRadius: 999 }} />
          <div style={{ width: 20, height: 6, background: '#5faf6b', borderRadius: 999 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 26,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: '#2f6691',
              fontWeight: 600,
            }}
          >
            LifeWell Family Health &amp; Psychiatry
          </div>
          <div
            style={{
              marginTop: 24,
              fontSize: 62,
              lineHeight: 1.1,
              color: '#374151',
              fontWeight: 500,
              maxWidth: 900,
            }}
          >
            Personalized Mental Health Care for Mind and Body
          </div>
          <div style={{ marginTop: 26, fontSize: 30, color: '#5b6675', maxWidth: 820 }}>
            Compassionate, evidence-based psychiatric care — available through secure telehealth
            and in-person visits in Orlando.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 28,
            fontSize: 24,
            color: '#5b6675',
          }}
        >
          <span style={{ color: '#3d7a47', fontWeight: 600 }}>PMHNP-BC</span>
          <span>•</span>
          <span>Secure &amp; confidential</span>
          <span>•</span>
          <span>lifewellfhp.com</span>
        </div>
      </div>
    ),
    size
  );
}
