export type AxisPlannerKind = 'certified' | 'experimental';

export type AxisPlannerItem = {
  step: string;
  sku: string;
  price: number;
  title: string;
  description: string;
};

export type AxisPlannerStep = {
  id: string;
  title: string;
  guidance: string;
};

const CERTIFIED = `
1|010-04143-00|6600|AXIS 8-inch Portrait Display — GDU 80P
1|010-04145-00|6600|AXIS 8-inch Landscape Display — GDU 80L
1|010-03000-00|9600|AXIS 11.6-inch Display — GDU 116B
1|010-03001-00|18400|AXIS 11.6-inch Display with IFR GPS/COMM and Audio — GDU 116C (TSO)
1|010-03002-00|23400|AXIS 11.6-inch Display with IFR GPS/NAV/COMM and Audio — GDU 116NC (TSO)
1A|010-14469-00|200|Install Kit, GDU 80P/80L, New Install
1A|010-14469-10|100|Install Kit, GDU 80/116B, G3X Touch Upgrade
1A|010-14469-01|200|Install Kit, GDU 116B, New Install
1A|010-14469-02|400|Install Kit, GDU 116C/116NC, New Install
1A|010-14469-12|200|Install Kit, GDU 116C/116NC, G3X Touch Upgrade
1A|010-02639-00|400|GA 35S GPS/WAAS Antenna
1A|K00-01479-00|200|Printed Material Kit, GDU 80/116 Series
2|010-04557-00|4000|AXIS Certified LRU Kit with GSU 25D, GMU 11 and GTP 59
2|K11-00066-00|200|Install Kit, AXIS Certified
2|010-02003-05|10500|LRU Kit with GMU 44B, GSU 75 and GTP 59
2|K11-00019-50|650|Install Kit, GMU 44B and GSU 75
3|K10-00280-01|3095|G5 for Certificated Aircraft
3|010-02326-10|4695|GI 275 ADAHRS Kit, Class I/II
3|010-02326-20|5795|GI 275 ADAHRS +AP Kit, Class I/II
4|010-02770-11|2300|GEA 24B, Unit Only, PMA
4|011-02886-01|255|GEA 24 Connector Kit, PMA
4|010-01329-01|3710|GEA 110, Unit Only
4|011-03527-50|320|GEA 110 Connector Kit
4|011-03527-51|565|GEA 110 Sealed Connector Kit
4|011-03941-00|190|GEA 110 Install Tray
4A|K00-01010-11|1230|Engine Sensor Kit, 4-cylinder Lycoming/Continental
4A|K00-01011-11|1615|Engine Sensor Kit, 6-cylinder Lycoming/Continental
5|010-01946-01|3870|GMC 507 Autopilot Mode Controller, PMA
5|010-01068-21|2220|GSA 28 Autopilot Servo, PMA — Pitch/Roll/Trim/Yaw
5A|011-02950-00|80|GSA 28 Servo Connector Kit
5A|011-02950-01|220|GSA 28 Right-angle Servo Connector Kit
6|010-02002-05|20040|GTN 750Xi IFR GPS/NAV/COMM/MFD
6|010-01999-05|14040|GTN 650Xi IFR GPS/NAV/COMM/MFD
6|010-02232-51|8495|GNC 355 IFR GPS and COMM Radio
6|010-01823-50|9395|GNX 375 IFR GPS and ADS-B In/Out Transponder
6|010-01822-50|6250|GPS 175 IFR GPS Navigator
6|010-02481-01|5595|GNC 215 NAV/COMM Radio
6|010-02480-01|2895|GTR 205 COMM Radio
6|010-02479-00|2265|GTR 205R Remote COMM Radio
6|010-01076-31|2400|GTR 20 Remote COMM Radio, PMA
6|011-03241-01|105|GTR 20 Connector Kit, PMA
6|010-01319-03|2495|GMA 345 Audio Panel
6|010-01471-11|2550|GMA 245R PMA Remote Audio Panel
7|010-01214-01|3895|GTX 335 ADS-B Out Transponder
7|010-01215-01|3895|GTX 335R Remote ADS-B Out Transponder
7|010-01216-06|6595|GTX 345 ADS-B In/Out Transponder
7|010-01217-06|6595|GTX 345R Remote ADS-B In/Out Transponder
7|010-01561-15|1150|GDL 50R PMA Remote ADS-B Receiver
7|010-01561-55|1000|GDL 51R PMA Remote SiriusXM Receiver
7|010-01561-35|1575|GDL 52R PMA Remote SiriusXM and ADS-B Receiver
7|011-04170-00|85|GDL Remote Mount Connector Kit, PMA
7|010-12498-50|95|GA 24 TNC SiriusXM Antenna
7A|010-00562-00|12895|GTS 820 Active Traffic System
8A|006-B5211-00|2200|AXIS ChartView Enablement
8A|006-B5211-01|2000|AXIS SurfaceWatch Enablement
8A|006-B5211-02|8500|AXIS TAWS-B Enablement
8B|010-02895-00|2145|GHA 15 PMA Height Advisor
8B|011-05278-00|525|GHA 15 Connector Kit
8B|011-06097-00|25|GHA 15 Install Kit
8B|011-06677-00|325|GHA 15 Levelling Install Kit
8B|010-02975-01|549|GCO 14 Carbon Monoxide Detector
8B|010-01074-71|1400|GAP 26 PMA Self-Regulating Pitot Tube
8C|010-01172-21|875|GAD 29D PMA ARINC 429 Interface Adapter
8C|011-03271-00|100|GAD 29 Connector Kit
8C|010-01525-11|825|GAD 27 PMA Electrical Interface Adapter
8C|011-03877-01|160|GAD 27 Connector Kit`;

const EXPERIMENTAL = `
1|010-04143-00|4140|AXIS 8-inch Portrait Display — GDU 80PX
1|010-04145-00|4140|AXIS 8-inch Landscape Display — GDU 80LX
1|010-03000-00|4980|AXIS 11.6-inch Display — GDU 116BX
1|010-03001-00|18400|AXIS 11.6-inch Display with IFR GPS/COMM and Audio — GDU 116C (TSO)
1|010-03002-00|23400|AXIS 11.6-inch Display with IFR GPS/NAV/COMM and Audio — GDU 116NC (TSO)
1A|010-14468-00|180|Install Kit, GDU 80PX/LX, New Install
1A|010-14468-10|90|Install Kit, GDU 80X/116BX, G3X Touch Upgrade
1A|010-14468-01|180|Install Kit, GDU 116BX, New Install
1A|010-14469-02|400|Install Kit, GDU 116C/116NC, New Install
1A|010-14469-12|200|Install Kit, GDU 116C/116NC, G3X Touch Upgrade
1A|010-02639-00|400|GA 35S GPS/WAAS Antenna
1A|K00-01479-00|200|Printed Material Kit, GDU 80/116 Series
2|010-04556-00|1860|AXIS X LRU Kit with GSU 25C, GMU 11 and GTP 59
2|010-04556-01|3340|AXIS X LRU Kit with GSU 25D, GMU 22 and GTP 59
2|010-01071-55|990|GSU 25C, Unit Only (Supplemental)
2|010-01071-56|2800|GSU 25D PMA, Unit Only (Supplemental)
2|010-01788-00|410|GMU 11, Unit Only (Supplemental)
2A|K10-00181-00|110|GSU 25 Connector Kit
2A|011-04349-90|75|GMU 11 Install Kit
2A|011-00871-10|125|GMU 22 Install Kit
3|010-01485-01|1660|G5, Unit Only
3|010-12493-11|120|G5 Installation Kit
3|010-12493-02|280|G5 Battery Pack
3|010-02203-K0|560|GAD 13, GTP 59 and Connection Kit
3|010-02203-00|170|GAD 13 FAA-PMA, Unit Only
3|011-03002-10|70|9-pin Connector Kit with CAN Term, PMA
4|010-02770-00|975|GEA 24B, Unit Only
4|011-02886-00|215|GEA 24 Connector Kit
4|010-01329-01|3710|GEA 110, Unit Only
4|011-03527-50|320|GEA 110 Connector Kit
4|011-03527-51|565|GEA 110 Sealed Connector Kit
4|011-03941-00|190|GEA 110 Install Tray
4A|K00-00512-10|1180|Engine Sensor Kit, 4-cylinder Lycoming/Continental
4A|K00-00513-10|1440|Engine Sensor Kit, 6-cylinder Lycoming/Continental
4A|K00-00514-10|430|Engine Sensor Kit, Rotax 912UL
4A|011-05783-10|320|GPT 15G Pressure Sensor
4A|011-05783-20|320|GPT 75G Pressure Sensor
4A|494-10001-00|520|Fuel Flow Sensor, 1/4-inch Female NPT
4A|494-50005-00|195|Hall Effect RPM Sensor, Slick Magneto
4A|494-50005-01|195|Hall Effect RPM Sensor, Bendix Magneto
4A|494-70002-00|120|TIT Type K Thermocouple, 7/16-20 Bayonet
4A|494-70005-00|155|Carburetor Temperature RTD, 1/4-28
4A|909-D0000-00|75|100-amp Ammeter Shunt, +/-50 mV
5|010-01068-20|1060|GSA 28 Servo
5|010-01946-00|1370|GMC 507 Autopilot Mode Controller
5A|010-12700-00|80|GMC 507 Connector Kit
5A|010-12700-10|55|GMC 507 Install Rack
5A|011-02950-00|75|GSA 28 Connector Kit
5A|011-02950-01|200|GSA 28 Right-angle Connector Kit
5A|011-02952-01|165|GSA 28 Generic Servo Installation Kit
5A|011-02952-10|165|GSA 28 Servo Installation Kit, RV-6 Roll
5A|011-02952-11|165|GSA 28 Servo Installation Kit, RV-4/8 Pitch
5A|011-02952-12|165|GSA 28 Servo Installation Kit, RV-7/8/10 Roll
5A|011-02952-13|165|GSA 28 Servo Installation Kit, RV-9 Roll
5A|011-02952-14|165|GSA 28 Servo Installation Kit, RV-6/7/9 Pitch
5A|011-02952-15|165|GSA 28 Servo Installation Kit, RV-10 Pitch
5A|011-02952-16|650|GSA 28 Servo Installation Kit, RV-10 Yaw
6|010-02002-05|20040|GTN 750Xi IFR GPS/NAV/COMM/MFD
6|010-01999-05|14040|GTN 650Xi IFR GPS/NAV/COMM/MFD
6|010-02232-51|7750|GNC 355 IFR GPS and COMM Radio
6|010-01823-50|8250|GNX 375 IFR GPS and ADS-B In/Out Transponder
6|010-01822-50|5525|GPS 175 IFR GPS Navigator
6|010-02481-01|4975|GNC 215 NAV/COMM Radio
6|010-03395-01|2160|GTR 205X COMM Radio
6|010-03396-01|1720|GTR 205XR Remote COMM Radio
6|010-01318-03|1770|GMA 245 Audio Panel
6|010-01471-03|1645|GMA 245R Remote Audio Panel
7|010-01757-46|4860|GTX 45R with GPS Remote ADS-B In/Out Transponder
7|010-01757-06|4180|GTX 45R Remote ADS-B In/Out Transponder
7|010-01756-01|2765|GTX 35R Remote ADS-B Out Transponder
7|010-01561-10|950|GDL 50R Remote ADS-B Receiver
7|010-01561-50|820|GDL 51R Remote SiriusXM Receiver
7|010-01561-30|1365|GDL 52R Remote SiriusXM and ADS-B Receiver
7|010-12498-60|70|GDL Remote Mount Connector Kit
7|010-12498-50|95|GA 24 TNC SiriusXM Antenna
7A|010-00562-00|12895|GTS 820 Active Traffic System
8A|006-B5211-00|2200|AXIS ChartView Enablement
8A|006-B5211-01|2000|AXIS SurfaceWatch Enablement
8A|006-B5211-02|8500|AXIS TAWS-B Enablement
8B|010-02942-00|1995|GHA 15 Height Advisor
8B|010-02975-01|549|GCO 14 Carbon Monoxide Detector
8B|010-01074-00|340|GAP 26 Unheated Pitot Tube
8B|010-01074-10|465|GAP 26 Heated/Unregulated Pitot Tube
8B|010-01074-20|700|GAP 26 Heated/Regulated Pitot Tube
8B|010-01287-00|380|GI 260 Angle of Attack Indicator
8C|010-01172-20|565|GAD 29C ARINC 429 Interface Adapter
8C|011-03271-00|90|GAD 29 Connector Kit
8C|010-01525-10|825|GAD 27 Electrical Interface Adapter
8C|011-03877-00|165|GAD 27 Connector Kit`;

const describeItem = ({
  step,
  title,
}: {
  step: string;
  title: string;
}): string => {
  if (/AXIS .*Display/.test(title)) {
    return 'Primary flight, multifunction and optional engine-information display; integrated GPS, radio and audio functions vary by model.';
  }
  if (/Display Install Kit|Install Kit, GDU/.test(title)) {
    return 'Provides the display-specific connectors and installation hardware for the stated new-install or G3X Touch upgrade path.';
  }
  if (/GA 35S/.test(title)) {
    return 'External GPS/WAAS antenna required for AXIS displays or transponders that contain an IFR GPS receiver.';
  }
  if (/Printed Material/.test(title)) {
    return 'Aircraft-level documentation package and pilot training materials; select one for a new AXIS system installation.';
  }
  if (/LRU Kit/.test(title)) {
    return 'Core flight-data sensor package providing attitude, air-data, magnetic-heading and outside-air-temperature inputs to AXIS.';
  }
  if (/GSU 25/.test(title)) {
    return 'Remote ADAHRS supplying attitude and air-data information; use as the core or supplemental sensor permitted by the selected system.';
  }
  if (/GMU (11|22)/.test(title)) {
    return 'Remote magnetometer that supplies magnetic-heading data to the compatible AXIS ADAHRS.';
  }
  if (/G5/.test(title) && !/GAD 13/.test(title)) {
    return 'Electronic standby flight instrument displaying attitude, airspeed and altitude when configured for the AXIS installation.';
  }
  if (/GI 275 ADAHRS \+AP/.test(title)) {
    return 'Battery-backed electronic standby ADI with the interface capability needed when retaining a compatible non-Garmin autopilot.';
  }
  if (/GI 275 ADAHRS/.test(title)) {
    return 'Battery-backed electronic standby ADI for attitude, airspeed and altitude; appropriate when no legacy-autopilot interface is required.';
  }
  if (/GAD 13/.test(title)) {
    return 'Interface and temperature-probe package that supplies outside-air-temperature data and related functions to a G5.';
  }
  if (/GEA 24B/.test(title)) {
    return 'Engine and airframe interface that powers and reads piston-engine sensors for AXIS engine-information display.';
  }
  if (/GEA 110/.test(title)) {
    return 'Firewall-forward engine and airframe interface for AXIS displays with integrated COMM or NAV/COMM capability.';
  }
  if (/Engine Sensor Kit/.test(title)) {
    return 'Matched engine-monitoring probe package for the stated engine family and cylinder count, including core temperature and pressure sensing.';
  }
  if (/GPT .*Pressure Sensor/.test(title)) {
    return 'Pressure transducer used by the engine-information system for an installation-assigned fluid or manifold-pressure channel.';
  }
  if (/Fuel Flow Sensor/.test(title)) {
    return 'Measures fuel flow for AXIS engine gauges, fuel-computer calculations and flight data logging.';
  }
  if (/RPM Sensor/.test(title)) {
    return 'Reads magneto rotation to provide engine RPM information to the AXIS engine display.';
  }
  if (/Thermocouple|Temperature RTD/.test(title)) {
    return 'Engine-temperature probe for the stated measurement channel, connected through the selected GEA interface.';
  }
  if (/Ammeter Shunt/.test(title)) {
    return 'Provides a calibrated millivolt signal so AXIS can display aircraft charging or load current.';
  }
  if (/GMC 507/.test(title) && !/Connector|Rack/.test(title)) {
    return 'Dedicated GFC 500/500X autopilot mode controller for engaging and commanding lateral and vertical flight modes.';
  }
  if (
    /GSA 28.*Servo/.test(title) &&
    !/Connector|Installation Kit/.test(title)
  ) {
    return 'Autopilot servo used for a selected roll, pitch, pitch-trim or yaw-damper axis; quantity and mounts are aircraft-specific.';
  }
  if (/GTN 750Xi/.test(title)) {
    return 'Large-screen IFR GPS/NAV/COMM navigator and MFD providing flight planning, procedures and radio control to AXIS.';
  }
  if (/GTN 650Xi/.test(title)) {
    return 'Compact IFR GPS/NAV/COMM navigator providing flight planning, procedures and radio control to AXIS.';
  }
  if (/GNC 355/.test(title)) {
    return 'IFR GPS navigator combined with a COMM radio for navigation, procedures and communication through the AXIS interface.';
  }
  if (/GNX 375/.test(title)) {
    return 'IFR GPS navigator combined with an ADS-B In/Out transponder for navigation, traffic and weather integration.';
  }
  if (/GPS 175/.test(title)) {
    return 'Touchscreen IFR GPS navigator supplying approved navigation and procedure guidance to AXIS.';
  }
  if (/GNC 215/.test(title)) {
    return 'NAV/COMM radio providing VHF communication plus VOR/localizer/glideslope navigation controlled from compatible AXIS displays.';
  }
  if (/GTR (20|205)/.test(title) && !/Connector/.test(title)) {
    return 'VHF COMM radio controlled from compatible AXIS displays; remote and panel-mount functions depend on the selected model.';
  }
  if (/GMA (245|345)/.test(title)) {
    return 'Audio panel and intercom that routes radios, alerts, music and crew/passenger audio for the AXIS-equipped panel.';
  }
  if (/GTX (3(?:35|45)|35R|45R)/.test(title)) {
    return 'ADS-B transponder providing the stated Out or In/Out capability; remote versions are controlled through compatible avionics.';
  }
  if (/GDL 50R/.test(title)) {
    return 'Remote ADS-B In receiver supplying subscription-free traffic and FIS-B weather to AXIS.';
  }
  if (/GDL 51R/.test(title)) {
    return 'Remote SiriusXM receiver supplying subscription weather and audio entertainment to compatible AXIS displays.';
  }
  if (/GDL 52R/.test(title)) {
    return 'Combined remote ADS-B In and SiriusXM receiver supplying traffic, weather and entertainment to AXIS.';
  }
  if (/GA 24/.test(title)) {
    return 'SiriusXM antenna required for a GDL 51R or GDL 52R satellite-weather installation.';
  }
  if (/GTS 820/.test(title)) {
    return 'Active traffic receiver that interrogates nearby transponders and displays traffic through an approved indirect HSDB interface path.';
  }
  if (/ChartView/.test(title)) {
    return 'Software enablement for displaying supported georeferenced approach charts on AXIS.';
  }
  if (/SurfaceWatch/.test(title)) {
    return 'Software enablement providing runway monitoring and visual/aural alerts for certain surface-operation risks.';
  }
  if (/TAWS-B/.test(title)) {
    return 'Software enablement adding Class B terrain-awareness alerting when the installation meets equipment and approval requirements.';
  }
  if (/GHA 15/.test(title) && !/Connector|Install Kit/.test(title)) {
    return 'Radio-frequency height advisor that supplies height-above-ground information and low-altitude awareness to AXIS.';
  }
  if (/GCO 14/.test(title)) {
    return 'Carbon-monoxide sensor that displays cabin CO levels and provides AXIS visual and aural alerts.';
  }
  if (/GAP 26/.test(title)) {
    return 'Pitot/AOA probe that supplies angle-of-attack data through a compatible GSU 25; heat capability varies by model.';
  }
  if (/GI 260/.test(title)) {
    return 'Dedicated external angle-of-attack indicator; optional when AOA is already displayed on AXIS.';
  }
  if (/GAD 29/.test(title) && !/Connector/.test(title)) {
    return 'ARINC 429 interface adapter used with certain external navigators or to provide navigation data to a G5 standby.';
  }
  if (/GAD 27/.test(title) && !/Connector/.test(title)) {
    return 'Electrical interface providing stabilized keep-alive power and optional landing/taxi-light wig-wag control.';
  }
  if (/Connector Kit/.test(title)) {
    return 'Provides the approved mating connectors and backshell hardware needed to wire the named unit into the AXIS system.';
  }
  if (/Install Kit|Install Rack|Installation Kit/.test(title)) {
    return 'Provides the mounting or installation hardware required for the named unit and stated aircraft application.';
  }
  if (step === '4A') {
    return 'Engine or airframe sensor used by the selected GEA interface to provide the stated measurement to AXIS.';
  }
  return 'Garmin hardware or software option used to complete the selected AXIS system function; final applicability is configuration-specific.';
};

const parse = (source: string): AxisPlannerItem[] =>
  source
    .trim()
    .split('\n')
    .map((line) => {
      const [step, sku, price, title] = line.split('|');
      return {
        step,
        sku,
        price: Number(price),
        title,
        description: describeItem({ step, title }),
      };
    });

export const AXIS_ITEMS: Record<AxisPlannerKind, AxisPlannerItem[]> = {
  certified: parse(CERTIFIED),
  experimental: parse(EXPERIMENTAL),
};

export const AXIS_STEPS: Record<AxisPlannerKind, AxisPlannerStep[]> = {
  certified: [
    {
      id: '1',
      title: 'Select Displays',
      guidance:
        'Choose up to four AXIS displays. Mix formats as panel space and the approved configuration allow.',
    },
    {
      id: '1A',
      title: 'Display Install Kits',
      guidance:
        'Each display requires the correct new-install or G3X Touch upgrade kit. IFR GPS displays require a GA 35S antenna. Select one printed-material kit per aircraft.',
    },
    {
      id: '2',
      title: 'System Sensors',
      guidance:
        'Choose at least one sensor LRU kit and its matching installation kit. A certified system may use a maximum of two ADAHRS, one of each listed sensor-kit type.',
    },
    {
      id: '3',
      title: 'Standby Flight Instrument',
      guidance:
        'A standby flight instrument is required. Choose G5 or GI 275; use the GI 275 +AP model when retaining a compatible non-Garmin autopilot.',
    },
    {
      id: '4',
      title: 'Engine / Airframe Interface',
      guidance:
        'Typically one GEA module is required per engine. GEA 110 requires an AXIS display with integrated COMM or NAV/COMM.',
    },
    {
      id: '4A',
      title: 'Engine Sensors',
      guidance:
        'Select the sensor kit appropriate for the installed Lycoming or Continental engine. RWAS will confirm any additional sensors.',
    },
    {
      id: '5',
      title: 'Autopilot',
      guidance:
        'AXIS integrates with GFC 500 but does not replace the GMC 507 controller. Select one GSA 28 for each required pitch, roll, pitch-trim or yaw-damper axis. Eligibility, brackets and final hardware are aircraft-specific.',
    },
    {
      id: '5A',
      title: 'Autopilot Install Hardware',
      guidance:
        'Select one connector kit per GSA 28. Aircraft-specific servo mounts, brackets and harness hardware will be confirmed by RWAS during configuration review.',
    },
    {
      id: '6',
      title: 'IFR GPS, Radios and Audio Panel',
      guidance:
        'Skip external equipment already provided by an integrated AXIS display. Otherwise select the navigator, radios and audio panel needed for the mission.',
    },
    {
      id: '7',
      title: 'Transponder and Datalinks',
      guidance:
        'Select ADS-B Out/In and weather options. Remote GDL units require the connector kit; SiriusXM receivers require the GA 24 TNC antenna.',
    },
    {
      id: '7A',
      title: 'Active Traffic',
      guidance:
        'GTS 8XX active traffic is compatible through the approved HSDB interface path. GTS 820 is the current model with a published July 2026 list price; only one ADS-B In source can be configured at a time.',
    },
    {
      id: '8A',
      title: 'Software Enablements',
      guidance:
        'Add database-driven display capabilities for the intended mission. Enablement eligibility depends on the selected display and installed navigation equipment.',
    },
    {
      id: '8B',
      title: 'Safety Sensors and Awareness',
      guidance:
        'Select radio-height advisory, carbon-monoxide detection and angle-of-attack hardware as applicable. Each sensor requires the installation hardware shown for that option.',
    },
    {
      id: '8C',
      title: 'Navigation and Electrical Interfaces',
      guidance:
        'GAD 29 may be needed for an older navigator or G5 navigation display. GAD 27 provides keep-alive power and optional landing/taxi-light wig-wag functions.',
    },
  ],
  experimental: [
    {
      id: '1',
      title: 'Select Displays',
      guidance:
        'Choose up to six displays. AXIS X models are non-TSO; certified displays with integrated IFR GPS/radios may be mixed into an experimental system.',
    },
    {
      id: '1A',
      title: 'Display Install Kits',
      guidance:
        'Each display requires the correct new-install or G3X Touch upgrade kit. IFR GPS displays require a GA 35S antenna. Select one printed-material kit per aircraft.',
    },
    {
      id: '2',
      title: 'System Sensors',
      guidance:
        'Choose a core AXIS X sensor kit. Aircraft exceeding 300 KIAS should use the GSU 25D/GMU 22 kit. Unit-only sensors are supplemental.',
    },
    {
      id: '2A',
      title: 'System Sensor Install Kits',
      guidance:
        'For a new installation, select one matching connector/install kit for every system or supplemental sensor selected.',
    },
    {
      id: '3',
      title: 'Standby Flight Instrument',
      guidance:
        'Add G5 for redundancy. For outside-air temperature, use GAD 13 and GTP 59; the AXIS LRU kit GTP 59 can be shared with G5.',
    },
    {
      id: '4',
      title: 'Engine / Airframe Interface',
      guidance:
        'Typically one GEA module is required per engine unless it has more than six cylinders. GEA 110 requires an AXIS COMM or NAV/COMM display.',
    },
    {
      id: '4A',
      title: 'Engine Sensors',
      guidance:
        'Select the appropriate Lycoming/Continental or Rotax kit, then add individual sensors only as the engine installation requires.',
    },
    {
      id: '5',
      title: 'GFC 500X Autopilot',
      guidance:
        'Select one GSA 28 servo for each desired axis: pitch, roll and optional yaw damper. GMC 507 is optional but recommended.',
    },
    {
      id: '5A',
      title: 'Autopilot Install Kits and Servo Mounts',
      guidance:
        'Select one connector kit per servo, the GMC connector/rack when applicable, and the aircraft-specific servo mount kit.',
    },
    {
      id: '6',
      title: 'IFR GPS, Radios and Audio Panel',
      guidance:
        'Skip external equipment already provided by an integrated AXIS display. Otherwise select compatible navigation, radio and audio equipment.',
    },
    {
      id: '7',
      title: 'Transponder and Datalinks',
      guidance:
        'A GTX 45R with GPS can provide the ADS-B Out position source when no IFR GPS is installed. Remote GDLs require a connector kit; SiriusXM requires a GA 24 TNC antenna.',
    },
    {
      id: '7A',
      title: 'Active Traffic',
      guidance:
        'GTS 8XX active traffic is compatible through HSDB. GTS 820 is the current model with a published July 2026 list price; avoid configuring conflicting traffic sources.',
    },
    {
      id: '8A',
      title: 'Software Enablements',
      guidance:
        'Add database-driven display capabilities for the intended mission. Enablement eligibility depends on the selected display and installed navigation equipment.',
    },
    {
      id: '8B',
      title: 'Safety Sensors and Awareness',
      guidance:
        'Select height advisory, carbon-monoxide detection and angle-of-attack hardware as applicable. Choose the GAP 26 model that matches the aircraft electrical and pitot-heat design.',
    },
    {
      id: '8C',
      title: 'Navigation and Electrical Interfaces',
      guidance:
        'GAD 29 may be required with an older GPS navigator or for navigation on G5. GAD 27 provides keep-alive power and optional landing/taxi-light wig-wag functions.',
    },
  ],
};
