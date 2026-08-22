'use client';

import {
  AXIS_ITEMS,
  AXIS_STEPS,
  type AxisPlannerKind,
} from '@/lib/axis-planner-data';
import { GFC500_CERTIFIED_AIRCRAFT } from '@/lib/gfc500-certified-catalog';
import type { ShopifySkuMedia } from '@/lib/shopify';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/shared/ui/dialog';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState, type MouseEvent } from 'react';

type Selection = Record<string, number>;

const FALLBACK_PRODUCT_IMAGE =
  '/images/axis/garmin-axis-flight-displays-build-system.jpg';

const EXACT_PRODUCT_IMAGES: Record<
  string,
  { imageUrl: string; imageAlt: string }
> = {
  '010-04557-00': {
    imageUrl: '/images/axis/products/010-04557-00-certified-lru-kit.jpg',
    imageAlt:
      'Garmin AXIS certified LRU kit with GSU 25D, GMU 11 and GTP 59 temperature probe',
  },
  '010-03000-00': {
    imageUrl:
      'https://res.garmin.com/www/aviation/80686/80686-11-6-display-tab-primary-flight-display-video.jpg',
    imageAlt:
      'Garmin AXIS GDU 116B 11.6-inch flight display shown from the front',
  },
  '010-03001-00': {
    imageUrl:
      'https://res.garmin.com/www/aviation/80686/80686-11-6-display-tab-primary-flight-display-video.jpg',
    imageAlt:
      'Garmin AXIS GDU 116C 11.6-inch flight display shown from the front with integrated COM and audio controls',
  },
  '010-03002-00': {
    imageUrl:
      'https://res.garmin.com/www/aviation/80686/80686-11-6-display-tab-primary-flight-display-video.jpg',
    imageAlt:
      'Garmin AXIS GDU 116NC 11.6-inch flight display shown from the front with integrated NAV, COM and audio controls',
  },
};

const GDU_116_MODELS = [
  {
    sku: '010-03000-00',
    certifiedModel: 'GDU 116B',
    experimentalModel: 'GDU 116BX',
    features: 'Display; VFR GPS; external IFR navigator capable',
  },
  {
    sku: '010-03001-00',
    certifiedModel: 'GDU 116C',
    experimentalModel: 'GDU 116C',
    features: 'IFR GPS; COM; 4-place audio/intercom',
  },
  {
    sku: '010-03002-00',
    certifiedModel: 'GDU 116NC',
    experimentalModel: 'GDU 116NC',
    features: 'IFR GPS/NAV; COM; 4-place audio/intercom',
  },
] as const;

const CERTIFIED_DETAIL_COPY: Record<string, string> = {
  '010-04143-00':
    'The GDU 80P is the certified AXIS 8-inch portrait-format touchscreen display. It can be configured as a primary flight display or multifunction display and can present engine information when paired with the approved engine interface and sensors. This model does not include an IFR GPS navigator, COMM radio or audio panel; those functions require compatible separate equipment elsewhere in the certified installation.',
  '010-03000-00':
    'The GDU 116B is the base 11.6-inch landscape touchscreen for a certified AXIS flight deck. Depending on the approved system configuration, it can serve as a primary flight display, multifunction display, combined PFD/MFD or engine-information display, with high-resolution flight instruments, mapping, traffic, weather, terrain, charts and engine data supplied by the connected AXIS sensors and interfaces. Its internal GPS receiver is limited to VFR navigation; it is not an approved stand-alone IFR navigator. For IFR operations, the GDU 116B can display course guidance from a compatible approved external IFR navigator when installed through the authorized interface. Unlike the GDU 116C and GDU 116NC, the 116B does not include an internal IFR GPS navigator, VHF COMM radio or four-place audio panel/intercom, and it does not include the VHF NAV receiver provided by the 116NC. Choose it when those functions already exist elsewhere in the panel or will be provided by separate compatible equipment.',
};

const EXPERIMENTAL_DETAIL_COPY: Record<string, string> = {
  '010-03000-00':
    'The GDU 116BX is the base 11.6-inch landscape touchscreen for an experimental-aircraft AXIS flight deck. It can be configured as a primary flight display, multifunction display, combined PFD/MFD or engine-information display, presenting flight instruments, moving-map navigation, traffic, weather, terrain, charts and engine data from the connected AXIS equipment. Its internal GPS supports VFR navigation. IFR navigation requires a compatible approved external navigator and the applicable interfaces; the 116BX is not a stand-alone IFR navigator. It does not contain the integrated IFR GPS, VHF COMM, four-place audio/intercom or VHF NAV functions offered by the GDU 116C/116NC, making it the appropriate choice when those capabilities are supplied elsewhere in the panel.',
};

function detailCopy(
  kind: AxisPlannerKind,
  item: (typeof AXIS_ITEMS)[AxisPlannerKind][number],
) {
  if (kind === 'certified' && CERTIFIED_DETAIL_COPY[item.sku]) {
    return CERTIFIED_DETAIL_COPY[item.sku];
  }
  if (kind === 'experimental' && EXPERIMENTAL_DETAIL_COPY[item.sku]) {
    return EXPERIMENTAL_DETAIL_COPY[item.sku];
  }
  return `${item.description} This is the ${kind === 'certified' ? 'certified-aircraft' : 'experimental-aircraft'} version listed in Garmin's AXIS Build-A-System Guide for ${kind} aircraft. Final functions and eligibility depend on the complete approved configuration.`;
}

function compatibilityFor(
  kind: AxisPlannerKind,
  item: (typeof AXIS_ITEMS)[AxisPlannerKind][number],
) {
  const relatedSkus: string[] = [];
  const requirements: string[] = [];
  const cautions: string[] = [];
  const addSkus = (...skus: string[]) => relatedSkus.push(...skus);
  const addRelated = (pattern: RegExp) =>
    addSkus(
      ...AXIS_ITEMS[kind]
        .filter(
          (candidate) =>
            candidate.sku !== item.sku && pattern.test(candidate.title),
        )
        .map((candidate) => candidate.sku),
    );

  const displayCompanions: Record<string, string[]> = {
    '010-04143-00': [
      kind === 'certified' ? '010-14469-00' : '010-14468-00',
      kind === 'certified' ? '010-14469-10' : '010-14468-10',
    ],
    '010-04145-00': [
      kind === 'certified' ? '010-14469-00' : '010-14468-00',
      kind === 'certified' ? '010-14469-10' : '010-14468-10',
    ],
    '010-03000-00': [
      kind === 'certified' ? '010-14469-01' : '010-14468-01',
      kind === 'certified' ? '010-14469-10' : '010-14468-10',
    ],
    '010-03001-00': ['010-14469-02', '010-14469-12', '010-02639-00'],
    '010-03002-00': ['010-14469-02', '010-14469-12', '010-02639-00'],
  };
  const installKitDisplays: Record<string, string[]> = {
    '010-14469-00': ['010-04143-00', '010-04145-00'],
    '010-14469-10': ['010-04143-00', '010-04145-00', '010-03000-00'],
    '010-14469-01': ['010-03000-00'],
    '010-14469-02': ['010-03001-00', '010-03002-00'],
    '010-14469-12': ['010-03001-00', '010-03002-00'],
    '010-14468-00': ['010-04143-00', '010-04145-00'],
    '010-14468-10': ['010-04143-00', '010-04145-00', '010-03000-00'],
    '010-14468-01': ['010-03000-00'],
  };
  const exactCompanions: Record<string, string[]> = {
    '010-04557-00': ['K11-00066-00'],
    'K11-00066-00': ['010-04557-00'],
    '010-02003-05': ['K11-00019-50', '010-03001-00', '010-03002-00'],
    'K11-00019-50': ['010-02003-05', '010-03001-00', '010-03002-00'],
    '010-01071-55': ['K10-00181-00', '011-04349-90'],
    '010-01071-56': ['K10-00181-00', '011-00871-10'],
    '010-01788-00': ['011-04349-90'],
    '010-02770-11': ['011-02886-01'],
    '010-02770-00': ['011-02886-00'],
    '010-01329-01': [
      '011-03527-50',
      '011-03527-51',
      '011-03941-00',
      '010-03001-00',
      '010-03002-00',
    ],
    '010-01946-00': ['010-12700-00', '010-12700-10'],
    '010-01076-31': ['011-03241-01'],
    '010-01561-15': ['011-04170-00'],
    '010-01561-55': ['011-04170-00', '010-12498-50'],
    '010-01561-35': ['011-04170-00', '010-12498-50'],
    '010-01561-10': ['010-12498-60'],
    '010-01561-50': ['010-12498-60', '010-12498-50'],
    '010-01561-30': ['010-12498-60', '010-12498-50'],
    '010-02895-00': ['011-05278-00', '011-06097-00', '011-06677-00'],
    '010-01172-21': ['011-03271-00'],
    '010-01172-20': ['011-03271-00'],
    '010-01525-11': ['011-03877-01'],
    '010-01525-10': ['011-03877-00'],
    '010-01485-01': [
      '010-12493-11',
      '010-12493-02',
      '010-02203-K0',
      '010-02203-00',
      '011-03002-10',
    ],
  };

  addSkus(...(displayCompanions[item.sku] || []));
  addSkus(...(installKitDisplays[item.sku] || []));
  addSkus(...(exactCompanions[item.sku] || []));

  if (/AXIS .*Display/.test(item.title)) {
    if (/GDU 80P|GDU 80L/.test(item.title)) {
      // Exact display/install-kit relationships are declared above. Do not
      // broaden these by matching every GDU kit title.
    } else if (/GDU 116B(?!X)/.test(item.title)) {
      // Exact display/install-kit relationships are declared above.
    } else if (/GDU 116C|GDU 116NC/.test(item.title)) {
      // Exact display/install-kit and antenna relationships are declared above.
    }
    addRelated(/LRU Kit|G5|GI 275/);
    requirements.push(
      'Use the matching new-install or G3X Touch upgrade kit for this display.',
    );
    if (/116C|116NC/.test(item.title))
      requirements.push(
        'Requires a GA 35S GPS/WAAS antenna for the integrated IFR GPS.',
      );
  } else if (/Install Kit, GDU/.test(item.title)) {
    requirements.push(
      'Match the display family and choose either the new-install or upgrade path—not both for the same display.',
    );
  } else if (/LRU Kit|GSU 25|GMU (11|22|44)/.test(item.title)) {
    addRelated(
      /AXIS .*Display|Install Kit, AXIS|GSU 25 Connector|GMU .*Install Kit/,
    );
    requirements.push(
      'The ADAHRS, magnetometer, temperature probe and install hardware must form an approved sensor combination.',
    );
  } else if (/GEA 24|GEA 110/.test(item.title)) {
    addRelated(
      /Engine Sensor Kit|Pressure Sensor|Fuel Flow Sensor|RPM Sensor|Thermocouple|Temperature RTD|Ammeter Shunt/,
    );
    if (/GEA 110/.test(item.title))
      requirements.push(
        'GEA 110 requires an AXIS display with integrated COMM or NAV/COMM.',
      );
  } else if (/GSA 28|GMC 507/.test(item.title)) {
    addRelated(/GSA 28|GMC 507|Servo Connector|Servo Installation Kit/);
    requirements.push(
      'Servo count, connector style and mounting kit are determined by the aircraft and selected autopilot axes.',
    );
  } else if (/GDL (50|51|52)R/.test(item.title)) {
    addRelated(/GDL Remote Mount Connector|GA 24/);
    requirements.push('Remote GDL units require the matching connector kit.');
    if (/GDL (51|52)R/.test(item.title))
      requirements.push(
        'SiriusXM reception requires the GA 24 TNC antenna and a subscription.',
      );
    cautions.push(
      'Do not configure competing ADS-B traffic sources without an approved interface design.',
    );
  } else if (/GTS 820/.test(item.title)) {
    addRelated(/GTX 345|GTN .*Xi|GI 275/);
    requirements.push(
      'Requires an approved indirect HSDB interface path through compatible equipment.',
    );
    cautions.push(
      'Cannot be combined with another ADS-B traffic source except an approved GTX 345 configuration.',
    );
  } else if (/GAP 26|GI-?260/.test(item.title)) {
    addRelated(/GAP 26|GI-?260|GSU 25/);
    requirements.push(
      'Choose equipment matching the aircraft voltage, pitot-heat design and intended AOA display path.',
    );
  } else if (
    /Connector Kit|Install Kit|Install Rack|Installation Kit/.test(item.title)
  ) {
    const family = item.title.match(
      /(GDU|GSU|GMU|GEA|GSA|GMC|GTR|GDL|GHA|GAD)\s*\d*/,
    )?.[0];
    if (family) addRelated(new RegExp(family.replace(/\s+/g, '\\s*'), 'i'));
    requirements.push(
      'Use only with the named LRU and installation configuration.',
    );
  } else {
    const step = item.step.replace(/[A-Z]/g, '');
    relatedSkus.push(
      ...AXIS_ITEMS[kind]
        .filter(
          (candidate) =>
            candidate.sku !== item.sku &&
            candidate.step.replace(/[A-Z]/g, '') === step,
        )
        .map((candidate) => candidate.sku),
    );
    requirements.push(
      'Final applicability depends on the aircraft, installed interfaces and approved configuration.',
    );
  }

  const related = [...new Set(relatedSkus)]
    .map((sku) => AXIS_ITEMS[kind].find((candidate) => candidate.sku === sku))
    .filter(
      (candidate): candidate is (typeof AXIS_ITEMS)[AxisPlannerKind][number] =>
        Boolean(candidate),
    );
  const mutuallyExclusiveGroups = [
    kind === 'certified'
      ? ['010-04557-00', '010-02003-05']
      : ['010-04556-00', '010-04556-01'],
    kind === 'certified'
      ? ['K10-00280-01', '010-02326-10', '010-02326-20']
      : [],
    kind === 'certified'
      ? ['010-02770-11', '010-01329-01']
      : ['010-02770-00', '010-01329-01'],
    kind === 'certified'
      ? ['010-01214-01', '010-01215-01', '010-01216-06', '010-01217-06']
      : ['010-01757-46', '010-01757-06', '010-01756-01'],
    kind === 'experimental'
      ? ['010-01074-00', '010-01074-10', '010-01074-20']
      : [],
  ];
  const knownIncompatible = new Set<string>();
  for (const group of mutuallyExclusiveGroups) {
    if (group.includes(item.sku)) {
      group
        .filter((sku) => sku !== item.sku)
        .forEach((sku) => knownIncompatible.add(sku));
    }
  }
  const trafficReceivers =
    kind === 'certified'
      ? ['010-01561-15', '010-01561-35']
      : ['010-01561-10', '010-01561-30'];
  if (item.sku === '010-00562-00')
    trafficReceivers.forEach((sku) => knownIncompatible.add(sku));
  if (trafficReceivers.includes(item.sku))
    knownIncompatible.add('010-00562-00');
  if (item.sku === '006-B5211-02') {
    knownIncompatible.add(
      kind === 'certified' ? '010-02895-00' : '010-02942-00',
    );
  }
  if (item.sku === (kind === 'certified' ? '010-02895-00' : '010-02942-00')) {
    knownIncompatible.add('006-B5211-02');
  }
  const relatedSet = new Set([
    item.sku,
    ...related.map((candidate) => candidate.sku),
  ]);
  const mayCoexist = AXIS_ITEMS[kind].filter(
    (candidate) =>
      !relatedSet.has(candidate.sku) && !knownIncompatible.has(candidate.sku),
  );

  if (knownIncompatible.size) {
    cautions.push(
      `Do not combine with: ${AXIS_ITEMS[kind]
        .filter((candidate) => knownIncompatible.has(candidate.sku))
        .map((candidate) => `${candidate.title} (${candidate.sku})`)
        .join('; ')}.`,
    );
  }

  return {
    related,
    mayCoexist,
    requirements,
    cautions,
  };
}

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

export default function AxisBuildPlanner({
  kind,
  productMedia,
}: {
  kind: AxisPlannerKind;
  productMedia: Record<string, ShopifySkuMedia>;
}) {
  const [selection, setSelection] = useState<Selection>({});
  const [gfcAircraftId, setGfcAircraftId] = useState('');
  const [gfcConfigurationName, setGfcConfigurationName] = useState('');
  const [source, setSource] = useState('axis-build-planner');
  const [attribution, setAttribution] = useState<Record<string, string>>({});
  const [detailSku, setDetailSku] = useState<string | null>(null);
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
  const detailItem = items.find((item) => item.sku === detailSku) || null;
  const detailMedia = detailItem
    ? productMedia[detailItem.sku.toUpperCase()]
    : null;
  const exactProductImage = detailItem
    ? EXACT_PRODUCT_IMAGES[detailItem.sku.toUpperCase()]
    : null;
  const detailCompatibility = detailItem
    ? compatibilityFor(kind, detailItem)
    : null;
  const isCertifiedGdu80P =
    kind === 'certified' && detailItem?.sku === '010-04143-00';
  const isGdu116 = GDU_116_MODELS.some(
    (model) => model.sku === detailItem?.sku,
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
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setDetailSku(item.sku);
                            }}
                            className="block text-left font-bold text-black underline decoration-1 underline-offset-4 hover:text-amber-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
                            aria-label={`View details and compatibility for ${item.title}`}
                          >
                            {item.title}
                          </button>
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

      <Dialog
        open={Boolean(detailItem)}
        onOpenChange={(open) => {
          if (!open) setDetailSku(null);
        }}
      >
        {detailItem && detailCompatibility ? (
          <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-4xl overflow-y-auto rounded-none border-2 border-black bg-[#fffdf7] p-0 shadow-2xl">
            <div>
              <div
                className={`relative w-full border-b-2 border-black bg-white ${isCertifiedGdu80P ? 'h-[24rem] md:h-[34rem]' : 'h-72 md:h-[32rem]'}`}
              >
                <Image
                  src={
                    isCertifiedGdu80P
                      ? '/images/blog/axis-build-planner-display-family-20260807.jpg'
                      : exactProductImage?.imageUrl ||
                        detailMedia?.imageUrl ||
                        FALLBACK_PRODUCT_IMAGE
                  }
                  alt={
                    isCertifiedGdu80P
                      ? 'Garmin GDU 80P certified AXIS 8-inch portrait display, front and side view'
                      : exactProductImage?.imageAlt ||
                        detailMedia?.imageAlt ||
                        `${detailItem.title} system illustration`
                  }
                  fill
                  sizes="(max-width: 768px) 100vw, 896px"
                  className={
                    isCertifiedGdu80P
                      ? 'object-contain p-4 md:p-6'
                      : 'object-contain p-4 md:p-7'
                  }
                />
              </div>
              <div className="p-5 pt-8 md:p-8 md:pt-10">
                <p className="bs-kicker">Product details</p>
                <DialogTitle className="mt-2 font-serif text-2xl font-black leading-tight text-black">
                  {detailItem.title}
                </DialogTitle>
                {isGdu116 ? (
                  <div className="mt-4 border-2 border-black bg-white">
                    <p className="border-b border-black bg-neutral-100 px-3 py-2 text-xs font-black uppercase tracking-wide">
                      Compare the three 11.6-inch models
                    </p>
                    <div className="grid sm:grid-cols-3">
                      {GDU_116_MODELS.map((model) => {
                        const candidate = items.find(
                          (item) => item.sku === model.sku,
                        );
                        const active = detailItem.sku === model.sku;
                        if (!candidate) return null;
                        return (
                          <button
                            key={model.sku}
                            type="button"
                            onClick={() => setDetailSku(model.sku)}
                            aria-current={active ? 'true' : undefined}
                            className={`border-b border-black p-3 text-left last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 ${active ? 'bg-amber-100' : 'hover:bg-neutral-50'}`}
                          >
                            <span className="block text-sm font-black">
                              {kind === 'experimental'
                                ? model.experimentalModel
                                : model.certifiedModel}
                            </span>
                            <span className="mt-1 block text-xs leading-4 text-neutral-700">
                              {model.features}
                            </span>
                            <span className="mt-2 block text-sm font-black tabular-nums">
                              {money.format(candidate.price)}
                            </span>
                            {active ? (
                              <span className="mt-1 block text-[10px] font-black uppercase tracking-wide text-amber-900">
                                Viewing now
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <DialogDescription asChild>
                  <div className="mt-3 text-base leading-6 text-neutral-800">
                    <p>{detailCopy(kind, detailItem)}</p>
                  </div>
                </DialogDescription>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y-2 border-black py-3">
                  <span className="font-mono text-xs uppercase tracking-wide text-neutral-600">
                    {detailItem.sku}
                  </span>
                  <span className="text-xl font-black tabular-nums">
                    {money.format(detailItem.price)}
                  </span>
                </div>
                <div className="mt-5">
                  <h3 className="font-bold text-black">
                    Direct companions on this page
                  </h3>
                  {detailCompatibility.related.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5">
                      {detailCompatibility.related.map((candidate) => (
                        <li key={candidate.sku}>
                          <button
                            type="button"
                            className="text-left underline underline-offset-2 hover:text-amber-800"
                            onClick={() => setDetailSku(candidate.sku)}
                          >
                            {candidate.title}
                          </button>{' '}
                          <span className="font-mono text-xs text-neutral-600">
                            ({candidate.sku})
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm">
                      No single companion item is universally required.
                    </p>
                  )}
                  {detailCompatibility.requirements.map((text) => (
                    <p
                      key={text}
                      className="mt-3 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm leading-5"
                    >
                      {text}
                    </p>
                  ))}
                  {detailCompatibility.cautions.map((text) => (
                    <p
                      key={text}
                      className="mt-3 border-l-4 border-red-700 bg-red-50 p-3 text-sm font-bold leading-5"
                    >
                      {text}
                    </p>
                  ))}
                  <details className="mt-4 border-t border-neutral-400 pt-3">
                    <summary className="cursor-pointer text-sm font-bold underline underline-offset-2">
                      All other selectable items that may coexist in this system
                      ({detailCompatibility.mayCoexist.length})
                    </summary>
                    <p className="mt-2 text-xs leading-5 text-neutral-600">
                      These are other choices on this planner, not required
                      companions. Aircraft eligibility, duplicate functions and
                      interface limits still apply.
                    </p>
                    <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto border border-neutral-300 bg-white p-3 text-xs leading-5">
                      {detailCompatibility.mayCoexist.map((candidate) => (
                        <li key={candidate.sku}>
                          <button
                            type="button"
                            className="text-left underline underline-offset-2 hover:text-amber-800"
                            onClick={() => setDetailSku(candidate.sku)}
                          >
                            {candidate.title}
                          </button>{' '}
                          <span className="font-mono text-[11px] text-neutral-500">
                            ({candidate.sku})
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setQuantity(
                        detailItem.sku,
                        selection[detailItem.sku] || 1,
                      );
                      setDetailSku(null);
                    }}
                    className="bs-cta-primary"
                  >
                    {selection[detailItem.sku]
                      ? 'Keep selected'
                      : 'Add to build'}
                  </button>
                  {detailMedia?.productUrl ? (
                    <Link
                      href={detailMedia.productUrl}
                      className="bs-cta-secondary"
                    >
                      Full catalog page
                    </Link>
                  ) : null}
                  <DialogClose className="bs-cta-secondary">Close</DialogClose>
                </div>
                <p className="mt-5 text-xs leading-5 text-neutral-600">
                  Compatibility guidance is preliminary. RWAS will verify the
                  aircraft, STC/approved data, installation manual, interfaces
                  and required hardware before quoting.
                </p>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

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
