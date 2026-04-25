'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const THEMES = [
  'spring',
  'summer',
  'fall',
  'winter',
  'winter-storm',
  'easter',
  'memorial-day',
  'july-4',
  'veterans-day',
  'thanksgiving',
  'christmas',
] as const;

export default function SeasonalTheme() {
  const searchParams = useSearchParams();
  const theme = (searchParams.get('theme') || searchParams.get('season'))?.toLowerCase();

  useEffect(() => {
    const root = document.documentElement;
    for (const value of THEMES) {
      root.classList.remove(`season-${value}`);
      root.classList.remove(`theme-${value}`);
    }
    if (theme && (THEMES as readonly string[]).includes(theme)) {
      // Keep the original season-* classes for the four season previews, and
      // add theme-* for holiday/on-demand palettes.
      root.classList.add(`theme-${theme}`);
      if (['spring', 'summer', 'fall', 'winter'].includes(theme)) {
        root.classList.add(`season-${theme}`);
      }
    }
  }, [theme]);

  return null;
}
