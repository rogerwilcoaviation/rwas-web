'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

const SEASONS = ['spring', 'summer', 'fall', 'winter'] as const;

export default function SeasonalTheme() {
  const searchParams = useSearchParams();
  const season = searchParams.get('season')?.toLowerCase();

  useEffect(() => {
    const root = document.documentElement;
    for (const value of SEASONS) root.classList.remove(`season-${value}`);
    if (season && (SEASONS as readonly string[]).includes(season)) {
      root.classList.add(`season-${season}`);
    }
  }, [season]);

  return null;
}
