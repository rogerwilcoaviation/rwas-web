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

/**
 * Matches every text term. A formatting-only SKU difference (for example,
 * 2332000300 vs 233-20003-00) is treated as an exact part-number match.
 */
export function searchSiteIndex(
  entries: readonly SiteSearchEntry[],
  query: string,
): SiteSearchMatch[] {
  const normalizedQuery = normalizePartText(query);
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
