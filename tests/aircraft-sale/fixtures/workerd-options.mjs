import { Miniflare as NativeMiniflare } from 'miniflare';

// Wrangler supplies the already bundled Worker as an explicit module. Doing
// the same here avoids Miniflare's source-discovery parser rejecting Better
// Auth's unused, variable node:sqlite import. The bundle is not rewritten.
export function workerdOptions(options) {
  if (Array.isArray(options.workers))
    return { ...options, workers: options.workers.map(workerdOptions) };
  const normalized = {
    ...options,
    compatibilityFlags: [
      ...new Set([...(options.compatibilityFlags || []), 'nodejs_compat']),
    ],
  };
  if (options.modules === true && typeof options.script === 'string') {
    delete normalized.script;
    normalized.modules = [
      { type: 'ESModule', path: 'worker-fixture.mjs', contents: options.script },
    ];
  }
  return normalized;
}

export class Miniflare extends NativeMiniflare {
  constructor(options) {
    super(workerdOptions(options));
  }
  setOptions(options) {
    return super.setOptions(workerdOptions(options));
  }
}
