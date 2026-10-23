// Only marketplace chat turns and advisory research enter this module. Login
// form bodies, system prompts, raw provider responses and credentials do not.
export function troubleshootingText(value, limit = 12000) {
  return String(value || '')
    .split('\n\n[System context:')[0]
    .replace(/data:[^\s]+;base64,[a-z0-9+/=]+/gi, '[attachment omitted]')
    .replace(/\bBearer\s+[a-z0-9._~+\/-]+=*/gi, 'Bearer [redacted]')
    .replace(
      /\b(?:sk|rk|pk)_[a-z0-9_-]{20,}\b|\bsk-[a-z0-9_-]{20,}\b/gi,
      '[key redacted]',
    )
    .replace(
      /\beyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+\b/gi,
      '[token redacted]',
    )
    .replace(
      /\b(password|passcode|verification\s*code|backup\s*code|one[- ]time\s*code|mfa\s*code|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token)\s*[:=]\s*[^\s,;]+/gi,
      '$1: [redacted]',
    )
    .replace(
      /([?&](?:token|code|state|password|secret|key|signature)=)[^\s&#)]+/gi,
      '$1[redacted]',
    )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .slice(0, limit);
}
const safeURL = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    for (const key of url.searchParams.keys())
      if (/token|code|state|password|secret|signature|key/i.test(key))
        url.searchParams.set(key, '[redacted]');
    url.hash = '';
    return url.href.slice(0, 1200);
  } catch {
    return null;
  }
};
export function reviewSnapshot(review) {
  if (!review || typeof review !== 'object') return null;
  const evidence = {};
  for (const name of ['email', 'business', 'faa']) {
    const value = review.evidence?.[name];
    if (!value) continue;
    const item = { status: 'unavailable', summary: '' };
    for (const key of [
      'status',
      'summary',
      'title',
      'excerpt',
      'domain',
      'nNumber',
    ])
      if (typeof value[key] === 'string')
        item[key] = troubleshootingText(
          value[key],
          key === 'excerpt' ? 3000 : 1500,
        );
    if (Array.isArray(value.sources))
      item.sources = value.sources.slice(0, 8).map(safeURL).filter(Boolean);
    if (safeURL(value.url)) item.url = safeURL(value.url);
    for (const key of ['aircraft', 'matches'])
      if (value[key] && typeof value[key] === 'object')
        item[key] = Object.fromEntries(
          Object.entries(value[key])
            .slice(0, 12)
            .map(([k, v]) => [
              troubleshootingText(k, 80),
              troubleshootingText(v, 200),
            ]),
        );
    evidence[name] = item;
  }
  return {
    status: ['queued', 'researching', 'completed', 'stale'].includes(
      review.status,
    )
      ? review.status
      : 'unavailable',
    recommendation: ['ready_for_admin', 'needs_attention'].includes(
      review.recommendation,
    )
      ? review.recommendation
      : undefined,
    completedAt: Number.isFinite(review.completedAt)
      ? review.completedAt
      : undefined,
    summary: troubleshootingText(review.summary, 4000),
    findings: Array.isArray(review.findings)
      ? review.findings
          .slice(0, 15)
          .map((value) => troubleshootingText(value, 700))
      : [],
    model: troubleshootingText(review.model, 150),
    policy: troubleshootingText(review.policy, 150),
    aiUnavailable: review.aiUnavailable === true,
    evidence,
    authority: 'Advisory only; administrator decision required.',
  };
}
export function conversationTurn({
  id,
  mode,
  user,
  assistant,
  error,
  truncated,
}) {
  return {
    id: typeof id === 'string' && /^[a-f0-9-]{36}$/i.test(id) ? id : null,
    mode: mode === 'listing' ? 'listing' : 'general',
    messages: [
      { role: 'user', content: troubleshootingText(user, 5000) },
      ...(typeof assistant === 'string' && assistant
        ? [
            {
              role: 'assistant',
              content: troubleshootingText(assistant, 12000),
            },
          ]
        : []),
    ],
    ...(error ? { error: troubleshootingText(error, 150) } : {}),
    truncated:
      truncated === true ||
      String(user || '').length > 5000 ||
      String(assistant || '').length > 12000,
  };
}
