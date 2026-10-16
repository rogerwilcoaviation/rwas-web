export const MAX_BROWSER_TIMEOUT_MS = 2_147_483_647;

export type DeadlineClock = {
  now: () => number;
  schedule: (callback: () => void, delayMs: number) => () => void;
};

const browserClock: DeadlineClock = {
  now: () => Date.now(),
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

// Long waits are split without changing the authority's absolute expiry.
export function scheduleAbsoluteDeadline(
  deadlineAt: number,
  onExpire: () => void,
  clock: DeadlineClock = browserClock,
): () => void {
  let cancelled = false;
  let generation = 0;
  let cancelTimer: (() => void) | undefined;

  const arm = () => {
    const timerGeneration = ++generation;
    const remaining = deadlineAt - clock.now();
    const delay = Number.isFinite(remaining)
      ? Math.min(MAX_BROWSER_TIMEOUT_MS, Math.max(0, remaining))
      : 0;
    cancelTimer = clock.schedule(() => {
      if (cancelled || timerGeneration !== generation) return;
      cancelTimer = undefined;
      if (!Number.isFinite(deadlineAt) || clock.now() >= deadlineAt) {
        cancelled = true;
        generation++;
        onExpire();
      } else {
        arm();
      }
    }, delay);
  };

  arm();
  return () => {
    cancelled = true;
    generation++;
    cancelTimer?.();
    cancelTimer = undefined;
  };
}
