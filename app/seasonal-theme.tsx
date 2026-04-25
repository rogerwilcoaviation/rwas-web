'use client';

import { useEffect, useMemo } from 'react';
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

type Theme = (typeof THEMES)[number];

const SEASONS: Theme[] = ['spring', 'summer', 'fall', 'winter'];
const THEME_LABELS: Record<Theme, string> = {
  spring: 'Spring Edition',
  summer: 'Summer Edition',
  fall: 'Fall Edition',
  winter: 'Winter Edition',
  'winter-storm': 'Winter Storm Edition',
  easter: 'Easter Edition',
  'memorial-day': 'Memorial Day Edition',
  'july-4': 'Fourth of July Edition',
  'veterans-day': 'Veterans Day Edition',
  thanksgiving: 'Thanksgiving Edition',
  christmas: 'Christmas Edition',
};

function easterDate(year: number): Date {
  // Anonymous Gregorian algorithm. Good through the lifetime of the website,
  // and then some — unlike most hangar coffee pots.
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month + 1, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

function withinDays(date: Date, target: Date, before: number, after: number): boolean {
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const center = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffDays = Math.round((today - center) / 86_400_000);
  return diffDays >= -before && diffDays <= after;
}

function autoHoliday(date = new Date()): Theme | null {
  const year = date.getFullYear();
  const easter = easterDate(year);
  const memorial = lastWeekdayOfMonth(year, 4, 1); // last Monday in May
  const july4 = new Date(year, 6, 4);
  const veterans = new Date(year, 10, 11);
  const thanksgiving = nthWeekdayOfMonth(year, 10, 4, 4); // fourth Thursday in November
  const christmas = new Date(year, 11, 25);

  if (withinDays(date, easter, 5, 1)) return 'easter';
  if (withinDays(date, memorial, 4, 1)) return 'memorial-day';
  if (withinDays(date, july4, 5, 2)) return 'july-4';
  if (withinDays(date, veterans, 3, 1)) return 'veterans-day';
  if (withinDays(date, thanksgiving, 5, 2)) return 'thanksgiving';
  if (withinDays(date, christmas, 21, 7)) return 'christmas';
  return null;
}

function autoSeason(date = new Date()): Theme {
  const month = date.getMonth();
  if (month >= 2 && month <= 4) return 'spring';
  if (month >= 5 && month <= 7) return 'summer';
  if (month >= 8 && month <= 10) return 'fall';
  return 'winter';
}

function isTheme(value?: string | null): value is Theme {
  return !!value && (THEMES as readonly string[]).includes(value);
}

function resolveTheme(searchParams: URLSearchParams): { theme: Theme | null; source: string } {
  const explicit = (searchParams.get('theme') || searchParams.get('season'))?.toLowerCase();
  if (isTheme(explicit)) return { theme: explicit, source: 'Manual preview' };

  // `autoTheme=1` is intentionally opt-in while we polish. Production can flip
  // to auto later with one controlled change instead of another round of surgery.
  if (searchParams.get('autoTheme') === '1') {
    const holiday = autoHoliday();
    if (holiday) return { theme: holiday, source: 'Auto holiday' };
    return { theme: autoSeason(), source: 'Auto season' };
  }

  return { theme: null, source: 'Default live theme' };
}

export default function SeasonalTheme() {
  const searchParams = useSearchParams();
  const { theme, source } = useMemo(() => resolveTheme(searchParams), [searchParams]);
  const showBadge = searchParams.get('themeBadge') !== '0' && (theme || searchParams.get('autoTheme') === '1');

  useEffect(() => {
    const root = document.documentElement;
    for (const value of THEMES) {
      root.classList.remove(`season-${value}`);
      root.classList.remove(`theme-${value}`);
    }
    root.dataset.rwasTheme = theme || 'default';
    root.dataset.rwasThemeSource = source;

    if (theme) {
      root.classList.add(`theme-${theme}`);
      if (SEASONS.includes(theme)) root.classList.add(`season-${theme}`);
    }
  }, [source, theme]);

  if (!showBadge || !theme) return null;

  return (
    <div className="theme-preview-badge" aria-hidden="true">
      <span>{THEME_LABELS[theme]}</span>
      <small>{source}</small>
    </div>
  );
}
