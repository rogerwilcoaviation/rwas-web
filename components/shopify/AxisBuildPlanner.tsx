'use client';

import {
  AXIS_ITEMS,
  AXIS_STEPS,
  type AxisPlannerKind,
} from '@/lib/axis-planner-data';
import { GFC500_CERTIFIED_AIRCRAFT } from '@/lib/gfc500-certified-catalog';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

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
  const servoSku = kind === 'certified' ? '010-01068-21' : '010-01068-20';
  if (has(servoSku)) {
    const servos = selection[servoSku];
    const connectorCount =
      (selection['011-02950-00'] || 0) + (selection['011-02950-01'] || 0);
    if (connectorCount < servos) {
      notices.push('Select one GSA 28 connector kit for each autopilot servo.');
    }
  }
  if (kind === 'certified' && has('010-01076-31') && !has('011-03241-01')) {
    notices.push('The GTR 20 requires its PMA connector kit.');
  }
  if (has('010-00562-00')) {
    const hasSupportedTrafficPath =
      has('010-01216-06') ||
      has('010-01217-06') ||
      has('010-02002-05') ||
      has('010-01999-05') ||
      has('010-02326-10') ||
      has('010-02326-20');
    if (!hasSupportedTrafficPath) {
      notices.push(
        'GTS 820 requires an approved indirect HSDB interface path through compatible equipment such as GTX 345, GTN Xi or GI 275.',
      );
    }
    if (hasRemoteGdl) {
      notices.push(
        'Review traffic-source compatibility: GTS 8XX cannot be combined with another ADS-B traffic source except an approved GTX 345 configuration.',
      );
    }
  }
  return notices;
}

export default function AxisBuildPlanner({ kind }: { kind: AxisPlannerKind }) {
  const [selection, setSelection] = useState<Selection>({});
  const [gfcAircraftId, setGfcAircraftId] = useState('');
  const [gfcConfigurationName, setGfcConfigurationName] = useState('');
  const [source, setSource] = useState('axis-build-planner');
  const [attribution, setAttribution] = useState<Record<string, string>>({});
  const items = AXIS_ITEMS[kind];
  const steps = AXIS_STEPS[kind].filter(
    (step) => kind !== 'certified' || step.id !== '5A',
  );
  const gfcAircraft = GFC500_CERTIFIED_AIRCRAFT.find(
    (aircraft) => aircraft.id === gfcAircraftId,
  );
  const gfcConfiguration = gfcAircraft?.configurations.find(
    (configuration) => configuration.name === gfcConfigurationName,
  );
  const selectedItems = useMemo(
    () => items.filter((item) => selection[item.sku]),
    [items, selection],
  );
  const total =
    selectedItems.reduce(
      (sum, item) => sum + item.price * selection[item.sku],
      0,
    ) + (gfcConfiguration?.listPrice || 0);
  const advisories = buildAdvisories(kind, selection);
  if (kind === 'certified' && gfcAircraft && !gfcConfiguration) {
    advisories.push(
      'Select a GFC 500 servo configuration for the chosen aircraft eligibility group.',
    );
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSource(params.get('source') || 'axis-build-planner');
    const preserved: Record<string, string> = {};
    for (const key of [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_content',
      'utm_term',
    ]) {
      const value = params.get(key);
      if (value) preserved[key] = value;
    }
    setAttribution(preserved);
  }, []);

  const setQuantity = (sku: string, quantity: number) => {
    setSelection((current) => {
      const next = { ...current };
      if (quantity > 0) next[sku] = Math.min(6, Math.max(1, quantity));
      else delete next[sku];
      return next;
    });
  };

  const submitBuild = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    // A new build gets a new key. The draft retains this key so retries of the
    // same contact submission remain idempotent without blocking later builds.
    const requestId = `rwas_axis_${Date.now().toString(36)}_${crypto.randomUUID().replace(/-/g, '')}`;
    const components = selectedItems.map((item) => ({
      title: item.title,
      sku: item.sku,
      quantity: selection[item.sku],
      unitPrice: item.price,
      extendedPrice: item.price * selection[item.sku],
    }));
    if (gfcAircraft && gfcConfiguration) {
      components.push({
        title: `GFC 500 — ${gfcAircraft.label} — ${gfcConfiguration.name}`,
        sku: `GARMIN-CATALOG-PAGE-${gfcAircraft.page}`,
        quantity: 1,
        unitPrice: gfcConfiguration.listPrice,
        extendedPrice: gfcConfiguration.listPrice,
      });
    }
    const lines = components.map(
      (item) =>
        `${item.quantity} × ${item.title} (${item.sku}) — ${money.format(item.extendedPrice)} [unit ${money.format(item.unitPrice)}]`,
    );
    const message = [
      `AXIS ${kind === 'certified' ? 'Certified' : 'Experimental'} preliminary build handoff`,
      '',
      ...lines,
      '',
      `Garmin July 2026 guide-pricing reference: hardware list pricing shown in planner`,
      `Hardware retail total: ${money.format(total)}`,
      `Planner kind: AXIS ${kind}`,
      `Request/build ID: ${requestId}`,
      `Source: ${source}`,
      '',
      advisories.length
        ? `Planner advisories:\n- ${advisories.join('\n- ')}`
        : 'Planner advisories: None shown.',
      '',
      'This is preliminary hardware planning—not an approved configuration or installed quote. Please review aircraft eligibility, compatibility, required installation hardware, labor and special package pricing.',
    ].join('\n');
    window.sessionStorage.setItem(
      'rwas-contact-draft',
      JSON.stringify({
        requestId,
        plannerKind: kind,
        createdAt: new Date().toISOString(),
        source,
        pricingReference: 'Garmin July 2026 Build-A-System Guide',
        message,
        components,
        gfc500Aircraft: gfcAircraft || null,
        gfc500Configuration: gfcConfiguration || null,
        advisories,
        attribution,
        total,
      }),
    );
    const panelComponents = components.filter((item) =>
      /display|gdu|gtn|gnc|gps 175|gnx 375|gtr|gma|audio panel|gmc 507|gi 275|\bg5\b|transponder|control head/i.test(
        item.title,
      ),
    );
    const handoff = {
      version: 1,
      requestId,
      kind,
      returnUrl: `/contact?${contactParams.toString()}`,
      components,
      panelComponents,
      advisories,
      total,
    };
    const encoded = btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(handoff))),
    )
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    window.location.href = `https://panelplanner.rwas.team/customer?axisBuild=${encoded}`;
  };

  const contactParams = new URLSearchParams({
    reason: 'quote',
    product: `AXIS ${kind === 'certified' ? 'Certified' : 'Experimental'} System Build`,
    source,
    draft: 'axis',
    ...attribution,
  });

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

      {steps.map((step) => {
        const stepItems = items.filter(
          (item) =>
            item.step === step.id &&
            !(
              kind === 'certified' &&
              (item.step === '5' || item.step === '5A')
            ),
        );
        return (
          <section key={step.id} className="border-2 border-black bg-white">
            <header className="border-b-2 border-black bg-neutral-100 px-5 py-4">
              <p className="bs-kicker">Step {step.id}</p>
              <h2 className="bs-section-head mt-1">{step.title}</h2>
              <p className="bs-body mt-2 max-w-4xl">{step.guidance}</p>
            </header>
            {kind === 'certified' && step.id === '5' ? (
              <div className="space-y-5 px-5 py-5">
                <label className="block max-w-3xl">
                  <span className="block font-bold text-black">
                    Aircraft eligibility group
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-neutral-700">
                    Choose the exact catalog group matching the aircraft model,
                    series and equipment. Leave blank if no new GFC 500 is being
                    quoted.
                  </span>
                  <select
                    value={gfcAircraftId}
                    onChange={(event) => {
                      setGfcAircraftId(event.target.value);
                      setGfcConfigurationName('');
                    }}
                    className="mt-2 w-full border-2 border-black bg-white px-3 py-2"
                  >
                    <option value="">No GFC 500 package selected</option>
                    {GFC500_CERTIFIED_AIRCRAFT.map((aircraft) => (
                      <option key={aircraft.id} value={aircraft.id}>
                        {aircraft.label} — catalog page {aircraft.page}
                      </option>
                    ))}
                  </select>
                </label>

                {gfcAircraft ? (
                  <div className="border-2 border-black">
                    <div className="border-b border-black bg-neutral-100 px-4 py-3">
                      <p className="font-bold">Applicable models</p>
                      <p className="mt-1 text-sm leading-5">
                        {gfcAircraft.models}
                      </p>
                      {gfcAircraft.notes ? (
                        <p className="mt-2 text-sm font-bold text-amber-900">
                          {gfcAircraft.notes}
                        </p>
                      ) : null}
                    </div>
                    <fieldset className="divide-y divide-neutral-300">
                      <legend className="sr-only">
                        GFC 500 servo configuration
                      </legend>
                      {gfcAircraft.configurations.map((configuration) => (
                        <label
                          key={configuration.name}
                          className="flex cursor-pointer items-start justify-between gap-4 px-4 py-4"
                        >
                          <span className="flex items-start gap-3">
                            <input
                              type="radio"
                              name="gfc500-configuration"
                              value={configuration.name}
                              checked={
                                gfcConfigurationName === configuration.name
                              }
                              onChange={() =>
                                setGfcConfigurationName(configuration.name)
                              }
                              className="mt-1 h-5 w-5 border-2 border-black text-black focus:ring-black"
                            />
                            <span>
                              <span className="block font-bold text-black">
                                {configuration.name}
                              </span>
                              <span className="mt-1 block max-w-3xl text-sm leading-5 text-neutral-700">
                                Catalog system price includes the GMC 507,
                                required GSA 28 servos and the aircraft-specific
                                Garmin installation kits listed for this
                                configuration.
                              </span>
                              {gfcConfigurationName === configuration.name ? (
                                <span className="mt-3 block border-l-2 border-black pl-3 text-xs leading-5 text-neutral-700">
                                  {configuration.components.map((component) => (
                                    <span key={component.sku} className="block">
                                      {component.quantity} × {component.title} (
                                      {component.sku}) —{' '}
                                      {money.format(component.listPrice)} each
                                    </span>
                                  ))}
                                  <span className="mt-1 block font-bold text-neutral-900">
                                    Some catalog rows list serial-number or
                                    installation alternatives. The system price
                                    above is authoritative; RWAS will select the
                                    applicable kit.
                                  </span>
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="min-w-24 text-right font-bold tabular-nums">
                            {money.format(configuration.listPrice)}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                  </div>
                ) : null}

                <p className="border-l-4 border-amber-500 bg-amber-50 p-4 text-sm leading-5">
                  Catalog pricing excludes the approved AHRS source because the
                  selected AXIS system supplies it. RWAS must verify the current
                  AML, MDL, equipment list, installation manual and
                  aircraft-specific addendum before quoting or installation.
                </p>
              </div>
            ) : stepItems.length ? (
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
                          <span className="mt-1 block max-w-3xl text-sm leading-5 text-neutral-700">
                            {item.description}
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
                RWAS will confirm the aircraft-specific components for this
                step.
              </p>
            )}
          </section>
        );
      })}

      <section
        className="border-4 border-black bg-white p-5 md:p-7"
        aria-live="polite"
      >
        <p className="bs-kicker">Preliminary build summary</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3 border-b-2 border-black pb-4">
          <h2 className="bs-section-head">Hardware retail total</h2>
          <p className="text-3xl font-black tabular-nums md:text-4xl">
            {money.format(total)}
          </p>
        </div>
        <p className="bs-body mt-4">
          {selectedItems.length + (gfcConfiguration ? 1 : 0)} selected component
          {selectedItems.length + (gfcConfiguration ? 1 : 0) === 1 ? '' : 's'} ·
          Prices are reference list prices and subject to change.
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
        {selectedItems.length || gfcConfiguration ? (
          <a
            href="https://panelplanner.rwas.team/customer"
            onClick={submitBuild}
            className="bs-cta-primary mt-6 inline-flex"
          >
            {advisories.length
              ? 'Arrange Panel & Continue with Advisories'
              : 'Arrange Panel & Continue'}
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
          Selected equipment is sent to the RWAS service desk by email and,
          after email delivery succeeds, to Shop Talk in Microsoft Teams. You
          will also receive an email copy of the selected equipment, pricing,
          and advisories. The planner does not perform full compatibility
          validation; its panel preview is conceptual and is not an approved
          fabrication or installation drawing.
        </p>
      </section>
    </div>
  );
}
