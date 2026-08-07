'use client';

import {
  AXIS_ITEMS,
  AXIS_STEPS,
  type AxisPlannerKind,
} from '@/lib/axis-planner-data';
import { useMemo, useState } from 'react';

type Selection = Record<string, number>;

const money = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function buildAdvisories(kind: AxisPlannerKind, selection: Selection) {
  const has = (sku: string) => Boolean(selection[sku]);
  const quantityInStep = (step: string) =>
    AXIS_ITEMS[kind]
      .filter((item) => item.step === step)
      .reduce((sum, item) => sum + (selection[item.sku] || 0), 0);
  const notices: string[] = [];
  const displays = quantityInStep('1');

  if (!displays) notices.push('Select at least one AXIS display in Step 1.');
  if (displays > (kind === 'certified' ? 4 : 6)) {
    notices.push(
      `${kind === 'certified' ? 'Certified' : 'Experimental'} systems are limited to ${kind === 'certified' ? 'four' : 'six'} displays.`,
    );
  }
  if (quantityInStep('1A') < displays) {
    notices.push(
      'Confirm one compatible display install kit for every selected display.',
    );
  }
  if (!quantityInStep('2'))
    notices.push('Select the required core system sensor kit.');
  if (kind === 'certified' && !quantityInStep('3')) {
    notices.push(
      'Certified AXIS installations require a standby flight instrument.',
    );
  }
  if (has('010-03001-00') || has('010-03002-00')) {
    if (!has('010-02639-00'))
      notices.push(
        'An integrated IFR GPS display requires a GA 35S GPS/WAAS antenna.',
      );
  }
  if (has('010-01329-01') && !has('010-03001-00') && !has('010-03002-00')) {
    notices.push(
      'GEA 110 requires an AXIS display with integrated COMM or NAV/COMM.',
    );
  }
  const hasRemoteGdl = AXIS_ITEMS[kind].some(
    (item) =>
      item.step === '7' && /GDL (50|51|52)R/.test(item.title) && has(item.sku),
  );
  const gdlConnector = kind === 'certified' ? '011-04170-00' : '010-12498-60';
  if (hasRemoteGdl && !has(gdlConnector))
    notices.push(
      'Selected remote GDL equipment requires the matching remote-mount connector kit.',
    );
  const hasSirius = AXIS_ITEMS[kind].some(
    (item) =>
      item.step === '7' && /GDL (51|52)R/.test(item.title) && has(item.sku),
  );
  if (hasSirius && !has('010-12498-50'))
    notices.push('A SiriusXM-capable GDL requires a GA 24 TNC antenna.');
  if (kind === 'experimental' && has('010-01068-20')) {
    const servos = selection['010-01068-20'];
    const connectorCount =
      (selection['011-02950-00'] || 0) + (selection['011-02950-01'] || 0);
    if (connectorCount < servos)
      notices.push('Select one GSA 28 connector kit for each autopilot servo.');
  }
  return notices;
}

export default function AxisBuildPlanner({ kind }: { kind: AxisPlannerKind }) {
  const [selection, setSelection] = useState<Selection>({});
  const items = AXIS_ITEMS[kind];
  const steps = AXIS_STEPS[kind];
  const selectedItems = useMemo(
    () => items.filter((item) => selection[item.sku]),
    [items, selection],
  );
  const total = selectedItems.reduce(
    (sum, item) => sum + item.price * selection[item.sku],
    0,
  );
  const advisories = buildAdvisories(kind, selection);

  const setQuantity = (sku: string, quantity: number) => {
    setSelection((current) => {
      const next = { ...current };
      if (quantity > 0) next[sku] = Math.min(6, Math.max(1, quantity));
      else delete next[sku];
      return next;
    });
  };

  const submitBuild = () => {
    const lines = selectedItems.map(
      (item) =>
        `${selection[item.sku]} × ${item.sku} — ${money.format(item.price * selection[item.sku])}`,
    );
    const message = [
      `AXIS ${kind === 'certified' ? 'Certified' : 'Experimental'} Build-A-System Planner submission`,
      '',
      ...lines,
      '',
      `Hardware retail total: ${money.format(total)}`,
      '',
      advisories.length
        ? `Planner advisories:\n- ${advisories.join('\n- ')}`
        : 'Planner advisories: None shown.',
      '',
      'Please review aircraft eligibility, compatibility, required installation hardware, labor and special package pricing.',
    ].join('\n');
    window.sessionStorage.setItem('rwas-contact-draft', message);
  };

  return (
    <div className="space-y-7">
      <div className="border-l-4 border-black bg-white p-5">
        <p className="bs-kicker">Garmin July 2026 guide pricing</p>
        <p className="bs-body mt-2">
          Check each component and set its quantity. This planning estimate
          covers listed hardware only; it is not an approved configuration or
          installation quote. RWAS will confirm aircraft eligibility,
          compatibility, required hardware and labor.
        </p>
      </div>

      {steps.map((step, index) => {
        const stepItems = items.filter((item) => item.step === step.id);
        return (
          <section key={step.id} className="border-2 border-black bg-white">
            <header className="border-b-2 border-black bg-neutral-100 px-5 py-4">
              <p className="bs-kicker">Step {step.id}</p>
              <h2 className="bs-section-head mt-1">{step.title}</h2>
              <p className="bs-body mt-2 max-w-4xl">{step.guidance}</p>
            </header>
            {stepItems.length ? (
              <ul className="divide-y divide-neutral-300">
                {stepItems.map((item) => {
                  const quantity = selection[item.sku] || 0;
                  return (
                    <li
                      key={item.sku}
                      className="grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 rounded-none border-2 border-black text-black focus:ring-black"
                          checked={Boolean(quantity)}
                          onChange={(event) =>
                            setQuantity(item.sku, event.target.checked ? 1 : 0)
                          }
                        />
                        <span>
                          <span className="block font-bold text-black">
                            {item.title}
                          </span>
                          <span className="mt-1 block font-mono text-xs uppercase tracking-wide text-neutral-600">
                            {item.sku}
                          </span>
                        </span>
                      </label>
                      <div className="flex items-center justify-between gap-4 pl-8 md:justify-end md:pl-0">
                        {quantity ? (
                          <label className="flex items-center gap-2 text-sm font-bold">
                            Qty
                            <input
                              type="number"
                              min={1}
                              max={6}
                              value={quantity}
                              onChange={(event) =>
                                setQuantity(
                                  item.sku,
                                  Number(event.target.value),
                                )
                              }
                              className="w-16 border-2 border-black px-2 py-1 text-center"
                            />
                          </label>
                        ) : null}
                        <span className="min-w-24 text-right font-bold tabular-nums">
                          {money.format(item.price)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="bs-body px-5 py-4">
                {kind === 'certified' && index === 5
                  ? 'Autopilot components are aircraft-specific. RWAS will select the approved GFC 500 hardware during configuration review.'
                  : 'RWAS will confirm the aircraft-specific components for this step.'}
              </p>
            )}
          </section>
        );
      })}

      <section
        className="border-4 border-black bg-white p-5 md:p-7"
        aria-live="polite"
      >
        <p className="bs-kicker">Build summary</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b-2 border-black pb-4">
          <h2 className="bs-section-head">Hardware retail total</h2>
          <p className="text-3xl font-black tabular-nums md:text-4xl">
            {money.format(total)}
          </p>
        </div>
        <p className="bs-body mt-4">
          {selectedItems.length} selected component
          {selectedItems.length === 1 ? '' : 's'} · Prices are reference list
          prices and subject to change.
        </p>
        {advisories.length ? (
          <div className="mt-5 border-l-4 border-amber-500 bg-amber-50 p-4">
            <p className="font-bold">Review before submitting</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {advisories.map((advisory) => (
                <li key={advisory}>{advisory}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {selectedItems.length ? (
          <a
            href={`/contact?reason=quote&product=${encodeURIComponent(`AXIS ${kind === 'certified' ? 'Certified' : 'Experimental'} System Build`)}&source=axis-build-planner&draft=axis`}
            onClick={submitBuild}
            className="bs-cta-primary mt-6 inline-flex"
          >
            Submit Your Build to RWAS for Special Pricing
          </a>
        ) : (
          <span
            aria-disabled="true"
            className="bs-cta-primary mt-6 inline-flex cursor-not-allowed opacity-50"
          >
            Select hardware before submitting
          </span>
        )}
        <p className="mt-3 text-sm text-neutral-600">
          Your submitted build is delivered to the RWAS Avionics Desk by email
          and to Shop Talk in Microsoft Teams.
        </p>
      </section>
    </div>
  );
}
