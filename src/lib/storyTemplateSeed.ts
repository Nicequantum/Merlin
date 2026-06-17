export type TemplateCategory = 'customer' | 'warranty';

export interface StoryTemplateSeed {
  title: string;
  category: TemplateCategory;
  tags: string[];
  complaint: string;
  cause: string;
  correction: string;
  /** Additional narrative detail preserved in the knowledge-base original. */
  fullDetail: string;
}

function buildCleanTemplate(entry: Omit<StoryTemplateSeed, 'title' | 'category' | 'tags' | 'fullDetail'>): string {
  return `Customer Complaint/Concern:
${entry.complaint}

Cause:
${entry.cause}

Correction:
${entry.correction}`;
}

function buildFullOriginal(entry: StoryTemplateSeed): string {
  return `${buildCleanTemplate(entry)}

---
ORIGINAL APPROVED SUBMISSION (FULL TECHNICIAN RECORD — preserve style and sequencing):

${entry.fullDetail}`;
}

export const STORY_TEMPLATE_SEEDS: StoryTemplateSeed[] = [
  // ─── Customer Pay ───────────────────────────────────────────────────────────
  {
    title: 'B Service',
    category: 'customer',
    tags: ['maintenance', 'service-b', 'customer-pay', 'oil', 'inspection'],
    complaint: 'Customer requests scheduled Mercedes-Benz Service B maintenance per maintenance booklet and vehicle mileage interval.',
    cause: 'Vehicle due for Service B interval. Maintenance inspection identified normal wear items per Mercedes-Benz maintenance standards. No customer-pay faults requiring additional diagnosis at this time.',
    correction:
      'Performed Service B per Mercedes-Benz maintenance booklet: replaced engine oil and filter, reset service indicator, completed maintenance inspection per workshop manual, checked and topped fluids as required, inspected brakes/tires/belts/hoses/lights/wipers, verified tire pressures, and road tested vehicle. Returned vehicle to customer with service documentation and next service due recommendation.',
    fullDetail:
      'Checked vehicle in with customer and confirmed Service B interval due. Reviewed maintenance history and verified no open campaigns affecting this visit. Lifted vehicle and drained engine oil; installed OEM oil filter and filled with approved Mercedes-Benz engine oil to specification. Reset ASSYST/service indicator via instrument cluster. Completed full maintenance inspection checklist including brake pad/shoe thickness, rotor condition, tire tread/pressure, suspension visual, exhaust, underbody, lighting, wiper blades, and fluid levels (coolant, brake, washer, power steering if equipped). Documented measurements on inspection report. Lowered vehicle, cleared service reminders, and performed road test — no abnormal noises, warnings, or drivability concerns noted. Mileage recorded at check-in and return. Explained completed work and next service interval to customer.',
  },
  {
    title: 'A Service',
    category: 'customer',
    tags: ['maintenance', 'service-a', 'customer-pay', 'oil', 'inspection'],
    complaint: 'Customer requests scheduled Mercedes-Benz Service A maintenance per maintenance booklet.',
    cause: 'Vehicle due for Service A interval. Routine maintenance inspection completed with no additional customer-pay faults identified.',
    correction:
      'Performed Service A per Mercedes-Benz maintenance booklet: replaced engine oil and filter, reset service indicator, completed maintenance inspection, checked fluids and tire pressures, inspected brakes and tires, and verified proper operation on road test. Vehicle returned to customer.',
    fullDetail:
      'Customer presented for Service A at scheduled mileage. Confirmed service due with customer and reviewed vehicle history. Performed oil and filter service using approved Mercedes-Benz oil and OEM filter; torqued drain plug to specification. Reset service indicator. Completed Service A inspection items per workshop manual including fluid levels, brake visual, tire condition/pressure, lighting, and wiper operation. No additional concerns reported during road test. Documented mileage in/out and provided copy of completed maintenance sheet.',
  },
  {
    title: 'Lube, Oil & Filter Service',
    category: 'customer',
    tags: ['maintenance', 'lof', 'customer-pay', 'oil', 'filter'],
    complaint: 'Customer requests lube, oil, and filter service.',
    cause: 'Routine oil change interval reached. No drivability or warning concerns reported by customer.',
    correction:
      'Performed lube, oil, and filter service: drained engine oil, replaced oil filter, installed approved engine oil to specification, checked and topped fluids as needed, reset service reminder if applicable, and verified no leaks. Road tested — no issues noted.',
    fullDetail:
      'Customer requested basic LOF service. Vehicle on lift — no active leaks observed at initial inspection. Drained engine oil while warm; replaced filter with OEM unit and installed new crush washer/seal as required. Filled crankcase with correct viscosity Mercedes-Benz approved oil to level. Checked coolant, brake fluid, washer fluid, and power steering fluid where applicable. Started engine, inspected for leaks at filter housing and drain plug — none found. Reset oil life/service reminder per model procedure. Short road test confirmed normal operation. Mileage documented and customer advised of next recommended oil change interval.',
  },

  // ─── Warranty Claims ────────────────────────────────────────────────────────
  {
    title: 'Blind Spot Assist Warning',
    category: 'warranty',
    tags: ['blind-spot', 'assist', 'radar', 'warning', 'driver-assistance', 'BAS'],
    complaint: 'Customer states blind spot assist warning/message displays intermittently or remains on while driving.',
    cause:
      'Initial test drive confirmed blind spot assist warning present during lane change simulation. Source voltage verified at battery. Battery charger installed. Connected XENTRY — Quick Test stored faults related to blind spot assist/radar sensor communication. Guided testing confirmed fault in blind spot monitor circuit/sensor. Found blind spot radar sensor/module internal fault or out-of-calibration condition causing false/unavailable status.',
    correction:
      'Replaced faulty blind spot assist radar sensor/module per guided test direction. Cleared faults and performed blind spot system calibration/initialization per WIS. Final Quick Test — no faults present. Disconnected charger and XENTRY. Final verification test drive — blind spot assist operated normally with no warning messages.',
    fullDetail:
      'Road tested vehicle and duplicated blind spot assist unavailable warning during moderate-speed lane change. Recorded mileage in. Battery voltage measured at rest — within acceptable range; maintainer connected to preserve voltage during diagnosis. XENTRY connected — Quick Test showed blind spot/right or left radar sensor communication/plausibility faults (document actual codes from scan). Performed guided tests for radar power/ground/CAN and sensor mounting alignment — sensor failed output plausibility. Removed bumper cover as required, replaced blind spot radar sensor, torqued fasteners to spec, reinstalled trim. Initialized/calibrated system per workshop manual road test procedure. Cleared all faults — final Quick Test clean. Verification drive 3–5 miles including multiple lane changes — system active, no warnings. Mileage out recorded.',
  },
  {
    title: 'MBUX System Failure',
    category: 'warranty',
    tags: ['mbux', 'head-unit', 'infotainment', 'screen', 'freeze', 'reboot'],
    complaint: 'Customer reports MBUX system failure — screen black, rebooting, or functions unavailable.',
    cause:
      'Confirmed MBUX inoperative/unstable on test drive and at key-on. Voltage maintained with battery charger. XENTRY Quick Test showed communication/control faults for head unit or infotainment CAN nodes. Guided testing indicated MBUX head unit internal failure or corrupted software state not recoverable by reset.',
    correction:
      'Performed documented power reset and software reload attempt per WIS. Fault persisted. Replaced MBUX head unit/control unit. Programmed/coded new unit to vehicle. Cleared faults — final Quick Test verified communication. Verification drive confirmed stable MBUX operation (audio, navigation, Bluetooth, backup camera).',
    fullDetail:
      'Customer complaint verified — MBUX would not boot consistently / displayed system error. Mileage in noted. Source voltage checked; charger installed. Quick Test revealed COM/infotainment faults (record codes). Checked fiber optic/MCAN integrity where applicable; power/ground at head unit within spec but unit unresponsive to hard reset and engineering menu reload. Ordered and installed replacement MBUX head unit. Transferred/coded vehicle data, VIN, and equipment codes. Post-repair Quick Test — all domains online. Customer functions validated on road and at standstill: radio, CarPlay/Android Auto if equipped, voice, nav, instrument cluster integration. No recurrence after 5+ mile verification drive.',
  },
  {
    title: 'Cylinder Head Failure',
    category: 'warranty',
    tags: ['engine', 'cylinder-head', 'coolant', 'overheat', 'misfire', 'M276', 'M264'],
    complaint: 'Customer reports engine running rough, overheating, coolant loss, and/or check engine light on.',
    cause:
      'Test drive confirmed rough running and/or temperature concern. XENTRY Quick Test showed cylinder-specific misfire and cooling system faults. Pressure tested cooling system — leak at cylinder head area. Combustion gas present in coolant. Cylinder head found cracked/warped or head gasket failed causing cross-contamination and misfire.',
    correction:
      'Removed cylinder head per workshop manual. Replaced cylinder head and head gasket set with required bolts. Replaced associated seals, thermostat, and coolant as required. Filled/bleed cooling system. Cleared adaptations where specified. Final Quick Test — no misfire/cooling faults. Road test — normal power, operating temperature stable.',
    fullDetail:
      'Duplicated concern — coolant odor and rough idle when warm. Quick Test: misfire counters on affected bank, temp sensor plausibility, possible P030x/P0128 (use actual codes). Cooling system pressure test failed at head gasket interface; block test confirmed combustion gases in coolant. Drained coolant, removed intake/manifolds as required, removed and inspected cylinder head — visible crack/warp/gasket failure. Installed new OEM head, multi-layer steel gasket, stretch bolts torqued in sequence, new plugs on affected bank. Replaced drive belts and coolant reservoir O-ring as needed. Refilled with approved coolant, vacuum filled/bleed procedure. Ran engine to operating temp, checked for leaks — none. Cleared faults, performed adaptation relearns if required. Extended road test — no overheating, smooth idle, normal power delivery.',
  },
  {
    title: 'Wind Noise Repair',
    category: 'warranty',
    tags: ['wind-noise', 'b-pillar', 'door-seal', 'weatherstrip', 'NVH', 'rattle'],
    complaint: 'Customer reports wind noise at highway speed, particularly from door/B-pillar/mirror area.',
    cause:
      'Test drive at highway speed reproduced wind noise at identified location. Inspected door seals, mirror gap, and trim alignment — found seal compression set, misaligned trim clip, or door adjustment out of specification causing turbulence.',
    correction:
      'Adjusted door/mirror/trim per body fit standards. Replaced worn door seal or trim clip as needed. Applied foam tape/anti-rattle correction per workshop bulletin where applicable. Verification drive at highway speed — wind noise eliminated or reduced to normal level.',
    fullDetail:
      'Road test 60–70 MPH duplicated wind rush at driver door/B-pillar. Visual inspection showed seal not contacting uniformly at upper forward edge / mirror base gap excessive. Checked door striker alignment and hinge shims — adjusted to factory fit dimension. Replaced affected weatherstrip section. Secured loose trim pad with new clips. Retest with customer-present protocol if available — noise no longer present at legal highway speeds. Documented before/after fit measurements.',
  },
  {
    title: 'MBUX / CarPlay Update',
    category: 'warranty',
    tags: ['mbux', 'carplay', 'apple', 'software', 'update', 'connectivity'],
    complaint: 'Customer reports Apple CarPlay/Android Auto disconnects, will not connect, or MBUX connectivity issues.',
    cause:
      'Verified connectivity concern. XENTRY showed no hardware faults after Quick Test; software version out of date or corrupted connectivity module configuration. USB port/cable test confirmed port power/data within spec — root cause software/head unit application layer.',
    correction:
      'Applied latest MBUX/communication software update per TIPS/SCN bulletin. Reset user profiles and paired devices as directed. Cleared faults. Verified stable CarPlay/USB/Bluetooth connection on road test and bench check.',
    fullDetail:
      'Customer phone would not stay connected to CarPlay. Confirmed factory cable and multiple devices — issue repeatable. Quick Test — no hardware faults; head unit software below current field level. Performed online SCN/software update and connectivity patch. Cleared old pairings, re-paired iPhone — CarPlay launches and remains connected over bumps and during 10+ minute drive. Android Auto retested if equipped. Documented software version before/after.',
  },
  {
    title: 'Lean Condition / Injector Replacement',
    category: 'warranty',
    tags: ['lean', 'injector', 'fuel', 'P0171', 'P0174', 'misfire', 'direct-injection'],
    complaint: 'Customer reports check engine light on, rough idle, hesitation, or poor fuel economy.',
    cause:
      'Quick Test showed lean mixture codes (P0171/P0174) and/or cylinder misfire. Fuel pressure and injector balance testing identified weak/leaking direct injector causing lean condition.',
    correction:
      'Replaced failed fuel injector(s) and seals. Replaced spark plugs on affected bank if required. Cleared adaptations and performed injector coding/adaptation relearn. Final Quick Test — fuel trims normalized, no misfire. Road test — smooth idle and acceleration.',
    fullDetail:
      'Verified MIL and rough idle cold/hot. Quick Test lean codes plus misfire on cylinder X. Smoke/pressure test fuel system — injector on cylinder X failing balance test / dribbling. Removed intake, replaced injector O-rings and injector, torqued rail. New plugs installed due to fuel wash. Ran adaptation procedures for direct injection. Idle fuel trims returned to center. Road test — no hesitation, no codes reoccurring.',
  },
  {
    title: 'Auxiliary Coolant Pump Failure',
    category: 'warranty',
    tags: ['coolant-pump', 'auxiliary', 'overheat', 'hybrid', '48v', 'P0C2F'],
    complaint: 'Customer reports overheating message, coolant pump fault, or reduced power after driving.',
    cause:
      'Quick Test stored auxiliary coolant pump circuit faults. Commanded pump — no response/low flow. Pump motor internal failure confirmed.',
    correction:
      'Drained coolant as required. Replaced auxiliary coolant pump and seals/hoses as needed. Refilled and bled cooling system. Final Quick Test — pump operation normal, no faults. Road test — temperatures stable.',
    fullDetail:
      'Duplicated overheating warning after extended idle/AC use. Voltage maintained; Quick Test auxiliary pump circuit/open load faults. Commanded pump via actuation test — 0 flow. Replaced pump assembly, new O-rings, refilled with approved coolant, vacuum bleed. Verified pump command and coolant flow. Extended idle + drive — temp needle centered, no warnings.',
  },
  {
    title: 'Trunk Lid Latch Failure',
    category: 'warranty',
    tags: ['trunk', 'liftgate', 'latch', 'tailgate', 'will-not-close', 'power-trunk'],
    complaint: 'Customer reports trunk/liftgate will not latch, opens while driving, or power trunk inoperative.',
    cause:
      'Inspected latch and striker — latch mechanism binding or microswitch out of adjustment. Quick Test showed trunk/liftgate latch fault. Latch motor/solenoid failed internal switch test.',
    correction:
      'Replaced trunk/liftgate latch assembly. Adjusted striker alignment. Initialized power trunk if equipped. Verified manual and power closing — proper latch indication on instrument cluster.',
    fullDetail:
      'Customer could not secure trunk — latch would not capture striker. Quick Test latch switch plausibility faults. Removed trim, replaced latch, lubricated striker, adjusted striker position to spec. Power close soft-close recalibrated. Multiple open/close cycles — latch reports closed, no trunk ajar message while driving.',
  },
  {
    title: '48V Low Temperature Circuit Fault',
    category: 'warranty',
    tags: ['48v', 'mild-hybrid', 'EQ-Boost', 'battery', 'low-temperature', 'BMS'],
    complaint: 'Customer reports 48V system fault, stop/start disabled, or hybrid battery warning.',
    cause:
      'Quick Test showed 48V battery/mild hybrid system faults related to low temperature monitoring circuit. Guided test found wiring/sensor or 48V battery control module reporting implausible temperature.',
    correction:
      'Repaired harness/sensor as indicated or replaced 48V battery module/component per guided test. Cleared faults and performed 48V system relearn. Verification drive — stop/start and boost functions normal.',
    fullDetail:
      'Warning displayed at cold start. Quick Test 48V system faults (document codes). Inspected 48V battery harness and temp sensor — resistance out of spec / connector corrosion. Replaced sensor/harness section or 48V storage component per WIS. Updated software if bulletin applicable. Cleared faults — 48V available, stop/start operational after warm-up cycle. Road test confirmed no recurrence.',
  },
  {
    title: 'DC/DC Converter Fault',
    category: 'warranty',
    tags: ['dc-dc', 'converter', '48v', 'charging', 'system-fault', 'electrical'],
    complaint: 'Customer reports vehicle system fault, 12V/48V charging concern, or multiple electrical warnings.',
    cause:
      'Quick Test DC/DC converter output faults. Converter unable to maintain specified 12V supply from 48V system — internal module failure confirmed via guided test.',
    correction:
      'Replaced DC/DC converter module. Performed coding if required. Cleared faults — charging voltages normal on final Quick Test. Road test — no electrical warnings.',
    fullDetail:
      'Multiple cluster warnings after start. Measured 12V bus low under load. Quick Test DC/DC converter efficiency/output faults. Replaced converter per guided test, secured grounds. Post-repair voltage stable 13.8–14.2V charging. 48V/12V consumers tested — normal. Verification drive clean.',
  },
  {
    title: 'Display Freezing / Pixelation',
    category: 'warranty',
    tags: ['display', 'pixelation', 'screen', 'instrument-cluster', 'IC', 'freeze'],
    complaint: 'Customer reports instrument cluster or center display freezing, pixelated, or unresponsive.',
    cause:
      'Observed display artifacting/freeze during operation. Quick Test communication faults for instrument cluster/display control unit. Hardware failure — not corrected by software reset.',
    correction:
      'Replaced affected display/control unit. Coded to vehicle. Final Quick Test — communication normal. Verified all pixels/segments and touch functions on road test.',
    fullDetail:
      'Pixelation/freeze duplicated on bump and cold start. Hard reset temporary only. Quick Test display/CAN faults. Installed new cluster/IC or central display, transferred coding. Full pixel test pattern — no dead zones. Touch/menu functions verified. Road test — stable image.',
  },
  {
    title: 'Ease of Entry Malfunction',
    category: 'warranty',
    tags: ['ease-of-entry', 'airmatic', 'suspension', 'lower', 'raise', 'AIRMATIC'],
    complaint: 'Customer reports ease of entry feature not lowering vehicle or suspension fault message.',
    cause:
      'Quick Test Airmatic/ease-of-entry faults. System pressure or level sensor prevented lower position. Found valve block leak or level sensor/out-of-calibration preventing commanded drop.',
    correction:
      'Repaired/replaced faulty Airmatic component (valve block, strut, level sensor) per guided test. Performed suspension calibration. Ease of entry lowers on key off and raises on drive — verified.',
    fullDetail:
      'Ease of entry inactive — vehicle remained at highway height after shutdown. Quick Test level control faults. Pressure test revealed leak at valve block/strut. Replaced failed component, ran calibration and height adjustment. Confirmed drop when exiting and raise when starting — customer feature restored.',
  },
  {
    title: 'Oil Pump Control Valve (M264)',
    category: 'warranty',
    tags: ['oil-pump', 'M264', 'control-valve', 'oil-pressure', 'engine', 'timing'],
    complaint: 'Customer reports check engine light, oil pressure warning, or engine noise.',
    cause:
      'Quick Test oil pressure control/variable oil pump circuit faults on M264. Oil pressure below target at idle/hot — oil pump control solenoid/valve stuck or pump wear confirmed.',
    correction:
      'Replaced oil pump control valve and/or oil pump assembly per WIS. New seals and pickup tube O-ring as required. Cleared faults, verified oil pressure hot idle and 3000 RPM. Road test — no warnings.',
    fullDetail:
      'Verified oil pressure warning at hot idle. Quick Test M264 oil pump control faults. Mechanical gauge confirmed low pressure. Replaced control valve first per bulletin; if insufficient, replaced pump assembly. Fresh oil/filter. Pressure within spec hot/cold. Final Quick Test clean after 10-mile drive.',
  },
  {
    title: 'Front Differential Pinion Seal Leak',
    category: 'warranty',
    tags: ['differential', 'pinion-seal', 'leak', '4matic', 'AWD', 'fluid'],
    complaint: 'Customer reports fluid leak under vehicle or differential area wet with oil.',
    cause:
      'Inspected front differential — pinion seal leaking at yoke. Fluid level low on fill plug check. No abnormal differential noise on test drive.',
    correction:
      'Removed driveshaft, replaced pinion seal, torqued pinion nut to spec with new crush sleeve if required. Refilled with approved differential fluid. Road test — no leak, no noise.',
    fullDetail:
      'Lift inspection showed fresh fluid at front diff pinion area. Level low by 200ml. Road test — no whine. Replaced pinion seal using puller/installer, set preload per WIS. New fluid to overflow spec. Recheck after 10-mile drive — dry pinion area.',
  },
  {
    title: 'Intermittent CEL Software Update',
    category: 'warranty',
    tags: ['cel', 'software', 'update', 'ecu', 'powertrain', 'intermittent'],
    complaint: 'Customer reports check engine light on intermittently with no noticeable drivability change.',
    cause:
      'Quick Test stored powertrain software-related faults or implausible sensor readings corrected in later software. No failed hardware on guided tests.',
    correction:
      'Applied latest engine/ECU software update per TIPS bulletin. Cleared faults. Monitored readiness and fault status on road test — no MIL recurrence.',
    fullDetail:
      'MIL on with stored software plausibility codes. Hardware tests passed — ECM version outdated per bulletin. Online SCN update performed. Cleared codes, drive cycle completed — all monitors ready, no MIL on extended test drive.',
  },
  {
    title: 'MBUX Watchdog Fault',
    category: 'warranty',
    tags: ['mbux', 'watchdog', 'reset', 'head-unit', 'software', 'freeze'],
    complaint: 'Customer reports MBUX randomly reboots or displays system watchdog fault.',
    cause:
      'Quick Test infotainment watchdog/reset faults. Software corruption or head unit internal watchdog timer failure. Reset did not permanently resolve.',
    correction:
      'Reloaded software; if fault returned, replaced head unit. Coded and updated to latest version. Final Quick Test — no watchdog faults after extended operation test.',
    fullDetail:
      'Watchdog fault duplicated after 15 minutes operation. Quick Test logged watchdog resets. Full software reload attempted — fault returned. Replaced MBUX unit, latest software, coded VIN. Soak test 30+ minutes navigation/audio — no reboot.',
  },
  {
    title: 'Cold Dash Creak / Rattle',
    category: 'warranty',
    tags: ['rattle', 'creak', 'dash', 'NVH', 'cold', 'trim'],
    complaint: 'Customer reports dashboard creak/rattle over bumps when cold.',
    cause:
      'Cold soak road test reproduced dash creak at IP/passenger side. Found loose trim clip or rubbing contact between dash carrier and trim panel.',
    correction:
      'Added felt tape/shim at contact points, secured trim clips, torqued fasteners to spec. Cold start verification drive — no creak.',
    fullDetail:
      'Left vehicle cold overnight, reproduced creak at 5–15 MPH turns. Isolated clip at passenger end of IP. Added OEM anti-squeak tape, replaced broken clip, verified gap. Retest cold — quiet over same route.',
  },
  {
    title: 'Bus Keep-Awake Condition',
    category: 'warranty',
    tags: ['keep-awake', 'CAN', 'bus', 'battery-drain', 'control-unit', 'sleep'],
    complaint: 'Customer reports battery dead overnight or vehicle will not sleep / multiple warnings after sit.',
    cause:
      'Measured network sleep current — vehicle not entering rest mode. Quick Test showed control unit preventing bus sleep (keep-awake). Identified module via guided test/current draw.',
    correction:
      'Repaired wiring fault or replaced control unit preventing sleep. Verified quiescent current below specification after 30-minute shutdown. No keep-awake faults on final Quick Test.',
    fullDetail:
      'Customer jump-started twice. After shutdown, measured >200mA draw — bus awake. XENTRY keep-awake log pointed to specific door module/TCU/etc. (document actual). Replaced module or repaired short on CAN line. After 45 min lock — sleep current normal, starts strong next morning.',
  },
  {
    title: 'Rear Airmatic Strut Replacement',
    category: 'warranty',
    tags: ['airmatic', 'strut', 'rear', 'suspension', 'leak', 'AIRMATIC'],
    complaint: 'Customer reports vehicle sits low on one corner, suspension fault, or rough ride.',
    cause:
      'Quick Test Airmatic pressure/level faults. Visual inspection — rear strut leaking air. System unable to maintain rear corner height.',
    correction:
      'Replaced failed rear Airmatic strut. Performed suspension fill/bleed and calibration. Heights equalized — road test ride height stable.',
    fullDetail:
      'Rear sag on driver side after overnight sit. Quick Test level faults. Bubble test at rear strut — leak confirmed. Replaced strut, connected fill equipment, ran calibration. Heights within 4mm corner-to-corner. Drive test — no faults, normal ride.',
  },
  {
    title: 'RAMSES Telematics Replacement',
    category: 'warranty',
    tags: ['RAMSES', 'telematics', 'communication', 'Mercedes-me', 'TCU', 'antenna'],
    complaint: 'Customer reports Mercedes me connect inoperative, SOS/telematics fault, or communication error.',
    cause:
      'Quick Test RAMSES/telematics communication faults. Antenna/power checks OK — telematics control unit failed internal self-test.',
    correction:
      'Replaced RAMSES/telematics module. Coded and activated services. Final Quick Test — telematics online. Verified signal/connectivity indicators.',
    fullDetail:
      'Mercedes me not pairing; SOS error on cluster. Quick Test telematics offline faults. Power/antenna verified — module fails handshake. Installed new RAMSES unit, SCN coding, activation. Mercedes me registration successful, signal bars present.',
  },
  {
    title: 'Rear Shock Absorber Replacement',
    category: 'warranty',
    tags: ['shock', 'absorber', 'rear', 'suspension', 'bounce', 'leak'],
    complaint: 'Customer reports excessive bounce, rear instability, or fluid leak at rear shock.',
    cause:
      'Road test confirmed rear instability over bumps. Inspection found rear shock leaking/failed — no damping control.',
    correction:
      'Replaced rear shock absorbers (pair). Torqued fasteners to spec. Road test — stable rear damping, no leaks.',
    fullDetail:
      'Bounce test failed rear — continued oscillation. Wet shock body oil — both rear shocks weak. Replaced pair, new mounts if worn. Alignment check recommended — torque spec met. Road test highway and sharp bumps — controlled rebound.',
  },
  {
    title: 'Driveline Vibration Repair',
    category: 'warranty',
    tags: ['driveline', 'vibration', 'driveshaft', 'carrier-bearing', 'flex-disc', 'shudder'],
    complaint: 'Customer reports driveline vibration/shudder at highway speed or on acceleration.',
    cause:
      'Test drive reproduced vibration 45–65 MPH. Inspected flex disc, center bearing, and shaft alignment — worn flex disc or out-of-balance joint causing driveline vibration.',
    correction:
      'Replaced flex disc/center bearing/driveshaft section as required. Balanced assembly per spec. Road test — vibration eliminated.',
    fullDetail:
      'Vibration duplicated light throttle 55 MPH. Lifted — flex disc cracked, play in center bearing. Replaced disc and bearing, checked flange runout. Road test multiple speeds — smooth. No shudder on hard acceleration.',
  },
];

export function toTemplateContent(seed: StoryTemplateSeed): string {
  return buildCleanTemplate(seed);
}

export function toKnowledgeBaseFields(seed: StoryTemplateSeed) {
  const cleanTemplate = buildCleanTemplate(seed);
  return {
    title: seed.title,
    category: seed.category,
    fullOriginalText: buildFullOriginal(seed),
    cleanTemplate,
    tags: JSON.stringify(seed.tags),
  };
}