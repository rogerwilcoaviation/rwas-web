export function stripHtml(input = '') {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function compactText(input = '') {
  return stripHtml(input)
    .replace(/Click here for Garmin's Buy\s*&\s*Save rebate form\.?\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncateMeta(input: string, max = 155) {
  const clean = compactText(input);
  if (clean.length <= max) return clean;
  const clipped = clean.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 80 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

export function productSeoTitle(title: string) {
  const clean = compactText(title);
  const suffix = ' | RWAS';
  const max = 60 - suffix.length;
  if (clean.length <= max) return `${clean}${suffix}`;
  const clipped = clean.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 28 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…${suffix}`;
}

export function collectionSeoTitle(title: string) {
  const clean = compactText(title);
  const suffix = ' | RWAS';
  const max = 60 - suffix.length;
  if (clean.length <= max) return `${clean}${suffix}`;
  const clipped = clean.slice(0, max - 1);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 28 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…${suffix}`;
}
