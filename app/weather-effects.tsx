'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type WeatherEffect = 'none' | 'snow' | 'thunderstorm' | 'icing';

const AIRPORT = 'KYKN';
const MAX_AGE_HOURS = 12;

function classify(raw: string): WeatherEffect {
  const text = raw.toUpperCase();

  // Thunderstorms first — TS usually matters more visually than precip type.
  if (/\b(?:TS|VCTS|TSRA|TSGR|TSGS|CB)\b/.test(text)) return 'thunderstorm';

  // Surface freezing/frozen precip signals. True in-flight icing needs AIRMETs/
  // icing products, but John asked for METAR/TAF-driven events, so keep this
  // conservative and obvious.
  if (/\b(?:FZRA|FZDZ|FZFG|PL|SG|IC|UP)\b/.test(text)) return 'icing';

  // Snow/flurries/blowing snow.
  if (/\b(?:SN|SHSN|BLSN|DRSN)\b/.test(text)) return 'snow';

  return 'none';
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();
  return JSON.stringify(data);
}

export default function WeatherEffects() {
  const searchParams = useSearchParams();
  const manualEffect = searchParams.get('effect')?.toLowerCase();
  const theme = (searchParams.get('theme') || searchParams.get('season'))?.toLowerCase();
  const [autoEffect, setAutoEffect] = useState<WeatherEffect>('none');

  const effect = useMemo<WeatherEffect>(() => {
    if (manualEffect && ['none', 'snow', 'thunderstorm', 'icing'].includes(manualEffect)) {
      return manualEffect as WeatherEffect;
    }
    if (theme === 'winter-storm') return 'snow';
    if (theme === 'christmas') return 'snow';
    return autoEffect;
  }, [autoEffect, manualEffect, theme]);

  useEffect(() => {
    if (manualEffect || theme === 'winter-storm' || theme === 'christmas') return;

    let cancelled = false;
    const params = `ids=${AIRPORT}&format=json&hours=${MAX_AGE_HOURS}`;

    Promise.allSettled([
      fetchText(`https://aviationweather.gov/api/data/metar?${params}`),
      fetchText(`https://aviationweather.gov/api/data/taf?${params}`),
    ]).then((results) => {
      if (cancelled) return;
      const raw = results
        .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
        .map((r) => r.value)
        .join('\n');
      setAutoEffect(classify(raw));
    });

    return () => {
      cancelled = true;
    };
  }, [manualEffect, theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.weatherEffect = effect;
    return () => {
      if (root.dataset.weatherEffect === effect) root.dataset.weatherEffect = 'none';
    };
  }, [effect]);

  if (effect === 'none') return null;

  return (
    <div className={`weather-effects weather-effects--${effect}`} aria-hidden="true">
      {effect === 'snow' && <Snow />}
      {effect === 'icing' && <Icing />}
      {effect === 'thunderstorm' && <Thunderstorm />}
    </div>
  );
}

function Snow() {
  return (
    <>
      <div className="weather-snow weather-snow--near" />
      <div className="weather-snow weather-snow--far" />
    </>
  );
}

function Icing() {
  return (
    <>
      <div className="weather-ice weather-ice--veil" />
      <div className="weather-ice weather-ice--crystals" />
    </>
  );
}

function Thunderstorm() {
  return (
    <>
      <div className="weather-rain weather-rain--near" />
      <div className="weather-rain weather-rain--far" />
      <div className="weather-lightning" />
    </>
  );
}
