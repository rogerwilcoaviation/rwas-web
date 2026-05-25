export type SeoServiceLink = {
  href: string;
  label: string;
  description: string;
};

const links: SeoServiceLink[] = [
  {
    href: '/services/garmin-installation-northern-plains',
    label: 'Garmin avionics installation',
    description: 'Certified Garmin dealer support for panel planning, installation, testing, and documentation.',
  },
  {
    href: '/services/g3x-touch-installation',
    label: 'G3X Touch installation',
    description: 'Glass-panel planning, EIS, ADAHRS, fabrication, configuration, and documentation.',
  },
  {
    href: '/services/gtn-xi-navigator-installation',
    label: 'GTN Xi navigator installation',
    description: 'GTN 650Xi and GTN 750Xi planning, antenna review, integration, testing, and documentation.',
  },
  {
    href: '/services/gfc-500-autopilot-installation',
    label: 'GFC 500 autopilot installation',
    description: 'Eligibility review, servo placement, integration, functional testing, and return-to-service paperwork.',
  },
  {
    href: '/services/ads-b-installation',
    label: 'ADS-B Out installation',
    description: 'Transponder upgrades, GPS source review, antenna planning, configuration, and compliance documentation.',
  },
  {
    href: '/services/aircraft-maintenance-sioux-falls',
    label: 'Aircraft maintenance in Sioux Falls',
    description: 'Annual inspections, troubleshooting, AOG coordination, and repair-station documentation.',
  },
  {
    href: '/services/pre-buy-inspection',
    label: 'Pre-buy inspection support',
    description: 'Logbook review, physical inspection, avionics review, NDT coordination, and buyer decision support.',
  },
  {
    href: '/services/ndt-inspection',
    label: 'Aircraft NDT inspection',
    description: 'Eddy current, dye penetrant, magnetic particle, ultrasound, visual, and Rockwell hardness testing.',
  },
  {
    href: '/services/fiber-laser-fabrication',
    label: 'Fiber laser fabrication',
    description: 'Aircraft panel cutting, laser welding, powder coating, UV printing, bracket work, and fabrication.',
  },
  {
    href: '/services/rotax-repair',
    label: 'Rotax maintenance support',
    description: 'Rotax aircraft engine maintenance support, inspection planning, troubleshooting, and documentation review.',
  },
  {
    href: '/services/papa-alpha-tools',
    label: 'Papa-Alpha Piper rigging tools',
    description: 'RWAS-designed Piper rigging reference tools for PA-series flight-control setup work.',
  },
];

function unique(selected: SeoServiceLink[]) {
  const seen = new Set<string>();
  return selected.filter((link) => {
    if (seen.has(link.href)) return false;
    seen.add(link.href);
    return true;
  });
}

export function serviceLinksForProduct(input: {
  title?: string | null;
  handle?: string | null;
  vendor?: string | null;
  productType?: string | null;
  tags?: string[] | null;
}) {
  const haystack = [input.title, input.handle, input.vendor, input.productType, ...(input.tags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const selected: SeoServiceLink[] = [];

  if (/garmin|g3x|gtn|gfc|ads-?b|transponder|navigator|autopilot|avionics|panel|gdu|g5|gi\s?275|gtx|gma/.test(haystack)) selected.push(links[0]);
  if (/g3x|gdu|engine information/.test(haystack)) selected.push(links[1]);
  if (/gtn|650xi|750xi|navigator|waas/.test(haystack)) selected.push(links[2]);
  if (/gfc|autopilot|servo/.test(haystack)) selected.push(links[3]);
  if (/ads-?b|transponder|gtx/.test(haystack)) selected.push(links[4]);
  if (/maintenance|annual|100-hour|inspection|aog/.test(haystack)) selected.push(links[5]);
  if (/pre-?buy|buyer/.test(haystack)) selected.push(links[6]);
  if (/ndt|eddy|penetrant|magnetic|ultrasound|rockwell/.test(haystack)) selected.push(links[7]);
  if (/fabrication|fiber|laser|panel|bracket|powder|uv print|sheet metal/.test(haystack)) selected.push(links[8]);
  if (/rotax|912|914|915|916/.test(haystack)) selected.push(links[9]);
  if (/papa-alpha|papa alpha|pa-28|pa-30|pa-31|pa-32|pa-34|pa-36|pa-44|rigging|bell crank|stabilator|rudder|aileron|flap/.test(haystack)) selected.push(links[10]);

  return unique(selected).slice(0, 4);
}

export function serviceLinksForCollection(handle: string, title?: string | null) {
  const key = `${handle} ${title || ''}`.toLowerCase();
  const selected: SeoServiceLink[] = [];

  if (/garmin-dealer-install|avionics-certified|avionics-experimental|garmin|avionics/.test(key)) {
    selected.push(links[0], links[1], links[2], links[3], links[4]);
  }
  if (/papa-alpha|rigging/.test(key)) selected.push(links[10], links[8]);
  if (/service|parts|maintenance/.test(key)) selected.push(links[5], links[7], links[8]);

  return unique(selected).slice(0, 5);
}
