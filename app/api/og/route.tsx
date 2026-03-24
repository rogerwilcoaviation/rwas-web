import { ImageResponse } from '@vercel/og';
import { colors } from '@/data/config/colors';
import { metadata } from '@/data/config/metadata';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${colors.secondary.main} 0%, ${colors.secondary.darker} 100%)`,
          color: 'white',
          padding: '64px',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at top right, ${colors.primary.main}55, transparent 30%)`,
          }}
        />
        <div
          style={{
            width: 140,
            height: 140,
            borderRadius: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${colors.primary.main}22`,
            border: `3px solid ${colors.primary.main}`,
            fontSize: 56,
            fontWeight: 800,
            zIndex: 1,
          }}
        >
          RW
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginTop: 32,
            zIndex: 1,
          }}
        >
          <div style={{ fontSize: 56, fontWeight: 800, textAlign: 'center' }}>
            Roger Wilco Aviation Services
          </div>
          <div
            style={{
              fontSize: 28,
              color: colors.primary.light,
              marginTop: 20,
              textAlign: 'center',
              maxWidth: 980,
            }}
          >
            {metadata.description}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
