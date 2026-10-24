export const LANGUAGE_VERSION = 'site-language-v1';
export const LANGUAGES = ['en', 'pt-BR', 'es'];
export const languageForPath = (path) =>
  /^\/pt-br(?:\/|$)/.test(path)
    ? 'pt-BR'
    : /^\/es(?:\/|$)/.test(path)
      ? 'es'
      : 'en';
export const normalizeText = (text) =>
  String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
export const sourceId = async (text, language = 'en') =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(language + '\n' + normalizeText(text)),
      ),
    ),
  )
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('');
export const pageKey = async (path) => sourceId(path, 'path');
export const safePage = (path) =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  path.length <= 400 &&
  !/[?#\\\u0000-\u001f]/.test(path) &&
  !path.split('/').some((part) => part === '..' || part === '.') &&
  !/^\/(?:api|_next|_site-language|ops|work-order-system)(?:\/|$)/.test(path);
export function protectText(text) {
  const values = [];
  const protectedText = text.replace(
    /__RWAS_DYNAMIC\d+__|https?:\/\/[^\s<>]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|Roger Wilco Aviation(?: Services)?|Aviation Exchange|Papa-Alpha|AXIS Build-A-System|\b(?:RWAS|FAA|AXIS|GFC|GTN|GSA|GAD|GDL|GTR|GMA|GTX|Garmin|Cessna|Piper|Cirrus|Jerry|KYKN|ADS-B|GPS|NAV|COMM|IFR|VFR|STC|NDT|A&P|IA)\b|\b[A-Za-z]+[\d][A-Za-z\d./-]*\b|[+-]?\d[\d.,:/-]*(?:\s?(?:USD|EUR|BRL|lb|lbs|kg|ft|in|mph|kt|kts|NM|MHz|GHz|V|W|AH))?/gi,
    (value) => {
      const token = `__RWAS_KEEP${values.length}__`;
      values.push(value);
      return token;
    },
  );
  return { text: protectedText, values };
}
export function restoreText(text, values) {
  if (
    typeof text !== 'string' ||
    !text.trim() ||
    values.some((_, i) => text.split(`__RWAS_KEEP${i}__`).length !== 2)
  )
    throw Error('Translation changed a protected identifier.');
  const restored = text.replace(/__RWAS_KEEP(\d+)__/g, (_, i) => {
    if (!values[i]) throw Error('Unknown translation identifier.');
    return values[i];
  });
  if (/__RWAS_KEEP\d+__/.test(restored))
    throw Error('Unresolved translation identifier.');
  return restored;
}
export function metadataOnlyEntry(entry) {
  return (
    entry &&
    typeof entry.text === 'string' &&
    entry.text.length <= 5000 &&
    LANGUAGES.includes(entry.language) &&
    /^[a-f0-9]{64}$/.test(entry.id)
  );
}
