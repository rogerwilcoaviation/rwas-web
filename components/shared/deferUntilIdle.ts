'use client';

type DeferredTaskOptions = {
  minDelayMs?: number;
  timeoutMs?: number;
  events?: string[];
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

// minDelayMs keeps the fetch off the critical path without stranding the user on a
// skeleton. First paint completes ~70-170ms; anything above ~500ms here reads as
// "broken" to a visitor who does not scroll. Do not raise this without measuring.
export function deferUntilIdle(
  task: () => void,
  {
    minDelayMs = 200,
    timeoutMs = 2500,
    events = ['scroll', 'pointerdown', 'touchstart'],
  }: DeferredTaskOptions = {}
) {
  if (typeof window === 'undefined') return () => {};

  const win = window as WindowWithIdleCallback;
  let didRun = false;
  let idleHandle: number | null = null;
  let delayHandle: number | null = null;
  let fallbackHandle: number | null = null;

  const cleanup = () => {
    events.forEach((eventName) => {
      window.removeEventListener(eventName, run);
    });
    if (idleHandle !== null && win.cancelIdleCallback) {
      win.cancelIdleCallback(idleHandle);
    }
    if (delayHandle !== null) {
      window.clearTimeout(delayHandle);
    }
    if (fallbackHandle !== null) {
      window.clearTimeout(fallbackHandle);
    }
  };

  const run = () => {
    if (didRun) return;
    didRun = true;
    cleanup();
    task();
  };

  events.forEach((eventName) => {
    window.addEventListener(eventName, run, { passive: true, once: true });
  });

  delayHandle = window.setTimeout(() => {
    if (win.requestIdleCallback) {
      idleHandle = win.requestIdleCallback(run, { timeout: timeoutMs - minDelayMs });
    } else {
      fallbackHandle = window.setTimeout(run, timeoutMs - minDelayMs);
    }
  }, minDelayMs);

  return cleanup;
}
