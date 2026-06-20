import type { MercedesSuggestions, RepairOrder, VehicleInfo } from '../types';
import { inferVehicleFamily } from '@/lib/advisorIntelligence/nameUtils';

const MERCEDES_KB: Record<
  string,
  {
    families: string[];
    mileageBands: Array<{
      min: number;
      max: number;
      commonIssues: string[];
      standardTests: Array<{ label: string; spec: string; note?: string }>;
    }>;
  }
> = {
  GLE: {
    families: ['GLE', 'GLS', 'GLC'],
    mileageBands: [
      {
        min: 0,
        max: 30000,
        commonIssues: ['Software updates / SCN coding', 'Battery / IBS issues', 'Sensor faults (TPMS, radar)'],
        standardTests: [
          { label: 'Battery voltage (resting)', spec: '12.6-12.8 V', note: 'Charger connected during diag' },
          { label: 'Fuel rail pressure idle (M256/M177)', spec: '200-280 bar' },
        ],
      },
      {
        min: 30001,
        max: 75000,
        commonIssues: [
          'High pressure fuel injectors (lean codes P0171/P0174)',
          'Turbo actuator / boost leaks',
          'ABC or Airmatic suspension leaks',
          'Crankshaft position sensor',
        ],
        standardTests: [
          { label: 'Fuel rail pressure idle', spec: '200-250 bar' },
          { label: 'Leak-off rate (injectors)', spec: '< 2 ml / 30s per cyl per XENTRY' },
          { label: 'Rail pressure under load', spec: 'up to 2000+ bar stable' },
          { label: 'Injector adaptation ZGSTH', spec: 'typically ±1.0% max recommended' },
        ],
      },
      {
        min: 75001,
        max: 150000,
        commonIssues: [
          'Injector failure / carbon',
          'Timing chain stretch (some M276)',
          'Transmission conductor plate / valve body',
          'EGR cooler / AdBlue',
        ],
        standardTests: [
          { label: 'Compression test', spec: 'per XENTRY spec ~12-15 bar' },
          { label: 'Chain stretch measurement', spec: 'see XENTRY guided' },
        ],
      },
    ],
  },
  S: {
    families: ['S', 'Maybach'],
    mileageBands: [
      {
        min: 0,
        max: 40000,
        commonIssues: ['Active Body Control (ABC) leaks', 'Distronic radar alignment', 'Magic Body Control sensor'],
        standardTests: [{ label: 'ABC pressure', spec: '~180-200 bar system' }],
      },
      {
        min: 40001,
        max: 90000,
        commonIssues: [
          'Injectors / fuel trim issues on M256',
          'Air suspension compressor',
          'Wiring harness chafing (doors, trunk)',
        ],
        standardTests: [
          { label: 'Fuel pressure', spec: '200-250 bar idle' },
          { label: 'Battery + IBS', spec: '>12.4V resting, check quiescent current <50mA' },
        ],
      },
    ],
  },
  E: {
    families: ['E', 'CLS'],
    mileageBands: [
      {
        min: 25000,
        max: 80000,
        commonIssues: ['M264/M256 injector / HPFP issues', 'Balance shaft / chain', 'Electrical consumers drain'],
        standardTests: [
          { label: 'HP fuel pressure', spec: '200-280 bar' },
          { label: 'Lambda / fuel trims', spec: 'fra/fra2 near 1.0 ±0.03' },
        ],
      },
    ],
  },
  C: {
    families: ['C', 'CLA', 'GLA'],
    mileageBands: [
      {
        min: 20000,
        max: 70000,
        commonIssues: ['M264 timing chain / balance', 'Turbo wastegate rattle', '7G/9G conductor plate'],
        standardTests: [{ label: 'Oil pressure', spec: 'per spec ~2.5-4.5 bar hot' }],
      },
    ],
  },
  default: {
    families: [],
    mileageBands: [
      {
        min: 0,
        max: 999999,
        commonIssues: ['Battery/charging system', 'Sensor faults', 'Software adaptations drift'],
        standardTests: [
          { label: 'Battery resting voltage', spec: '12.6 V+' },
          { label: 'Guided test values', spec: 'follow XENTRY exactly' },
        ],
      },
    ],
  },
};

const INFERRED_FAMILY_TO_KB_KEY: Record<string, string> = {
  GLE: 'GLE',
  GLS: 'GLE',
  GLC: 'GLE',
  GLA: 'C',
  'C-Class': 'C',
  'E-Class': 'E',
  'S-Class': 'S',
  Maybach: 'S',
};

const ENGINE_MODEL_TO_KB_KEY: Array<{ pattern: RegExp; key: string }> = [
  { pattern: /\bM260\b|\bM282\b/, key: 'C' },
  { pattern: /\bM264\b/, key: 'C' },
  { pattern: /\bM256\b|\bM278\b|\bM177\b/, key: 'S' },
  { pattern: /\bM276\b/, key: 'GLE' },
];

function buildVehicleDescriptor(vehicle: VehicleInfo): string {
  return [vehicle.make, vehicle.model, vehicle.engine, vehicle.vin].filter(Boolean).join(' ').toUpperCase();
}

function resolveKbKeyFromEngine(engine: string | undefined): string | null {
  const engineUpper = (engine || '').toUpperCase();
  if (!engineUpper) return null;
  for (const { pattern, key } of ENGINE_MODEL_TO_KB_KEY) {
    if (pattern.test(engineUpper)) return key;
  }
  return null;
}

function resolveKbKeyFromFamilies(descriptor: string): string | null {
  for (const [key, val] of Object.entries(MERCEDES_KB)) {
    if (key === 'default') continue;
    for (const family of val.families) {
      if (new RegExp(`\\b${family}\\b`).test(descriptor)) return key;
    }
    if (new RegExp(`\\b${key}\\b`).test(descriptor)) return key;
  }
  return null;
}

/** Resolve Mercedes knowledge-base family from decoded vehicle fields (not naive substring matching). */
export function resolveMercedesKbKey(vehicle: VehicleInfo): { key: string; label: string } {
  const descriptor = buildVehicleDescriptor(vehicle);
  const inferred = inferVehicleFamily(vehicle.make || '', vehicle.model || '');
  if (inferred && INFERRED_FAMILY_TO_KB_KEY[inferred]) {
    return { key: INFERRED_FAMILY_TO_KB_KEY[inferred], label: inferred };
  }

  const fromFamilies = resolveKbKeyFromFamilies(descriptor);
  if (fromFamilies) {
    return { key: fromFamilies, label: fromFamilies };
  }

  const fromEngine = resolveKbKeyFromEngine(vehicle.engine);
  if (fromEngine) {
    return { key: fromEngine, label: vehicle.engine?.match(/\bM\d{3}\b/i)?.[0]?.toUpperCase() || fromEngine };
  }

  return { key: 'default', label: 'Mercedes-Benz (unspecified model)' };
}

export function getSuggestions(ro: RepairOrder): MercedesSuggestions {
  const miles = parseInt(ro.vehicle.mileageIn || '0', 10) || 0;
  const { key: famKey, label: familyLabel } = resolveMercedesKbKey(ro.vehicle);
  const kb = MERCEDES_KB[famKey] ?? MERCEDES_KB.default;

  let band = kb.mileageBands[kb.mileageBands.length - 1];
  for (const b of kb.mileageBands) {
    if (miles >= b.min && miles <= b.max) {
      band = b;
      break;
    }
  }

  const yearPart = ro.vehicle.year ? `${ro.vehicle.year} ` : '';
  const milesPart = miles ? `${miles.toLocaleString()} mi` : 'mileage unknown';
  const bandNote = `${yearPart}${familyLabel} • ${milesPart}`;
  return { issues: band.commonIssues, tests: band.standardTests, bandNote };
}