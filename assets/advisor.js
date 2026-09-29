/* ============================================================================
   ATS — UAE Used Cars Advisor
   Single-file logic. Nothing to build, no dependencies, no backend required:
   leads hand off to WhatsApp exactly like the booking form on index.html.

   EDIT POINTS — everything you will realistically want to change lives in
   two places only:
     1. CONFIG  — phone number, fees, commission rate, valuation assumptions.
     2. MODELS  — the vehicle / known-fault / price-band database.
   ========================================================================== */

const CONFIG = {
  whatsapp: '971558329858',
  currency: 'AED',

  /* -- Service pricing. Both models are offered side by side: a FIXED fee and
        a COMMISSION on the sale. Adjust freely — the plan cards, the
        comparator and the net-proceeds maths all read from here. ----------- */
  fees: {
    inspectionBasic:      450,   // pre-purchase inspection, one vehicle, on site
    inspectionFull:       750,   // PPI + full module scan + written report
    buyerAgentFixed:     1800,   // sourcing, negotiation, transfer handled
    sellerFixed:         2500,   // managed sale, flat fee, no % taken
    sellerCommissionPct:  2.5,   // % of final agreed sale price
    sellerCommissionMin: 2000,   // floor on the commission plan
    transferAdmin:        350,   // RTA / Tasjeel running-around, per transfer
  },

  /* -- Valuation model assumptions (indicative only). ------------------- */
  val: {
    kmPerYearBaseline: 20000,   // UAE average; deviation moves the number
    kmPenaltyPer10k:   0.018,   // 1.8% off per 10,000 km above baseline
    kmBonusPer10k:     0.012,   // 1.2% on per 10,000 km below baseline
    accidentMajor:     0.18,    // chassis / structural repair
    accidentMinor:     0.06,    // panel work only
    noServiceHistory:  0.09,
    nonGccImport:      0.16,    // US / Japan import discount in this market
    spreadPct:         0.07,    // ± band on the quoted estimate
    tradeInFactor:     0.82,    // typical showroom offer vs private-sale value
    yearCurve:         1.5,     // >1 pushes mid-age cars nearer the band floor
    conditionFactor: { excellent: 1.05, good: 1.0, fair: 0.9, rough: 0.78 },
  },
};

/* ============================================================================
   MODELS — UAE used-market reference data.

   price   : [low, high] AED span across the listed year range. INDICATIVE.
             Re-check against live classifieds before quoting a customer.
   rel     : 1–5 durability score AS EXPERIENCED IN UAE HEAT, not a global
             reliability rating. Cooling, A/C, rubber and gearbox thermal load
             are weighted heavily — that is what actually fails here.
   faults  : documented, commonly-seen failures. Keep this list honest; it is
             the part of the page that earns trust.
   check   : what ATS specifically puts on the lift / scanner for this platform.
   recon   : realistic first-12-months spend [low, high] on a clean example.
   ========================================================================== */
const MODELS = [
  {
    name: 'Toyota Land Cruiser 200', yrs: '2012–2021', body: 'suv',
    tags: ['family', 'offroad', 'highway', 'tow'], price: [85000, 330000],
    eng: '4.0 V6 1GR-FE / 4.6–5.7 V8 UR', gbx: '6-spd / 8-spd auto', parts: 'mid', rel: 5,
    faults: [
      'Exhaust manifold hairline cracks on some V8 UR engines',
      'Rear A/C evaporator and blower failures from dust load',
      'Front diff pinion and CV boot seepage on high-km cars',
      'Brake booster / actuator assembly on later facelift cars is expensive',
    ],
    check: ['Full module scan for stored 4WD and ABS codes', 'Coolant and A/C pressure under load', 'Chassis rail and rear crossmember for desert damage'],
    recon: [3000, 9000],
    verdict: 'The default safe answer in this market. Holds value better than anything else, parts are everywhere, and nothing about it is thermally marginal.',
  },
  {
    name: 'Nissan Patrol Y62', yrs: '2013–2022', body: 'suv',
    tags: ['family', 'offroad', 'highway', 'tow', 'fun'], price: [70000, 280000],
    eng: '5.6 V8 VK56VD', gbx: '7-spd auto', parts: 'mid', rel: 4,
    faults: [
      'Early VK56VD (roughly 2011–2013) valve-seat and timing-chain-guide noise',
      'Transfer case actuator and 4WD mode selector faults',
      'Hydraulic Body Motion Control lines and accumulators leak with age',
      'ICC / centre display and A/C amplifier electrical gremlins',
    ],
    check: ['Cold-start listen for chain rattle before anything else', 'HBMC circuit for weeping and pressure hold', 'Transfer case actuator commanded through the scan tool'],
    recon: [4000, 14000],
    verdict: 'Enormous performance per dirham. Buy a post-2014 car, verify the cold start, and budget for the hydraulic suspension eventually.',
  },
  {
    name: 'Toyota Prado 150', yrs: '2010–2023', body: 'suv',
    tags: ['family', 'offroad', 'highway'], price: [55000, 210000],
    eng: '2.7 4-cyl / 4.0 V6 1GR-FE', gbx: '5/6-spd auto', parts: 'cheap', rel: 5,
    faults: [
      'Front CV boots and lower ball joints on dune-driven cars',
      'Rear A/C blower and evaporator restriction',
      '2.7 four-cylinder is genuinely underpowered fully loaded',
    ],
    check: ['Steering rack and ball joint play', 'Diff and transfer oil condition for water ingress', 'Underbody for sand-blasted / bent skid plates'],
    recon: [2500, 7000],
    verdict: 'Lowest-risk family SUV under 150k. Take the 4.0 V6 if the budget stretches — the 2.7 works the gearbox hard in traffic.',
  },
  {
    name: 'Lexus LX570', yrs: '2012–2021', body: 'suv',
    tags: ['family', 'offroad', 'highway', 'tow'], price: [95000, 330000],
    eng: '5.7 V8 3UR-FE', gbx: '6/8-spd auto', parts: 'premium', rel: 4,
    faults: [
      'AHC hydraulic suspension: accumulators, height sensors and fluid neglect',
      'Air suspension / AHC warning lights are the single biggest bill on this car',
      'Rear entertainment and Mark Levinson amplifier faults',
    ],
    check: ['AHC pressure and height-sensor calibration on the lift', 'AHC fluid condition and leak trace', 'Full body control module scan'],
    recon: [5000, 18000],
    verdict: 'A Land Cruiser with a hydraulic suspension bill attached. Superb otherwise — just price the AHC into the offer, never assume it is fine.',
  },
  {
    name: 'Mitsubishi Pajero V80', yrs: '2010–2021', body: 'suv',
    tags: ['family', 'offroad', 'economy'], price: [30000, 90000],
    eng: '3.0 / 3.8 V6 6G7x', gbx: '5-spd auto', parts: 'cheap', rel: 4,
    faults: [
      '4WD transfer actuator and front diff engagement failures',
      'Ball joints, bushings and steering idler wear early on rough roads',
      'A/C condenser and cooling fan clutch',
    ],
    check: ['4WD engagement through all modes, actuator commanded', 'Front diff and transfer for leaks', 'Rust in rear wheel arches on coastal cars'],
    recon: [2500, 7000],
    verdict: 'The value play for real off-road use. Mechanically simple, parts are cheap, resale is weak — which is exactly why it is cheap to own.',
  },
  {
    name: 'Toyota Corolla', yrs: '2014–2023', body: 'sedan',
    tags: ['city', 'economy', 'family'], price: [22000, 75000],
    eng: '1.6 / 2.0 4-cyl', gbx: 'CVT / 4-spd auto', parts: 'cheap', rel: 5,
    faults: [
      'CVT fluid neglect on fleet and ex-rental cars',
      'A/C evaporator smell and blower resistor',
      'Suspension bushings and strut mounts from speed bumps',
    ],
    check: ['CVT fluid condition and adaptation counters', 'Service history vs odometer plausibility', 'Ex-rental indicators: door jamb stickers, key count, rear seat wear'],
    recon: [1200, 4000],
    verdict: 'Nothing cheaper to run, nothing easier to resell. The only real risk is buying an abused ex-rental — that is a history check, not a mechanical one.',
  },
  {
    name: 'Toyota Camry', yrs: '2013–2023', body: 'sedan',
    tags: ['city', 'family', 'economy', 'highway'], price: [30000, 105000],
    eng: '2.5 2AR-FE / 3.5 V6', gbx: '6/8-spd auto', parts: 'cheap', rel: 5,
    faults: [
      'Water pump and thermostat housing seepage past 120k km',
      'Front strut mounts and sway bar bushings',
      'Minor oil consumption on some early 2AR-FE engines',
    ],
    check: ['Cooling system pressure test', 'Transmission fluid condition and shift quality under load', 'Odometer against RTA history'],
    recon: [1500, 4500],
    verdict: 'The sensible ceiling for a family sedan here. V6 cars are barely more to run and drive far better.',
  },
  {
    name: 'Lexus ES350', yrs: '2013–2023', body: 'sedan',
    tags: ['city', 'family', 'highway'], price: [30000, 110000],
    eng: '3.5 V6 2GR-FE', gbx: '6/8-spd auto', parts: 'mid', rel: 5,
    faults: [
      'Rubber oil cooler hose in the V-bank — a known failure worth replacing preemptively',
      'A/C compressor and rear evaporator on high-km cars',
      'Dashboard and door-card plastics degrade in the sun on older examples',
    ],
    check: ['Oil cooler hose condition — direct inspection, not a guess', 'Cooling system pressure and coolant condition', 'Full scan for stored airbag and body codes'],
    recon: [2000, 6000],
    verdict: 'Camry reliability with a properly insulated cabin. Best value luxury sedan in the market if you skip the German alternatives.',
  },
  {
    name: 'Honda Accord', yrs: '2013–2022', body: 'sedan',
    tags: ['city', 'family', 'economy'], price: [28000, 85000],
    eng: '2.4 Earth Dreams / 3.5 V6', gbx: 'CVT / 6-spd auto', parts: 'cheap', rel: 4,
    faults: [
      'VTC actuator rattle on cold start (2.4 engines)',
      'CVT fluid service interval is routinely ignored here',
      'A/C compressor clutch and condenser',
    ],
    check: ['Cold-start VTC rattle', 'CVT fluid and drive quality from cold', 'A/C output temperature after 15 minutes idling'],
    recon: [1500, 5000],
    verdict: 'Better to drive than a Camry, slightly more to fix, resale a step behind Toyota. Fine buy on service history.',
  },
  {
    name: 'Nissan Altima L33', yrs: '2013–2023', body: 'sedan',
    tags: ['city', 'economy'], price: [20000, 65000],
    eng: '2.5 QR25DE', gbx: 'JATCO CVT', parts: 'cheap', rel: 2,
    faults: [
      'JATCO CVT judder, whine and failure — heat accelerates it badly here',
      'CVT cooling is marginal in summer traffic',
      'A/C compressor and cooling fan assembly',
    ],
    check: ['CVT fluid colour and smell, plus a hot drive at low speed', 'Stored CVT codes and adaptation data', 'Ex-rental / taxi history — most cheap ones are'],
    recon: [3000, 16000],
    verdict: 'Only buy with a documented CVT service record, or with the gearbox already replaced. Otherwise the purchase price is a deposit on a gearbox.',
  },
  {
    name: 'Hyundai Sonata / Kia Optima', yrs: '2012–2019', body: 'sedan',
    tags: ['city', 'economy'], price: [20000, 60000],
    eng: '2.4 GDI Theta II', gbx: '6-spd auto', parts: 'cheap', rel: 2,
    faults: [
      'Theta II 2.4 GDI rod-bearing failure — subject to recall campaigns, verify it was done',
      'Carbon build-up on GDI intake valves',
      'Steering coupler noise and A/C compressor',
    ],
    check: ['Engine knock at hot idle — listen before the test drive, not after', 'Recall status against the VIN', 'Oil level and condition, and whether it burns oil'],
    recon: [2000, 14000],
    verdict: 'Cheap to buy for a reason. Acceptable only with proven recall work and a clean hot-idle listen.',
  },
  {
    name: 'Volkswagen Golf Mk7 / Tiguan', yrs: '2013–2021', body: 'hatch',
    tags: ['city', 'fun', 'economy'], price: [22000, 70000],
    eng: '1.4 TSI EA211 / 2.0 TSI EA888', gbx: 'DQ200 dry DSG / DQ250 wet DSG', parts: 'mid', rel: 2,
    faults: [
      'DQ200 seven-speed dry-clutch mechatronic failure — heat is the trigger',
      'Water pump / thermostat housing leaks, plastic housings crack',
      'PCV / crankcase breather diaphragm, then rough idle and oil consumption',
      'EA888 timing chain tensioner on earlier Gen2 engines',
    ],
    check: ['DSG adaptation values and clutch wear data read out, not guessed', 'Hot low-speed crawl test for mechatronic shudder', 'Coolant housing and water pump area for dried residue'],
    recon: [3500, 15000],
    verdict: 'Great to drive, thermally fragile here. Wet-clutch DQ250 cars are the safer pick; a dry DQ200 needs read-out proof, not a clean invoice.',
  },
  {
    name: 'Audi Q5 (8R)', yrs: '2012–2017', body: 'suv',
    tags: ['city', 'family', 'highway'], price: [30000, 80000],
    eng: '2.0 TFSI EA888 Gen2', gbx: '8-spd Tiptronic / S tronic', parts: 'premium', rel: 2,
    faults: [
      'EA888 Gen2 timing chain tensioner failure on pre-2013 engines',
      'Oil consumption from piston ring design on the same engine family',
      'PCV diaphragm and water pump housing leaks',
      'Sunroof drains blocking and wetting the footwell electronics',
    ],
    check: ['Chain tensioner revision confirmed physically or via invoice', 'Oil consumption question asked directly and verified against level', 'Full scan including stored freeze-frames, not just current codes'],
    recon: [4000, 18000],
    verdict: 'Only worth it post-2013 with the revised tensioner and paperwork. Before that, the engine is a known liability.',
  },
  {
    name: 'BMW 528i F10 (N20)', yrs: '2011–2016', body: 'sedan',
    tags: ['city', 'highway', 'fun'], price: [28000, 75000],
    eng: '2.0 turbo N20', gbx: 'ZF 8-spd', parts: 'premium', rel: 2,
    faults: [
      'N20 timing chain and guide failure on earlier engines — catastrophic when it goes',
      'Oil filter housing gasket leaking onto the belt',
      'Electric water pump and thermostat, heat-related',
      'VANOS solenoids and eccentric shaft sensor',
      'ZF8 mechatronic sleeve seal weep',
    ],
    check: ['Chain and guide condition assessed properly — the deciding factor on price', 'Oil filter housing and belt area for contamination', 'Water pump current draw and coolant temp behaviour'],
    recon: [5000, 20000],
    verdict: 'Cheap to buy, expensive to own. Buyable only if the chain has documented attention and you accept a real maintenance budget.',
  },
  {
    name: 'BMW X5 F15 xDrive35i (N55)', yrs: '2014–2018', body: 'suv',
    tags: ['family', 'highway', 'fun'], price: [55000, 150000],
    eng: '3.0 turbo N55', gbx: 'ZF 8-spd', parts: 'premium', rel: 3,
    faults: [
      'Water pump and thermostat — treat as a service item in this climate',
      'Valve cover gasket and oil filter housing gasket leaks',
      'High pressure fuel pump and injectors',
      'Rear air suspension bags where fitted',
    ],
    check: ['Cooling system pressure test and water pump current draw', 'Rear air suspension hold test overnight where fitted', 'Full module scan with freeze-frame review'],
    recon: [4500, 16000],
    verdict: 'The N55 is the sane BMW six. Solid buy with records — budget cooling work as maintenance, not as a surprise.',
  },
  {
    name: 'BMW X5 / 550i (N63)', yrs: '2011–2017', body: 'suv',
    tags: ['family', 'highway', 'fun'], price: [50000, 140000],
    eng: '4.4 twin-turbo N63', gbx: 'ZF 8-spd', parts: 'premium', rel: 1,
    faults: [
      'Valve stem seal failure and heavy oil consumption — the defining N63 problem',
      'Turbo coolant lines and vacuum system degradation from underhood heat',
      'Battery drain and repeated battery failure',
      'Timing chain on early engines; injector and coil attrition throughout',
    ],
    check: ['Oil consumption history questioned and verified', 'Cold-start smoke and hot restart behaviour', 'Full scan for misfire counters and adaptation limits'],
    recon: [8000, 35000],
    verdict: 'Do not buy this on price alone. A cheap N63 is the most expensive car in this list — walk unless the seals and cooling are documented.',
  },
  {
    name: 'Mercedes E300 W212', yrs: '2012–2016', body: 'sedan',
    tags: ['city', 'highway', 'family'], price: [35000, 95000],
    eng: '3.5 V6 M276', gbx: '7G-Tronic 722.9', parts: 'premium', rel: 3,
    faults: [
      '722.9 conductor plate and 13-pin connector leak — gearbox fluid wicks into the loom',
      'Oil cooler seals and thermostat housing seepage',
      'Airmatic struts and compressor where fitted, heat-accelerated',
      'COMAND / SBC electrical faults and module communication codes',
    ],
    check: ['13-pin connector pulled and inspected for fluid migration', 'Gearbox adaptation and shift quality from cold', 'Airmatic hold test where fitted'],
    recon: [4000, 14000],
    verdict: 'A good W212 is an excellent car. The gearbox valve body and the 13-pin connector decide whether this one is good — check them first.',
  },
  {
    name: 'Mercedes ML / GLE W166', yrs: '2012–2019', body: 'suv',
    tags: ['family', 'highway', 'tow'], price: [55000, 170000],
    eng: '3.5 V6 / 4.7 V8 / diesel', gbx: '7G-Tronic / 9G-Tronic', parts: 'premium', rel: 3,
    faults: [
      'Airmatic compressor and struts',
      'Transfer case chain wear on earlier examples',
      'Front subframe and control arm bushings',
      '722.9 valve body on earlier cars; 9G is stronger',
    ],
    check: ['Airmatic overnight hold and compressor duty cycle', 'Transfer case noise on a steady-throttle load test', 'Full module scan and SCR / emissions status on diesels'],
    recon: [5000, 18000],
    verdict: 'Comfortable and capable. Later 9G-Tronic cars are the ones to chase; earlier cars carry both the gearbox and the transfer case risk.',
  },
  {
    name: 'Range Rover Sport L494', yrs: '2014–2021', body: 'suv',
    tags: ['family', 'highway', 'offroad', 'fun'], price: [70000, 220000],
    eng: '3.0 V6 SC / 5.0 V8 SC', gbx: 'ZF 8-spd', parts: 'premium', rel: 1,
    faults: [
      'Air suspension compressor, valve block and bags',
      'Timing chain and tensioner on the 5.0 supercharged V8',
      'Cooling system, supercharger coolant pump and thermostats',
      'InControl / infotainment and pervasive module communication faults',
    ],
    check: ['Air suspension hold test and compressor duty', 'Full module scan — expect stored codes, judge which ones matter', 'Coolant condition and supercharger intercooler circuit'],
    recon: [10000, 40000],
    verdict: 'Buy for how it feels, never for value. Only with a full main-dealer history and a genuine running budget — otherwise this is a money pit with a good badge.',
  },
  {
    name: 'Ford Explorer U502', yrs: '2012–2019', body: 'suv',
    tags: ['family', 'economy', 'highway'], price: [28000, 110000],
    eng: '3.5 V6 Cyclone / 2.3 EcoBoost', gbx: '6F50 6-spd auto', parts: 'cheap', rel: 2,
    faults: [
      'Internal, timing-cover-driven water pump on the 3.5 V6 — failure dumps coolant into the oil',
      'PTU (power transfer unit) overheating and fluid breakdown',
      'Transmission valve body and torque converter shudder',
      'A/C and rear blower failures',
    ],
    check: ['Oil for coolant contamination — non-negotiable on the 3.5 V6', 'PTU for heat discolouration and leaks', 'Transmission fluid condition and shift shock at low speed'],
    recon: [3500, 18000],
    verdict: 'Enormous space per dirham with one serious engineering flaw. Only with a clean oil analysis and a PTU inspection.',
  },
  {
    name: 'Jeep Grand Cherokee WK2', yrs: '2012–2021', body: 'suv',
    tags: ['family', 'offroad', 'fun'], price: [30000, 120000],
    eng: '3.6 Pentastar / 5.7 HEMI', gbx: '5/8-spd auto', parts: 'mid', rel: 2,
    faults: [
      'Pentastar cylinder head failure on 2011–2013 engines',
      'Rocker arm / lifter tick and, on HEMI, MDS lifter issues',
      'Quadra-Lift air suspension compressor and bags',
      'TIPM and general electrical module faults',
    ],
    check: ['Cold-start and hot-idle tick localisation', 'Air suspension hold and compressor test', 'Full scan including TIPM-related body codes'],
    recon: [4000, 18000],
    verdict: 'Good off-road, weak electrically. Post-2014 Pentastar cars only, and price the air suspension in.',
  },
  {
    name: 'Chevrolet Tahoe / Suburban', yrs: '2012–2020', body: 'suv',
    tags: ['family', 'tow', 'highway', 'offroad'], price: [45000, 190000],
    eng: '5.3 V8 (AFM) / 6.2 V8', gbx: '6L80 / 8L90 / 10-spd', parts: 'cheap', rel: 3,
    faults: [
      'AFM / DoD lifter collapse and oil consumption on the 5.3',
      '6L80 torque converter shudder and valve body wear',
      'A/C rear lines and evaporator',
      'Magnetic ride dampers where fitted',
    ],
    check: ['Cylinder deactivation history and lifter noise at hot idle', 'Transmission shudder at light throttle, 60–80 km/h', 'Oil consumption asked and verified'],
    recon: [3000, 14000],
    verdict: 'Cheapest big-family seat count with cheap parts. AFM lifters and the 6L80 are the two things that decide the offer.',
  },
  {
    name: 'Toyota Hilux', yrs: '2012–2023', body: 'pickup',
    tags: ['tow', 'offroad', 'economy', 'highway'], price: [35000, 130000],
    eng: '2.7 petrol / 4.0 V6 / 2.8 diesel', gbx: '5/6-spd manual & auto', parts: 'cheap', rel: 5,
    faults: [
      'Leaf spring and bushing wear on overloaded work trucks',
      'Front CV and wheel bearing wear on 4WD examples',
      'A/C condenser damage from stone strike',
    ],
    check: ['Chassis and rear leaf mounts for overload distortion', 'Diff and transfer oil for water', 'Service history vs commercial use hours'],
    recon: [1500, 6000],
    verdict: 'Nearly unkillable. The only question is how hard the previous owner worked it — inspect the chassis, not the engine.',
  },
  {
    name: 'Mazda CX-5 / Mazda 6', yrs: '2013–2022', body: 'suv',
    tags: ['city', 'family', 'economy'], price: [30000, 95000],
    eng: '2.0 / 2.5 SkyActiv-G', gbx: '6-spd auto', parts: 'mid', rel: 4,
    faults: [
      'Cooling fan and water pump on high-km cars',
      'Rear brake and suspension wear from city driving',
      'Infotainment (CMU) software faults on earlier cars',
    ],
    check: ['Cooling system condition and coolant level history', 'Carbon build-up symptoms on 2.5 engines', 'Full scan for stored body and i-ACTIVSENSE codes'],
    recon: [1800, 6000],
    verdict: 'The best-driving mainstream option. Slightly thinner parts network than Toyota, but no structural weak point.',
  },
];

/* ========================== helpers ==================================== */
const AED = (n) => CONFIG.currency + ' ' + Math.round(n).toLocaleString('en-US');
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yearsOf = (m) => { const p = m.yrs.split(/[–-]/); return [parseInt(p[0], 10), parseInt(p[1], 10)]; };

/* ========================== BUYER ADVISOR ============================== */
const buyerState = { budget: 90000, body: 'any', use: 'family', horizon: 'long', tolerance: 'low' };

function scoreModel(m, s) {
  // must be reachable inside budget: the low end of the band has to fit
  if (m.price[0] > s.budget * 1.02) return null;
  if (s.body !== 'any' && m.body !== s.body) return null;

  let score = m.rel * 10;

  // use-case match
  if (m.tags.includes(s.use)) score += 14;

  // budget positioning — reward cars whose mid-band sits inside the budget
  const mid = (m.price[0] + m.price[1]) / 2;
  if (s.budget >= mid) score += 10;
  else if (s.budget >= m.price[0] * 1.25) score += 5;

  // long ownership punishes fragile platforms harder
  if (s.horizon === 'long') score += (m.rel - 3) * 7;

  // maintenance tolerance
  if (s.tolerance === 'low') {
    score -= (5 - m.rel) * 8;
    if (m.parts === 'premium') score -= 8;
  } else if (s.tolerance === 'high') {
    score += m.parts === 'premium' ? 5 : 0;
  }

  // class fit: a big budget spent on a small car is the wrong recommendation,
  // even when that car is the more reliable one
  score += Math.min(12, (mid / Math.max(s.budget, 1)) * 12);

  // recon exposure relative to budget
  const reconMid = (m.recon[0] + m.recon[1]) / 2;
  score -= Math.min(18, (reconMid / Math.max(s.budget, 1)) * 100);

  return score;
}

function verdictBadge(m, s) {
  const longHold = s.horizon === 'long';
  if (m.rel >= 4) return ['good', 'Low risk'];
  if (m.rel === 3) return ['ok', longHold ? 'Budget for upkeep' : 'Manageable'];
  return ['risk', 'Condition-critical'];
}

function renderBuyer() {
  const rank = (pool) => pool
    .map((m) => ({ m, s: scoreModel(m, buyerState) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.s - a.s);

  // The use case is a hard filter first: recommending a saloon for dune work
  // is worse than recommending nothing. Only if that leaves too thin a list do
  // we relax it and rank the whole set on score alone.
  let scored = rank(MODELS.filter((m) => m.tags.includes(buyerState.use)));
  if (scored.length < 3) {
    const seen = new Set(scored.map((x) => x.m.name));
    scored = scored.concat(rank(MODELS).filter((x) => !seen.has(x.m.name)));
  }
  scored = scored.slice(0, 5);

  const out = $('#buy-results');
  if (!scored.length) {
    out.innerHTML = '<div class="empty">Nothing in the reference set fits that combination. Widen the budget or clear the body-type filter — or send us the brief and we will source outside the list.</div>';
    return;
  }

  out.innerHTML = scored.map(({ m }) => {
    const [cls, label] = verdictBadge(m, buyerState);
    const ceiling = Math.min(buyerState.budget, m.price[1]);
    return `
    <article class="res">
      <div>
        <div class="res-head">
          <h3>${esc(m.name)}</h3>
          <span class="yrs">${esc(m.yrs)}</span>
          <span class="score ${cls}">${label}</span>
        </div>
        <p class="spec">${esc(m.eng)} &nbsp;·&nbsp; ${esc(m.gbx)}</p>
        <p class="verdict">${esc(m.verdict)}</p>
        <div class="blk">
          <span class="k">Known faults on this platform</span>
          <ul>${m.faults.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
        </div>
        <div class="blk check">
          <span class="k">What ATS checks before you pay</span>
          <ul>${m.check.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        </div>
      </div>
      <aside class="res-side">
        <div class="kv"><span class="k">Market band</span><span class="v">${AED(m.price[0])} – ${AED(m.price[1])}</span></div>
        <div class="kv"><span class="k">Your ceiling</span><span class="v">${AED(ceiling)}</span></div>
        <div class="kv"><span class="k">First-year recon</span><span class="v">${AED(m.recon[0])} – ${AED(m.recon[1])}</span></div>
        <div class="kv"><span class="k">Parts cost</span><span class="v">${m.parts === 'cheap' ? 'Low' : m.parts === 'mid' ? 'Moderate' : 'High'}</span></div>
        <div class="kv"><span class="k">Heat durability</span><span class="v">${m.rel}/5</span></div>
        <a class="btn btn-outline btn-sm" style="width:100%;margin-top:18px"
           href="#lead" data-prefill="${esc(m.name)}">Get this one inspected</a>
      </aside>
    </article>`;
  }).join('');

  $$('#buy-results [data-prefill]').forEach((a) => {
    a.addEventListener('click', () => {
      $('#lf-intent').value = 'BUY';
      $('#lf-vehicle').value = a.dataset.prefill;
      syncLeadForm();
    });
  });
}

/* ========================== SELLER VALUATION =========================== */
function estimateValue() {
  const m = MODELS[parseInt($('#sv-model').value, 10)];
  const year = parseInt($('#sv-year').value, 10);
  const km = parseInt($('#sv-km').value, 10);
  const cond = $('#sv-cond').value;
  const v = CONFIG.val;

  const [y0, y1] = yearsOf(m);
  const t = y1 === y0 ? 1 : Math.min(1, Math.max(0, (year - y0) / (y1 - y0)));
  let base = m.price[0] + (m.price[1] - m.price[0]) * Math.pow(t, v.yearCurve);

  // kilometre deviation from the local baseline
  const age = Math.max(1, new Date().getFullYear() - year);
  const expectedKm = age * v.kmPerYearBaseline;
  const deltaKm = km - expectedKm;
  base *= deltaKm > 0
    ? 1 - Math.min(0.28, (deltaKm / 10000) * v.kmPenaltyPer10k)
    : 1 + Math.min(0.10, (-deltaKm / 10000) * v.kmBonusPer10k);

  base *= v.conditionFactor[cond];

  const flags = [];
  if ($('#sv-acc').value === 'major') { base *= 1 - v.accidentMajor; flags.push('Structural repair history'); }
  if ($('#sv-acc').value === 'minor') { base *= 1 - v.accidentMinor; flags.push('Panel repair history'); }
  if (!$('#sv-hist').checked) { base *= 1 - v.noServiceHistory; flags.push('No documented service history'); }
  if ($('#sv-spec').value === 'import') { base *= 1 - v.nonGccImport; flags.push('Non-GCC import'); }

  base = Math.max(base, m.price[0] * 0.45);
  return { m, base, lo: base * (1 - v.spreadPct), hi: base * (1 + v.spreadPct), flags };
}

function renderSeller() {
  const r = estimateValue();
  const f = CONFIG.fees;
  const price = r.base;
  const commission = Math.max(price * (f.sellerCommissionPct / 100), f.sellerCommissionMin);

  $('#sv-out').innerHTML = `
    <div class="val-cell highlight">
      <span class="k">Indicative private-sale range</span>
      <span class="big accent">${AED(r.lo)} – ${AED(r.hi)}</span>
      <span class="sub">Before reconditioning. Confirmed only after physical appraisal and a full module scan.</span>
    </div>
    <div class="val-cell">
      <span class="k">Net to you — fixed fee</span>
      <span class="big">${AED(price - f.sellerFixed)}</span>
      <span class="sub">${AED(f.sellerFixed)} flat, whatever the car sells for.</span>
    </div>
    <div class="val-cell">
      <span class="k">Net to you — commission</span>
      <span class="big">${AED(price - commission)}</span>
      <span class="sub">${CONFIG.fees.sellerCommissionPct}% of the agreed price, minimum ${AED(f.sellerCommissionMin)}.</span>
    </div>
    <div class="val-cell">
      <span class="k">Trade-in / dealer offer</span>
      <span class="big">${AED(price * CONFIG.val.tradeInFactor)}</span>
      <span class="sub">What a showroom typically offers for the same car — the gap is what a managed sale is worth.</span>
    </div>
    ${r.flags.length ? `<div class="val-cell"><span class="k">Applied deductions</span><span class="sub" style="margin-top:0">${r.flags.map(esc).join(' · ')}</span></div>` : ''}
    <div class="val-cell">
      <span class="k">Recommended pre-sale work</span>
      <span class="sub" style="margin-top:0">Clear all stored fault codes at source, A/C performance, full detail and paint correction. On this platform, expect ${AED(r.m.recon[0])} – ${AED(r.m.recon[1])} to present as a clean car — and it typically returns more than it costs.</span>
    </div>`;
}

/* ========================== FEE COMPARATOR ============================= */
function renderCompare() {
  const price = parseInt($('#cmp-price').value, 10);
  const f = CONFIG.fees;
  $('#cmp-price-out').textContent = AED(price);

  const commission = Math.max(price * (f.sellerCommissionPct / 100), f.sellerCommissionMin);
  const fixed = f.sellerFixed;
  const breakeven = fixed / (f.sellerCommissionPct / 100);
  const fixedWins = fixed < commission;

  $('#cmp-out').innerHTML = `
    <div class="cmp ${fixedWins ? 'win' : ''}">
      <span class="k">Fixed fee plan</span>
      <span class="n">${AED(fixed)}</span>
      <p class="d">Flat. Net to you ${AED(price - fixed)}.</p>
      ${fixedWins ? '<span class="badge">Cheaper at this price</span>' : ''}
    </div>
    <div class="cmp ${!fixedWins ? 'win' : ''}">
      <span class="k">Commission plan — ${f.sellerCommissionPct}%</span>
      <span class="n">${AED(commission)}</span>
      <p class="d">Net to you ${AED(price - commission)}.${commission === f.sellerCommissionMin ? ' Minimum fee applied.' : ''}</p>
      ${!fixedWins ? '<span class="badge">Cheaper at this price</span>' : ''}
    </div>
    <div class="cmp">
      <span class="k">Break-even price</span>
      <span class="n">${AED(breakeven)}</span>
      <p class="d">Above this, the fixed fee costs you less. Below it, take the commission plan — we will tell you which one you are in before you sign anything.</p>
    </div>`;
}

/* ========================== LEAD FORM ================================== */
function syncLeadForm() {
  const intent = $('#lf-intent').value;
  $('#lf-vehicle-label').textContent = intent === 'SELL'
    ? 'Your vehicle (make, model, year, km)'
    : 'Vehicle or shortlist you are considering';
  $('#lf-budget-wrap').hidden = intent === 'SELL';
  $('#lf-plan-wrap').hidden = intent === 'INSPECT';
}

function initLeadForm() {
  const form = $('#lead-form');
  const status = $('#lf-status');

  $('#lf-intent').addEventListener('change', syncLeadForm);
  syncLeadForm();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    status.textContent = '';
    status.className = 'form-status';

    if ($('#lf-hp').value) return; // honeypot

    const name = $('#lf-name').value.trim();
    const phone = $('#lf-phone').value.trim();
    if (name.length < 2) { status.textContent = 'Please enter your name.'; status.className = 'form-status err'; return; }
    if (phone.length < 6) { status.textContent = 'Please enter a valid phone number.'; status.className = 'form-status err'; return; }

    const sel = (id) => { const el = $(id); return el.options[el.selectedIndex].text; };
    const lines = [
      `Used Cars Advisor — ${sel('#lf-intent')}`,
      `Name: ${name}`,
      `Phone: ${phone}`,
    ];
    const vehicle = $('#lf-vehicle').value.trim();
    if (vehicle) lines.push(`Vehicle: ${vehicle}`);
    if (!$('#lf-budget-wrap').hidden && $('#lf-budget').value.trim()) lines.push(`Budget: AED ${$('#lf-budget').value.trim()}`);
    if (!$('#lf-plan-wrap').hidden) lines.push(`Preferred plan: ${sel('#lf-plan')}`);
    const notes = $('#lf-notes').value.trim();
    if (notes) lines.push(`Notes: ${notes}`);

    window.open(`https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
    status.textContent = 'Opening WhatsApp…';
    status.className = 'form-status ok';
  });
}

/* ========================== PLAN CARDS ================================= */
function renderPlans() {
  const f = CONFIG.fees;
  const plans = [
    { kind: 'fixed', tag: 'FIXED', name: 'Inspection only', price: AED(f.inspectionBasic), unit: 'per vehicle', who: 'Buyer',
      items: ['Full pre-purchase inspection on the lift', 'Complete module scan, all systems', 'Go / no-go call with a target price', 'Written summary on WhatsApp the same day'] },
    { kind: 'fixed', tag: 'FIXED', name: 'Inspection + report', price: AED(f.inspectionFull), unit: 'per vehicle', who: 'Buyer',
      items: ['Everything in Inspection only', 'Photographed written report, fault-by-fault', 'Costed repair list you can negotiate with', 'Second opinion on a car you already viewed'] },
    { kind: 'fixed', tag: 'FIXED', name: "Buyer's agent", price: AED(f.buyerAgentFixed), unit: 'flat, per purchase', who: 'Buyer',
      items: ['We shortlist and vet the listings for you', 'Inspection of the chosen car included', 'We negotiate on your behalf', `RTA transfer and paperwork handled (+${AED(f.transferAdmin)} fees)`] },
    { kind: 'commission', tag: 'BOTH', name: 'Managed sale', price: `${f.sellerCommissionPct}%`, unit: `of sale price · or ${AED(f.sellerFixed)} flat`, who: 'Seller',
      items: ['Appraisal, module scan and pre-sale fault clearing', 'Listing, photography and buyer filtering', 'Test drives and negotiation handled for you', 'Bank settlement and RTA transfer at the counter', 'You pick the fee model — whichever is cheaper for your car'] },
  ];

  $('#plan-grid').innerHTML = plans.map((p) => `
    <div class="plan ${p.kind}">
      <span class="tagx">${p.tag}</span>
      <h3>${esc(p.name)}</h3>
      <div class="price">${p.price}</div>
      <div class="who">${esc(p.unit)} · ${esc(p.who)}</div>
      <ul>${p.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <div class="foot"><a class="btn btn-outline btn-sm" style="width:100%" href="#lead">Start with this</a></div>
    </div>`).join('');
}

/* ========================== BOOT ======================================= */
function initBuyer() {
  const budget = $('#bv-budget');
  const out = $('#bv-budget-out');
  const sync = () => {
    buyerState.budget = parseInt(budget.value, 10);
    out.textContent = AED(buyerState.budget);
    renderBuyer();
  };
  budget.addEventListener('input', sync);

  $$('[data-group]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.group;
      $$(`[data-group="${g}"]`).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      buyerState[g] = btn.dataset.value;
      renderBuyer();
    });
  });
  sync();
}

function initSeller() {
  const sel = $('#sv-model');
  sel.innerHTML = MODELS.map((m, i) => `<option value="${i}">${esc(m.name)} — ${esc(m.yrs)}</option>`).join('');

  const year = $('#sv-year');
  const km = $('#sv-km');
  const syncYears = () => {
    const [y0, y1] = yearsOf(MODELS[parseInt(sel.value, 10)]);
    year.min = y0; year.max = y1;
    if (+year.value < y0 || +year.value > y1) year.value = Math.round((y0 + y1) / 2);
    $('#sv-year-out').textContent = year.value;
    $('#sv-km-out').textContent = (+km.value).toLocaleString('en-US') + ' km';
    renderSeller();
  };
  const syncOut = () => {
    $('#sv-year-out').textContent = year.value;
    $('#sv-km-out').textContent = (+km.value).toLocaleString('en-US') + ' km';
    renderSeller();
  };
  sel.addEventListener('change', syncYears);
  [year, km].forEach((el) => el.addEventListener('input', syncOut));
  ['#sv-cond', '#sv-acc', '#sv-spec', '#sv-hist'].forEach((s) => $(s).addEventListener('change', renderSeller));
  syncYears();
}

function initTabs() {
  $$('.mode-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.tab;
      $$('.mode-switch button').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
      $$('[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== target; });
      if (target === 'sell') { $('#lf-intent').value = 'SELL'; syncLeadForm(); }
      if (target === 'buy')  { $('#lf-intent').value = 'BUY';  syncLeadForm(); }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  renderPlans();
  initTabs();
  initBuyer();
  initSeller();
  $('#cmp-price').addEventListener('input', renderCompare);
  renderCompare();
  initLeadForm();
  $('#year-now').textContent = new Date().getFullYear();
});
