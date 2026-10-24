// Pure local planning. No API client, deployment, credentials or existing IDs.
export const PROBE = Object.freeze({
  name: 'rwas-jerry-alarm-qa-20261024',
  account: '08c51088fd98ea9214af8a0ae226663c',
  objects: 4,
  events: 200,
  controls: 30,
  records: 1000,
  bytes: 4 * 1024 * 1024,
  activeMs: 15 * 60000,
  cleanupMs: 24 * 3600000,
  classes: ['JerryConversationsProbe', 'JerryAdmissionProbe', 'ProbeControl'],
});
export function resourceManifest() {
  return {
    executionAuthorized: false,
    accountId: PROBE.account,
    worker: PROBE.name,
    workersDev: false,
    previewUrls: false,
    routes: [],
    cron: [],
    runWindow: null,
    namespaces: PROBE.classes.map((className) => ({
      name: PROBE.name + '_' + className,
      className,
      backend: 'sqlite',
    })),
    objects: [
      { className: PROBE.classes[0], name: 'synthetic:public' },
      { className: PROBE.classes[0], name: 'synthetic:exchange' },
      { className: PROBE.classes[1], name: 'website-admission-v1' },
      { className: PROBE.classes[2], name: 'seller-v2' },
    ],
    bindings: {
      JERRY_CONVERSATIONS: PROBE.classes[0],
      JERRY_ADMISSION: PROBE.classes[1],
      SELLER_STORE: PROBE.classes[2],
      PROBE_CONTROL: PROBE.classes[2],
    },
    externalBindings: [],
    egress: [],
    providerCalls: 0,
    d1: [],
    r2: [],
    kv: [],
    guards: {
      events: PROBE.events,
      controls: PROBE.controls,
      records: PROBE.records,
      bytes: PROBE.bytes,
      concurrency: 2,
      activeMs: PROBE.activeMs,
      cleanupMs: PROBE.cleanupMs,
      // Includes coordinator/sink metadata RPC overhead; event count is not a
      // Cloudflare request/spend cap. Actual platform billing needs readback.
      plannedInvocationEnvelope: 1024,
    },
  };
}
export function assertIsolatedManifest(value) {
  if (JSON.stringify(value) !== JSON.stringify(resourceManifest()))
    throw Error(
      'Only the exact unarmed isolated resource manifest is admitted.',
    );
  return true;
}
export function teardownPlan({
  pendingCopies,
  outboxes,
  unexpiredReceipts,
  alarms,
}) {
  if (
    [pendingCopies, outboxes, unexpiredReceipts, alarms].some(
      (n) => !Number.isSafeInteger(n) || n < 0,
    )
  )
    throw Error('Verified drain counts are required.');
  const pending = pendingCopies + outboxes + unexpiredReceipts + alarms;
  return {
    stopIngressAndCron: true,
    preserveClassesAndBindings: pending > 0,
    deleteClassesAndWorker: pending === 0,
    pending,
  };
}
