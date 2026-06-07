import type { ExtractedData } from '../types';

export function parseDiagnosticText(text: string): Partial<ExtractedData> {
  const upper = text.toUpperCase();
  const codes = Array.from(upper.matchAll(/\b([PBCU]\d{4}(?:[-–]\d{3})?)\b/g)).map((m) => m[1]);
  const guidedTests = Array.from(text.matchAll(/Guided Test[:\s-]*(.+?)(?=\n|Test|$)/gi))
    .map((m) => m[1].trim())
    .filter((t) => t.length > 3);
  const measurements = Array.from(
    text.matchAll(/([A-Za-z0-9\s\/]+?)\s*[:=]\s*([\d.]+\s*(?:V|VOLTS|PSI|BAR|OHM|kOHM|mA|°C|°F|bar|kpa)?)/gi)
  )
    .map((m) => ({ label: m[1].trim(), value: m[2].trim() }))
    .slice(0, 8);
  const components = Array.from(upper.matchAll(/\b([A-Z]\d{1,2}\/\d{1,2}[A-Z]?(?:Y\d)?)\b/g)).map((m) => m[1]);
  const circuits = Array.from(text.matchAll(/pin\s*(\d+\.?\d*)|circuit\s*(\d+[A-Z]?)/gi)).map((m) => m[0].trim());
  return { codes, guidedTests, measurements, components, circuits };
}

export function mergeExtracted(base: ExtractedData, add: Partial<ExtractedData>): ExtractedData {
  return {
    codes: [...new Set([...(base.codes || []), ...(add.codes || [])])],
    guidedTests: [...new Set([...(base.guidedTests || []), ...(add.guidedTests || [])])],
    measurements: [...(base.measurements || []), ...(add.measurements || [])].slice(0, 8),
    components: [...new Set([...(base.components || []), ...(add.components || [])])],
    circuits: [...new Set([...(base.circuits || []), ...(add.circuits || [])])],
  };
}

export function emptyExtractedData(): ExtractedData {
  return { codes: [], guidedTests: [], measurements: [], components: [], circuits: [] };
}