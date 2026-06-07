import type { ExtractedData, ImageAttachment, RepairLine, RepairOrder } from '@/types';
import type { RepairLine as DbLine, RepairOrder as DbRO } from '@prisma/client';
import { decryptPII, encryptPII } from './encryption';

function parseJson<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function dbToRepairOrder(ro: DbRO & { repairLines: DbLine[] }): RepairOrder {
  return {
    id: ro.id,
    roNumber: ro.roNumber,
    vehicle: {
      vin: ro.vin,
      year: ro.year,
      make: ro.make,
      model: ro.model,
      engine: ro.engine,
      mileageIn: ro.mileageIn,
      mileageOut: ro.mileageOut,
    },
    customer: { name: decryptPII(ro.customerNameEncrypted) },
    complaints: parseJson<string[]>(ro.complaints, []),
    xentryImages: parseJson<ImageAttachment[]>(ro.xentryImages, []),
    xentryOcrTexts: parseJson<string[]>(ro.xentryOcrTexts, []),
    repairLines: ro.repairLines
      .sort((a, b) => a.lineNumber - b.lineNumber)
      .map(dbToRepairLine),
    createdAt: ro.createdAt.toISOString(),
    technicianId: ro.technicianId,
    technicianName: undefined,
  };
}

export function dbToRepairLine(line: DbLine): RepairLine {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    description: line.description,
    customerConcern: line.customerConcern,
    technicianNotes: line.technicianNotes,
    xentryImages: parseJson<ImageAttachment[]>(line.xentryImages, []),
    xentryOcrTexts: parseJson<string[]>(line.xentryOcrTexts, []),
    extractedData: parseJson<ExtractedData>(line.extractedData, {
      codes: [],
      guidedTests: [],
      measurements: [],
      components: [],
      circuits: [],
    }),
    warrantyStory: line.warrantyStory ?? undefined,
  };
}

export interface RepairOrderInput {
  roNumber: string;
  vehicle: {
    vin: string;
    year: string;
    make: string;
    model: string;
    engine?: string;
    mileageIn: string;
    mileageOut: string;
  };
  customer: { name: string };
  complaints: string[];
  xentryImages?: ImageAttachment[];
  xentryOcrTexts?: string[];
  repairLines: RepairLine[];
}

export function repairOrderToDbFields(input: RepairOrderInput) {
  return {
    roNumber: input.roNumber,
    vin: input.vehicle.vin,
    year: input.vehicle.year,
    make: input.vehicle.make,
    model: input.vehicle.model,
    engine: input.vehicle.engine || '',
    mileageIn: input.vehicle.mileageIn,
    mileageOut: input.vehicle.mileageOut,
    customerNameEncrypted: encryptPII(input.customer.name),
    complaints: JSON.stringify(input.complaints),
    xentryImages: JSON.stringify(input.xentryImages || []),
    xentryOcrTexts: JSON.stringify(input.xentryOcrTexts || []),
  };
}

export function repairLineToDbFields(line: RepairLine) {
  return {
    lineNumber: line.lineNumber,
    description: line.description,
    customerConcern: line.customerConcern,
    technicianNotes: line.technicianNotes,
    xentryImages: JSON.stringify(line.xentryImages || []),
    xentryOcrTexts: JSON.stringify(line.xentryOcrTexts || []),
    extractedData: JSON.stringify(line.extractedData || {}),
    warrantyStory: line.warrantyStory ?? null,
  };
}