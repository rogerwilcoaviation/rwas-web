import type { AxisPlannerKind } from '@/lib/axis-planner-data';

/** Slide identifiers: 'intro', any AXIS step id (e.g. '1', '1A'), or 'summary'. */
export type AxisInterviewSlideId = string;

export const AXIS_INTERVIEW_AUDIO_BASE = '/audio/axis-interview';

/**
 * Local narration clip path for a slide. Clips are recorded separately and
 * may not exist yet; the UI must treat a load failure as "audio unavailable".
 * Example: certified + '1A' -> /audio/axis-interview/certified-1a.mp3
 */
export function axisInterviewAudioSrc({
  kind,
  slideId,
}: {
  kind: AxisPlannerKind;
  slideId: AxisInterviewSlideId;
}): string {
  return `${AXIS_INTERVIEW_AUDIO_BASE}/${kind}-${slideId.toLowerCase()}.mp3`;
}

type NarrationEntry = string | Record<AxisPlannerKind, string>;

const NARRATION: Record<AxisInterviewSlideId, NarrationEntry> = {
  intro: {
    certified:
      'Welcome to the RWAS guided AXIS interview for certified aircraft. This is Captain Jerry. We will walk through Garmin’s Build-A-System Guide one step at a time. On each slide, check the equipment you are considering and set quantities; the manufacturer list-price total updates as you go. Prices are Garmin July 2026 guide list prices. This is preliminary hardware planning, not an approved configuration or an installation quote. RWAS will confirm aircraft eligibility, compatibility, required hardware and labor after you submit.',
    experimental:
      'Welcome to the RWAS guided AXIS interview for experimental aircraft. This is Captain Jerry. We will walk through Garmin’s Build-A-System Guide for experimental aircraft one step at a time. On each slide, check the equipment you are considering and set quantities; the manufacturer list-price total updates as you go. Prices are Garmin July 2026 guide list prices. This is preliminary hardware planning, not an approved configuration or an installation quote. RWAS will confirm compatibility, required hardware and labor after you submit.',
  },
  '1': {
    certified:
      'Step 1 is your displays. Garmin’s AXIS Part 23 STC installation manual revision three states a maximum of three certified displays total, with no more than two PFDs and two MFDs. RWAS will verify the current revision. Subject to the approved configuration, the formats include: the 8-inch portrait GDU 80P, the 8-inch landscape GDU 80L, or the 11.6-inch GDU 116B, 116C or 116NC. The 116C adds an IFR GPS, a COMM radio and a four-place audio panel, and the 116NC adds a NAV receiver as well. No AXIS display contains the autopilot itself. The panel photos on this slide are illustrations only; they do not show your aircraft or your selections.',
    experimental:
      'Step 1 is your displays. An experimental AXIS system can use up to six displays, with up to three PFD identities and three MFD identities. The AXIS X models, the GDU 80PX, 80LX and 116BX, are non-TSO, and the certified GDU 116C and 116NC, with integrated IFR GPS and radios, may be mixed into an experimental system. No AXIS display contains the autopilot itself. The panel photos on this slide are illustrations only; they do not show your aircraft or your selections.',
  },
  '1A': {
    certified:
      'Step 1A covers what each display needs to install. Every display needs the correct new-install or G3X Touch upgrade kit, not both. Displays with an integrated IFR GPS need a GA 35S antenna, and you will want one printed-material kit per aircraft. A GAD 29D is required only in specific cases, such as a GDU 116B interfacing with a supported external navigator through ARINC 429. Do not add one just because a navigator or standby instrument is installed. The full guidance and source note are shown on this slide.',
    experimental:
      'Step 1A covers what each display needs to install. Every display needs the correct new-install or G3X Touch upgrade kit. Displays with an integrated IFR GPS need a GA 35S antenna, and you will want one printed-material kit per aircraft.',
  },
  '2': {
    certified:
      'Step 2 is the core sensor package, supplying attitude, air data, magnetic heading and outside-air temperature. Choose at least one sensor LRU kit and its matching installation kit. The STC permits no more than two ADAHRS interfaced to AXIS, excluding G5 or GI 275 standbys. Dual PFDs require dual ADAHRS including a GSU 75. A GFC 500 requires a GSU 25D as ADAHRS one. RWAS must verify the approved configuration.',
    experimental:
      'Step 2 is the core sensor package. Choose a core AXIS X sensor kit. For an existing GSU 73, the experimental AXIS manual specifies a direct GMU 22 or GMU 44 connection and says the GSU 73 does not support a GMU 11. RWAS will verify the exact components and installation.',
  },
  '2A':
    'Step 2A: for a new installation, select one matching connector or install kit for every system or supplemental sensor you selected in Step 2.',
  '3': {
    certified:
      'Step 3 is the standby flight instrument, which is required. Choose a G5 or a GI 275. Use the GI 275 plus-AP model when retaining a compatible non-Garmin autopilot. A GI 275 standby installation also needs a GPS source; the details are shown on this slide.',
    experimental:
      'Step 3 is the standby flight instrument. Add a G5 for redundancy. For outside-air temperature on the G5, use the GAD 13 and GTP 59; the GTP 59 in the AXIS LRU kit can be shared with the G5.',
  },
  '4': {
    certified:
      'Step 4 is the engine and airframe interface. Typically one GEA module is required per engine. The GEA 110 interfaces only with a GDU 116C or 116NC, not the 116B. RWAS must review reversionary engine information in mixed-display systems.',
    experimental:
      'Step 4 is the engine and airframe interface. Typically one GEA module is required per engine, unless the engine has more than six cylinders. The GEA 110 requires an AXIS display with integrated COMM or NAV-COMM.',
  },
  '4A': {
    certified:
      'Step 4A is engine sensors. Select the sensor kit for your installed Lycoming or Continental engine. RWAS will confirm any additional sensors.',
    experimental:
      'Step 4A is engine sensors. Select the Lycoming and Continental or Rotax kit, then add individual sensors only as your engine installation requires.',
  },
  '5': {
    certified:
      'Step 5 is the autopilot. If you want a new GFC 500 quoted, choose the exact catalog eligibility group for your aircraft, then a servo configuration. AXIS with GFC 500 requires a GSU 25D as ADAHRS one. Each catalog system price includes the GMC 507 mode controller, the applicable GSA 28 servos and the Garmin installation kits listed for that configuration. Leave it blank if no autopilot is being quoted. RWAS must verify the current eligibility and approved data before quoting or installation.',
    experimental:
      'Step 5 is the GFC 500X autopilot. Select one GSA 28 servo for each axis you want: pitch, roll and an optional yaw damper. The GMC 507 mode controller is optional but recommended.',
  },
  '5A':
    'Step 5A: select one connector kit per servo, the GMC 507 connector kit and rack when applicable, and the servo mount kit for your aircraft.',
  '6': {
    certified:
      'Step 6 covers IFR navigators, radios and audio panels. The STC limits the internal audio panel to one external VHF navigation source and one external VHF communication source. A Flight Stream 210 cannot be installed with a GNS-series navigator in the AXIS system. Additional GTR 20 and 200B restrictions appear on this slide. RWAS will verify existing equipment and approved interfaces.',
    experimental:
      'Step 6 covers IFR navigators, radios and audio panels. Skip any equipment already provided by an integrated AXIS display. Otherwise, select compatible navigation, radio and audio equipment.',
  },
  '7': {
    certified:
      'Step 7 covers the transponder and datalinks. Under the AXIS Part 23 STC, only one transponder may be interfaced to the AXIS system. Additional transponder and ADAHRS interface restrictions appear on this slide. Remote GDL receivers need a connector kit, and SiriusXM receivers need the GA 24 TNC antenna. RWAS will verify the existing system.',
    experimental:
      'Step 7 is the transponder and datalinks. A GTX 45R with GPS can provide the ADS-B Out position source when no IFR GPS is installed. Remote GDL receivers require a connector kit, and SiriusXM requires a GA 24 TNC antenna.',
  },
  '7A': {
    certified:
      'Step 7A is active traffic. The STC permits only one configured traffic source. A GTS 8XX cannot be combined with another traffic source except a GTX 3X5 that correlates the GTS traffic data. RWAS will verify the approved interface.',
    experimental:
      'Step 7A is active traffic. The GTS 820 works through HSDB. Avoid configuring conflicting traffic sources.',
  },
  '8A':
    'Step 8A is software enablements, such as ChartView, SurfaceWatch and TAWS-B. Eligibility depends on the selected display and the installed navigation equipment.',
  '8B': {
    certified:
      'Step 8B covers safety sensors. A GAP 26 angle-of-attack probe cannot replace the original stall warning system. Garmin limits its use on certain aircraft, including those certified for flight into known icing or with wing-mounted engines, and specifies pitot and static-port restrictions. The full limitations appear on this slide. RWAS will verify applicability and approved installation data.',
    experimental:
      'Step 8B covers safety sensors and awareness hardware. A GHA 15 cannot be interfaced to the AXIS system when TAWS-B is enabled. A complete GI 260 angle-of-attack kit includes its own indicator, probe and air-data hardware, so do not combine it with duplicate standalone components unless RWAS confirms the architecture.',
  },
  '8C': {
    certified:
      'Step 8C is navigation and electrical interfaces. The GAD 27 provides keep-alive power and optional landing and taxi light wig-wag. It is required with keep-alive connected to the GSU 25D when an IFR aircraft has a 14-volt system, a single PFD using a GSU 25D, and vacuum gyro backup instruments. RWAS will verify your aircraft and installation. GAD 29D guidance is in Step 1A.',
    experimental:
      'Step 8C is navigation and electrical interfaces. A GAD 29 may be required with an older GPS navigator or for navigation on a G5. The GAD 27 provides keep-alive power and optional landing and taxi light wig-wag.',
  },
  '8D':
    'Step 8D is optional panel accessories, such as USB charging and a digital clock. RWAS will confirm aircraft voltage, electrical load, connector kits, location and installation details.',
  summary:
    'Here is your preliminary build: every selected part with its manufacturer list unit price, extended price and total. Review any advisories, then print it, download a copy, or submit it to RWAS. RWAS can review a submitted build for any available package or discounted equipment pricing, but no discount amount is promised. These are list prices, subject to change, and they exclude tax, freight, installation labor, fabrication, wiring, configuration, certification and additional required hardware.',
};

/** Narration transcript for a slide; always displayed as visible text. */
export function axisInterviewNarration({
  kind,
  slideId,
}: {
  kind: AxisPlannerKind;
  slideId: AxisInterviewSlideId;
}): string {
  const entry = NARRATION[slideId];
  if (!entry) {
    return '';
  }
  return typeof entry === 'string' ? entry : entry[kind];
}

export type AxisDisplayScenario = {
  id: string;
  title: string;
  explanation: string;
  imageUrl: string;
  imageAlt: string;
  credit: string;
};

const ILLUSTRATIVE_CREDIT =
  'Illustrative photo — Image: Garmin. It does not depict your aircraft, your selections or a specific configuration.';

/** Step 1 panel scenarios, each paired with an existing public Garmin AXIS image. */
export function axisDisplayScenarios({
  kind,
}: {
  kind: AxisPlannerKind;
}): AxisDisplayScenario[] {
  const maxDisplays = kind === 'certified' ? 'three' : 'six';
  return [
    {
      id: 'single-display',
      title: 'One display with a standby instrument',
      explanation: `A single AXIS display can be configured to present flight instruments, moving map and engine information, ${kind === 'certified' ? 'with the required standby flight instrument chosen in Step 3' : 'with an optional G5 standby from Step 3'} alongside it. Final functions depend on the connected AXIS sensors, interfaces and ${kind === 'certified' ? 'approved ' : ''}configuration.`,
      imageUrl: '/images/blog/axis-build-planner-operating-display-20260807.jpg',
      imageAlt:
        'Illustrative photo: a Garmin AXIS display operating in an aircraft panel beside a standby flight display.',
      credit: ILLUSTRATIVE_CREDIT,
    },
    {
      id: 'multi-display',
      title: 'Multiple displays across the panel',
      explanation: `Two or more AXIS displays can be configured as a primary flight display, multifunction display or combined PFD/MFD. ${kind === 'certified' ? 'Certified' : 'Experimental'} systems are limited to ${maxDisplays} displays, and formats may be mixed as panel space ${kind === 'certified' ? 'and the approved configuration allow' : 'allows'}.`,
      imageUrl: '/images/blog/axis-build-planner-cockpit-20260807.jpg',
      imageAlt:
        'Illustrative photo: an aircraft panel with three Garmin AXIS displays across the instrument panel.',
      credit: ILLUSTRATIVE_CREDIT,
    },
    {
      id: 'install-or-upgrade',
      title: 'New installation or G3X Touch upgrade',
      explanation:
        'Step 1A lists new-install kits and, for listed displays, G3X Touch upgrade kits. Choose one path per display—not both. RWAS confirms which applies to your existing panel.',
      imageUrl:
        '/images/blog/axis-build-planner-display-installation-20260807.jpg',
      imageAlt:
        'Illustrative photo: an AXIS flight display being fitted into an aircraft panel during installation.',
      credit: ILLUSTRATIVE_CREDIT,
    },
  ];
}
