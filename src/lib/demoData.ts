import type { RepairOrderInput } from './roMapper';

/** Synthetic VINs and customer data for demos — not real vehicles or people. */
export function buildDemoRepairOrders(): RepairOrderInput[] {
  return [
    {
      roNumber: 'DEMO-48291',
      vehicle: {
        vin: 'WDDWF4KB0FR123456',
        year: '2018',
        make: 'Mercedes-Benz',
        model: 'C300 4MATIC',
        engine: '2.0L 4-cyl',
        mileageIn: '68420',
        mileageOut: '68425',
      },
      customer: { name: 'Demo Customer A' },
      complaints: [
        'A: Check engine light on — rough idle at cold start',
        'B: Intermittent hesitation during light acceleration',
      ],
      xentryOcrTexts: [
        'Quick Test — Fault memory\nP0300 — Misfire detected\nP0302 — Cylinder 2 misfire',
      ],
      repairLines: [
        {
          id: 'demo-line-1',
          lineNumber: 1,
          description: 'Diagnose misfire — cylinder 2',
          customerConcern: 'Check engine light on — rough idle at cold start',
          technicianNotes:
            'Connected XENTRY. Quick Test found P0300 and P0302. Swapped coil 2 to cylinder 3 — misfire followed. Replaced ignition coil cylinder 2. Cleared faults.',
          xentryImages: [],
          xentryOcrTexts: ['Guided test: ignition coil swap — fault moved to cyl 3'],
          extractedData: {
            codes: ['P0300', 'P0302'],
            guidedTests: ['Ignition coil swap — misfire followed coil'],
            measurements: [],
            components: ['Ignition coil cylinder 2'],
            circuits: [],
          },
          warrantyStory:
            'Customer Complaint: Customer reported check engine light illuminated with rough idle at cold start (complaint A).\n\nCause: Diagnostic evaluation documented P0300 and P0302. Ignition coil swap test confirmed misfire followed the coil to cylinder 3, supporting ignition coil failure on cylinder 2.\n\nCorrection: Replaced ignition coil on cylinder 2 per documented findings. Cleared fault memory after repair.',
        },
        {
          id: 'demo-line-2',
          lineNumber: 2,
          description: 'Verify repair — road test',
          customerConcern: 'Intermittent hesitation during light acceleration',
          technicianNotes: 'Verification drive performed. No misfire symptoms observed post-repair.',
          xentryImages: [],
          xentryOcrTexts: [],
          extractedData: { codes: [], guidedTests: [], measurements: [], components: [], circuits: [] },
        },
      ],
    },
    {
      roNumber: 'DEMO-48305',
      vehicle: {
        vin: 'W1KZF8DB5LA987654',
        year: '2020',
        make: 'Mercedes-Benz',
        model: 'E350',
        engine: '3.0L 6-cyl',
        mileageIn: '42110',
        mileageOut: '42115',
      },
      customer: { name: 'Demo Customer B' },
      complaints: ['A: 12V battery warning message on cluster'],
      xentryOcrTexts: ['Battery test: 410 CCA measured / 850 CCA rated — REPLACE'],
      repairLines: [
        {
          id: 'demo-line-3',
          lineNumber: 1,
          description: 'Replace 12V battery',
          customerConcern: '12V battery warning message on cluster',
          technicianNotes:
            'Battery load test failed per shop tester. Replaced AGM battery. Registered battery with XENTRY. No additional faults stored.',
          xentryOcrTexts: ['Battery registration completed'],
          extractedData: {
            codes: [],
            guidedTests: ['Battery load test — failed'],
            measurements: [{ label: 'CCA measured', value: '410' }],
            components: ['AGM 12V battery'],
            circuits: [],
          },
          xentryImages: [],
          warrantyStory:
            'Customer Complaint: Customer reported 12V battery warning on instrument cluster (complaint A).\n\nCause: Battery load test documented 410 CCA measured versus rated capacity, supporting battery replacement.\n\nCorrection: Replaced AGM 12V battery and registered replacement per documented procedure.',
        },
      ],
    },
    {
      roNumber: 'DEMO-48318',
      vehicle: {
        vin: 'WDC0G4KB5KV555001',
        year: '2019',
        make: 'Mercedes-Benz',
        model: 'GLC300',
        engine: '2.0L 4-cyl',
        mileageIn: '55200',
        mileageOut: '',
      },
      customer: { name: 'Demo Customer C' },
      complaints: ['A: Wind noise from driver door at highway speed'],
      repairLines: [
        {
          id: 'demo-line-4',
          lineNumber: 1,
          description: 'Inspect door seal — wind noise',
          customerConcern: 'Wind noise from driver door at highway speed',
          technicianNotes: 'Visual inspection of door seal in progress. [NOT DOCUMENTED] — final verification drive.',
          xentryImages: [],
          xentryOcrTexts: [],
          extractedData: { codes: [], guidedTests: [], measurements: [], components: [], circuits: [] },
        },
      ],
    },
  ];
}