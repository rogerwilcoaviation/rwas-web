// Narrow structural D1 types keep Pages independent of generated Worker globals.
export interface Statement {
  bind(...values: (string | number | null)[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{
    results: T[];
    success: boolean;
  }>;
  run(): Promise<unknown>;
}
export interface Database {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<unknown[]>;
}
export interface Env {
  INTAKE_RECEIPTS?: Database;
  INTAKE_DISPATCH_SECRET?: string;
  RESEND_API_KEY?: string;
  CONTACT_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  TURNSTILE_SECRET_KEY?: string;
}
export type Context = { request: Request; env: Env };
export const ORIGINS = new Set([
  'https://www.rogerwilcoaviation.com',
  'https://rogerwilcoaviation.com',
]);
export const WINDOW = 23 * 60 * 60 * 1000;
export const DAILY_CAP = 50;
export function json(body: unknown, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  });
}
export const unavailable = () =>
  json({ error: 'Service temporarily unavailable.' }, 503);
export const methodNotAllowed = () =>
  json({ error: 'Method not allowed.' }, 405);
const encoder = new TextEncoder();
export function hex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function hash(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}
export async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}
export async function secretEquals(a: string, b: string) {
  const [x, y] = await Promise.all([hash(a), hash(b)]);
  let mismatch = 0;
  for (let i = 0; i < 64; i++) mismatch |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return mismatch === 0;
}
export function configured(env: Env, turnstile = false): boolean {
  const email = /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/;
  const from = env.CONTACT_FROM_EMAIL?.trim() || '';
  const address = from.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] || from;
  return Boolean(
    env.INTAKE_RECEIPTS &&
      env.INTAKE_DISPATCH_SECRET &&
      env.INTAKE_DISPATCH_SECRET.length >= 32 &&
      env.RESEND_API_KEY?.trim() &&
      email.test(env.CONTACT_TO_EMAIL || '') &&
      email.test(address) &&
      !/[\r\n]/.test(from) &&
      (!turnstile || env.TURNSTILE_SECRET_KEY?.trim()),
  );
}
export class InvalidBody extends Error {}
export async function boundedJson(request: Request): Promise<unknown> {
  if (
    request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !==
    'application/json'
  )
    throw new InvalidBody();
  if (Number(request.headers.get('content-length')) > 16384 || !request.body)
    throw new InvalidBody();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) {
        await reader.cancel();
        throw new InvalidBody();
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new InvalidBody();
  }
}
export type Payload = {
  name: string;
  email: string;
  phone: string;
  aircraft: string;
  message: string;
  consent: true;
};
export function validate(raw: unknown): {
  payload: Payload;
  requestId: string;
  token: string;
} {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new InvalidBody();
  const p = raw as Record<string, unknown>;
  function field(key: string, max: number, min = 0, multiline = false) {
    if (p[key] === undefined && min === 0) return '';
    if (typeof p[key] !== 'string') throw new InvalidBody();
    const value = (p[key] as string)
      .normalize('NFC')
      .replace(/\r\n?/g, '\n')
      .trim();
    if (
      value.length < min ||
      encoder.encode(value).length > max ||
      /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value) ||
      (!multiline && /[\n\t]/.test(value))
    )
      throw new InvalidBody();
    return value;
  }
  const payload: Payload = {
    name: field('name', 120, 2),
    email: field('email', 254, 3).toLowerCase(),
    phone: field('phone', 40),
    aircraft: field('aircraft', 160),
    message: field('message', 8000, 10, true),
    consent: true,
  };
  if (
    p.consent !== true ||
    !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(payload.email) ||
    field('website', 200) !== ''
  )
    throw new InvalidBody();
  const requestId = field('requestId', 36, 36).toLowerCase();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
      requestId,
    )
  )
    throw new InvalidBody();
  return { payload, requestId, token: field('turnstileToken', 2048, 1) };
}
export function emailBody(env: Env, p: Payload, id: string) {
  return JSON.stringify({
    from: env.CONTACT_FROM_EMAIL!.trim(),
    to: [env.CONTACT_TO_EMAIL],
    subject: `RWAS service inquiry ${id}`,
    text: [
      `Service inquiry: ${id}`,
      `Name: ${p.name}`,
      `Email: ${p.email}`,
      `Phone: ${p.phone}`,
      `Aircraft: ${p.aircraft}`,
      'Consent to contact: yes',
      '',
      'Customer message (untrusted text):',
      p.message,
    ].join('\n'),
  });
}
