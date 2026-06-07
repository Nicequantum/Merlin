export interface ExtractedData {
  codes: string[];
  guidedTests: string[];
  measurements: Array<{ label: string; value: string }>;
  components: string[];
  circuits: string[];
}

export interface ImageAttachment {
  id: string;
  dataUrl: string;
  name: string;
}

export interface RepairLine {
  id: string;
  lineNumber: number;
  description: string;
  customerConcern: string;
  technicianNotes: string;
  xentryImages: ImageAttachment[];
  xentryOcrTexts?: string[];
  extractedData?: ExtractedData;
  warrantyStory?: string;
}

export interface VehicleInfo {
  vin: string;
  year: string;
  make: string;
  model: string;
  engine?: string;
  mileageIn: string;
  mileageOut: string;
}

export interface RepairOrder {
  id: string;
  roNumber: string;
  vehicle: VehicleInfo;
  customer: {
    name: string;
  };
  complaints: string[];
  xentryImages?: ImageAttachment[];
  xentryOcrTexts?: string[];
  repairLines: RepairLine[];
  createdAt?: string;
  technicianId?: string;
  technicianName?: string;
}

export type AppView = 'home' | 'ro' | 'line' | 'settings';

export interface StructuredROExtraction {
  vehicle: VehicleInfo;
  complaints: string[];
  customerName: string;
  roNumber: string;
}

export interface MercedesSuggestions {
  issues: string[];
  tests: Array<{ label: string; spec: string; note?: string }>;
  bandNote: string;
}

export interface TechnicianSession {
  technicianId: string;
  email: string;
  name: string;
  role: string;
  dealershipId: string;
  dealershipName: string;
  consentAt: string | null;
}

export const CONSENT_VERSION = '2026-06-07-v1';
export const WARRANTY_STORY_MAX_CHARS = 2500;
export const WARRANTY_STORY_WARN_CHARS = 2200;