import { compactPartNumber, normalizePartText } from '@/lib/part-search';

export const SITE_SEARCH_GROUPS = [
  'Services',
  'Products',
  'Articles',
  'Planning tools',
] as const;

export type SiteSearchGroup = (typeof SITE_SEARCH_GROUPS)[number];

export type SiteSearchEntry = {
  group: SiteSearchGroup;
  title: string;
  href: string;
  description: string;
  handle?: string;
  skus?: readonly string[];
  keywords?: readonly string[];
};

export type SiteSearchMatch = SiteSearchEntry & { score: number };

const SEARCH_TERM_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bultraviolet\b/g, 'uv'],
  [/\bpowdercoat(?:ing)?\b/g, 'powder coating'],
  [/\bpoweder\b/g, 'powder'],
  [/\bpritning\b/g, 'printing'],
];

export function normalizeSiteSearchQuery(value: string) {
  return SEARCH_TERM_ALIASES.reduce(
    (normalized, [pattern, replacement]) =>
      normalized.replace(pattern, replacement),
    normalizePartText(value),
  );
}

function searchableText(entry: SiteSearchEntry) {
  return normalizePartText(
    [
      entry.title,
      entry.description,
      ...(entry.skus || []),
      ...(entry.keywords || []),
    ].join(' '),
  );
}

/** Matches every text term; formatting-only SKU differences are exact matches. */
export function searchSiteIndex(
  entries: readonly SiteSearchEntry[],
  query: string,
): SiteSearchMatch[] {
  const normalizedQuery = normalizeSiteSearchQuery(query);
  if (!normalizedQuery) return [];
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);
  const compactQuery = compactPartNumber(query);
  return entries
    .flatMap((entry, sourceIndex) => {
      const text = searchableText(entry);
      const normalizedTitle = normalizePartText(entry.title);
      const exactSku =
        /\d/.test(compactQuery) &&
        (entry.skus || []).some(
          (sku) => compactPartNumber(sku) === compactQuery,
        );
      if (!exactSku && !terms.every((term) => text.includes(term))) return [];
      let score = exactSku ? 10_000 : 0;
      if (normalizedTitle === normalizedQuery) score += 1_000;
      if (normalizedTitle.startsWith(normalizedQuery)) score += 400;
      if (normalizedTitle.includes(normalizedQuery)) score += 200;
      score +=
        terms.filter((term) => normalizedTitle.includes(term)).length * 25;
      score -= sourceIndex / 100_000;
      return [{ ...entry, score }];
    })
    .sort((a, b) => b.score - a.score);
}
