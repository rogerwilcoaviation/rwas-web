import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.fetch = () => { throw new Error('Network forbidden in telemetry fixture'); };
const events = new EventTarget();
globalThis.addEventListener = events.addEventListener.bind(events);
globalThis.removeEventListener = events.removeEventListener.bind(events);
globalThis.document = { visibilityState: 'visible', prerendering: false };
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.PerformanceEventTiming = class {};
PerformanceEventTiming.prototype.interactionId = 0;
Object.defineProperty(globalThis, 'performance', { value: { now: () => 10000, interactionCount: 2, getEntriesByType: () => [] } });
const observers = [];
globalThis.PerformanceObserver = class {
  static supportedEntryTypes = ['paint', 'layout-shift', 'event', 'first-input'];
  constructor(cb) { this.cb = cb; this.types = []; observers.push(this); }
  observe(options) { this.types.push(options.type); }
  disconnect() { this.types = []; }
  takeRecords() { return []; }
};
async function emit(type, entries) {
  observers.filter(o => o.types.includes(type)).forEach(o => o.cb({ getEntries: () => entries }));
  await new Promise(resolve => setTimeout(resolve, 20));
}
function lifecycle(type, extras = {}) {
  const event = new Event(type);
  Object.assign(event, extras);
  events.dispatchEvent(event);
}
const { onCLS, onINP } = await import('web-vitals');
const cls = [], inp = [];
onCLS(m => cls.push(structuredClone(m)));
onINP(m => inp.push(structuredClone(m)));
await emit('paint', [{ name: 'first-contentful-paint', startTime: 100 }]);
await emit('layout-shift', [
  { value: 0.1, startTime: 200, hadRecentInput: false },
  { value: 0.1, startTime: 500, hadRecentInput: false },
]);
await emit('layout-shift', [
  { value: 0.15, startTime: 2500, hadRecentInput: false },
  { value: 0.9, startTime: 2700, hadRecentInput: true },
]);
await emit('event', [{ name: 'click', interactionId: 7, startTime: 2800, duration: 160, entryType: 'event' }]);
document.visibilityState = 'hidden'; lifecycle('visibilitychange');
assert.equal(cls.at(-1).value, 0.2, 'maximum session window, not lifetime 0.35');
assert.equal(inp.at(-1).value, 160, 'event timing produces INP');
const firstId = cls.at(-1).id;
document.visibilityState = 'visible'; lifecycle('pageshow', { persisted: true });
await new Promise(resolve => setTimeout(resolve, 25));
await emit('layout-shift', [{ value: 0.05, startTime: 8000, hadRecentInput: false }]);
await emit('event', [{ name: 'keydown', interactionId: 14, startTime: 8100, duration: 80, entryType: 'event' }]);
document.visibilityState = 'hidden'; lifecycle('visibilitychange');
assert.equal(cls.at(-1).value, 0.05);
assert.notEqual(cls.at(-1).id, firstId);
assert.equal(cls.at(-1).navigationType, 'back-forward-cache');
assert.equal(inp.at(-1).value, 80);
const client = readFileSync('public/rwas-analytics.js', 'utf8');
assert.match(client, /vitals.onCLS, vitals.onINP, vitals.onLCP, vitals.onFCP, vitals.onTTFB/);
assert.match(client, /feature === 'cart'\) feature = 'cart_open'/);
assert.doesNotMatch(client, /event = 'cart_add'/);
assert.match(client, /metricId: metric.id/);
console.log(JSON.stringify({ clsWindow: 0.2, lifetimeSumNotUsed: 0.35, inp: 160, bfcacheCLS: 0.05, bfcacheINP: 80, freshMetricId: true, cartOpenNotAdd: true, networkCalls: 0 }));
