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