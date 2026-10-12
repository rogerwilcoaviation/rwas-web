import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_BROWSER_TIMEOUT_MS,
  scheduleAbsoluteDeadline,
} from '../../app/seller-accounts/authority-deadline.ts';

function fakeClock(initial = 1_700_000_000_000) {
  let now = initial;
  const timers = [];
  return {
    timers,
    setNow(value) { now = value; },
    now: () => now,
    schedule(callback, delayMs) {
      assert.ok(Number.isFinite(delayMs));
      assert.ok(delayMs >= 0 && delayMs <= 2_147_483_647);
      const timer = { callback, delayMs, cancelled: false };
      timers.push(timer);
      return () => { timer.cancelled = true; };
    },
  };
}

test('a 30-day authority waits across the browser timer limit without early expiry', () => {
  const clock = fakeClock();
  const start = clock.now();
  const deadline = start + 30 * 24 * 60 * 60 * 1000;
  const expirations = [];
  scheduleAbsoluteDeadline(deadline, () => expirations.push(clock.now()), clock);

  assert.equal(clock.timers[0].delayMs, MAX_BROWSER_TIMEOUT_MS);
  assert.deepEqual(expirations, []);
  clock.setNow(start + MAX_BROWSER_TIMEOUT_MS);
  clock.timers[0].callback();
  assert.deepEqual(expirations, []);
  assert.equal(clock.timers.length, 2);
  assert.equal(clock.timers[1].delayMs, deadline - clock.now());

  clock.setNow(deadline);
  clock.timers[1].callback();
  assert.deepEqual(expirations, [deadline]);
  clock.timers[0].callback();
  clock.timers[1].callback();
  assert.deepEqual(expirations, [deadline]);
  assert.equal(clock.timers.length, 2);
});

test('premature callbacks and wall-clock changes recheck the absolute deadline', () => {
  const clock = fakeClock(1000);
  const expirations = [];
  scheduleAbsoluteDeadline(21000, () => expirations.push(clock.now()), clock);

  clock.setNow(6000);
  clock.timers[0].callback();
  assert.deepEqual(expirations, []);
  assert.equal(clock.timers[1].delayMs, 15000);
  clock.timers[0].callback(); // An obsolete queued callback cannot rearm.
  assert.equal(clock.timers.length, 2);

  clock.setNow(4000); // The wall clock moves backwards before the next callback.
  clock.timers[1].callback();
  assert.deepEqual(expirations, []);
  assert.equal(clock.timers[2].delayMs, 17000);
  clock.setNow(25000);
  clock.timers[2].callback();
  assert.deepEqual(expirations, [25000]);
});

test('cleanup cancels a rearmed timer and queued obsolete expiry cannot affect replacement authority', () => {
  const clock = fakeClock(0);
  const expirations = [];
  const cancelOld = scheduleAbsoluteDeadline(10000, () => expirations.push('old'), clock);
  clock.setNow(5000);
  clock.timers[0].callback();
  cancelOld();
  assert.equal(clock.timers[1].cancelled, true);

  const cancelNew = scheduleAbsoluteDeadline(20000, () => expirations.push('new'), clock);
  clock.setNow(10000);
  clock.timers[0].callback();
  clock.timers[1].callback(); // Simulate a callback already queued at cancellation.
  cancelOld();
  assert.deepEqual(expirations, []);
  assert.equal(clock.timers.length, 3);
  assert.equal(clock.timers[2].cancelled, false);

  clock.setNow(20000);
  clock.timers[2].callback();
  assert.deepEqual(expirations, ['new']);
  cancelNew();
});

test('an already expired or invalid deadline expires asynchronously only once', () => {
  for (const deadline of [499, Number.NaN, Number.POSITIVE_INFINITY]) {
    const clock = fakeClock(500);
    let expired = 0;
    const cancel = scheduleAbsoluteDeadline(deadline, () => expired++, clock);
    assert.equal(expired, 0);
    assert.equal(clock.timers[0].delayMs, 0);
    clock.timers[0].callback();
    clock.timers[0].callback();
    cancel();
    assert.equal(expired, 1);
    assert.equal(clock.timers.length, 1);
  }
});
