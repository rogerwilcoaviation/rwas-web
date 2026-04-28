'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

type WeatherEffect =
  | 'none'
  | 'snow'
  | 'thunderstorm'
  | 'icing'
  | 'fireworks'
  | 'flag'
  | 'leaves'
  | 'turkeys'
  | 'branch-flags'
  | 'easter';

export default function WeatherEffects() {
  const searchParams = useSearchParams();
  const manualEffect = searchParams.get('effect')?.toLowerCase();
  const theme = (searchParams.get('theme') || searchParams.get('season'))?.toLowerCase();
  const [autoEffect, setAutoEffect] = useState<WeatherEffect>('none');

  const effect = useMemo<WeatherEffect>(() => {
    if (
      manualEffect &&
      [
        'none',
        'snow',
        'thunderstorm',
        'icing',
        'fireworks',
        'flag',
        'leaves',
        'turkeys',
        'branch-flags',
        'easter',
      ].includes(
        manualEffect,
      )
    ) {
      return manualEffect as WeatherEffect;
    }
    if (theme === 'winter-storm') return 'snow';
    if (theme === 'christmas') return 'snow';
    if (theme === 'july-4') return 'fireworks';
    if (theme === 'memorial-day') return 'flag';
    if (theme === 'veterans-day') return 'branch-flags';
    if (theme === 'thanksgiving') return 'turkeys';
    if (theme === 'easter') return 'easter';
    return autoEffect;
  }, [autoEffect, manualEffect, theme]);

  useEffect(() => {
    if (
      manualEffect ||
      ['winter-storm', 'christmas', 'july-4', 'memorial-day', 'veterans-day', 'thanksgiving', 'easter'].includes(
        theme || '',
      )
    )
      return;

    // Avoid browser-side aviationweather.gov requests: the public API can reject
    // cross-origin browser fetches, creating noisy console errors on SEO crawls.
    // Seasonal/manual effects still work through ?effect= and ?theme=.
    setAutoEffect('none');
    return undefined;
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
      {effect === 'fireworks' && <Fireworks />}
      {effect === 'flag' && <Flag />}
      {effect === 'leaves' && <Leaves />}
      {effect === 'turkeys' && <Turkeys />}
      {effect === 'branch-flags' && <BranchFlags />}
      {effect === 'easter' && <Easter />}
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


function Fireworks() {
  return (
    <>
      <Flag />
      <div className="weather-firework weather-firework--one" />
      <div className="weather-firework weather-firework--two" />
      <div className="weather-firework weather-firework--three" />
      <div className="weather-sparkle weather-sparkle--patriotic" />
    </>
  );
}

function Flag() {
  return (
    <>
      <div className="weather-flag weather-flag--stripes" />
      <div className="weather-flag weather-flag--canton" />
      <div className="weather-flag weather-flag--stars" />
    </>
  );
}

function Leaves() {
  return (
    <>
      <div className="weather-leaves weather-leaves--near" />
      <div className="weather-leaves weather-leaves--far" />
    </>
  );
}

function Turkeys() {
  return (
    <div className="weather-turkeys">
      {Array.from({ length: 16 }).map((_, index) => (
        <span key={index} className={`weather-turkey weather-turkey--${index + 1}`}>
          🦃
        </span>
      ))}
    </div>
  );
}

const BRANCHES = ['Army', 'Navy', 'Air Force', 'Marines', 'Coast Guard', 'Space Force'];

function BranchFlags() {
  return (
    <>
      <Flag />
      <div className="weather-branch-flags">
        {BRANCHES.map((branch, index) => (
          <span key={branch} className={`weather-branch-flag weather-branch-flag--${index + 1}`}>
            {branch}
          </span>
        ))}
      </div>
    </>
  );
}

function Easter() {
  return (
    <>
      <div className="weather-easter weather-easter--pastels" />
      <div className="weather-easter weather-easter--eggs" />
    </>
  );
}
