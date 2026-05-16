'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const SeasonalTheme = dynamic(() => import('./seasonal-theme'), { ssr: false });
const WeatherEffects = dynamic(() => import('./weather-effects'), { ssr: false });

export default function ClientVisualEffects() {
  return (
    <Suspense fallback={null}>
      <SeasonalTheme />
      <WeatherEffects />
    </Suspense>
  );
}
