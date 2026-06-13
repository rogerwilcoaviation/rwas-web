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

export function deferUntilIdle(
  task: () => void,
  {
    minDelayMs = 3500,
    timeoutMs = 8000,
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
