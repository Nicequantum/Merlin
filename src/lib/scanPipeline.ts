import { ApiError } from '@/lib/api';
import { GENERIC_ERROR } from '@/lib/errors';
import { CUSTOMER_PAY_TEMPLATES } from '@/prompts/templates/customerPayTemplates';
import type { RepairLine, StructuredROExtraction } from '@/types';

/** Technician-facing message from a failed scan/extract API call — always prefer server text. */
export function formatScanApiError(error: unknown, fallback?: string): string {
  if (error instanceof ApiError) {
    const msg = error.message?.trim();
    if (msg) {
      if (msg === GENERIC_ERROR) {
        return `Scan failed (HTTP ${error.status}): ${msg}`;
      }
      return msg;
    }
    return fallback
      ? `${fallback} (HTTP ${error.status})`
      : `Scan request failed (HTTP ${error.status}).`;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  return fallback ?? 'Scan failed — no error details returned from server.';
}

export function isRetriableScanMessage(message: string): boolean {
  return /timed out|busy|unavailable|try again/i.test(message);
}

/** Grok returned enough structured data — skip waiting for slow on-device OCR. */
export function isStrongGrokExtraction(grok: StructuredROExtraction | null): boolean {
  if (!grok) return false;
  return assessRoExtractionQuality(grok).extractionStrength === 'strong';
}

export type RoExtractionStrength = 'strong' | 'partial' | 'weak';

export interface RoExtractionQualitySignals {
  extractionStrength: RoExtractionStrength;
  complaintCount: number;
  complaintLabelCount: number;
  hasRoNumber: boolean;
  hasVin17: boolean;
  hasVehicleIdentity: boolean;
}

/** PII-free quality signals for ro.extract audit metadata and scan telemetry. */
export function assessRoExtractionQuality(extracted: StructuredROExtraction): RoExtractionQualitySignals {
  const complaints = extracted.complaints?.filter((line) => line?.trim()) ?? [];
  const complaintCount = complaints.length;
  const complaintLabelCount = extracted.complaintLabels?.filter((l) => l?.trim()).length ?? 0;
  const hasRoNumber = Boolean(extracted.roNumber?.trim());
  const hasVin17 = (extracted.vehicle?.vin?.trim() ?? '').length === 17;
  const hasVehicleIdentity = Boolean(
    extracted.vehicle?.year?.trim() && extracted.vehicle?.make?.trim()
  );

  let extractionStrength: RoExtractionStrength = 'weak';
  if (complaintCount > 0 || (hasRoNumber && hasVin17)) {
    extractionStrength = 'strong';
  } else if (complaintCount > 0 || hasRoNumber || hasVin17 || hasVehicleIdentity) {
    extractionStrength = 'partial';
  }

  return {
    extractionStrength,
    complaintCount,
    complaintLabelCount,
    hasRoNumber,
    hasVin17,
    hasVehicleIdentity,
  };
}

// ---------------------------------------------------------------------------
// Legacy B-service filter + Customer Pay scan template matching
// ---------------------------------------------------------------------------

export interface ScannedServiceLine {
  code: string;
  text: string;
}

export interface CustomerPayScanTemplateMatch {
  templateTitle: string;
  preWrittenStory: string;
}

function normalizeScanMatchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Legacy B-service filter — scanned RO service lines pass through for narrative work.
 *
 * Prior behavior skipped every line whose service code was B:
 *   if (code === 'B') continue;
 *
 * B services are now processed normally so warranty narratives can be written for B-line
 * repairs (e.g. multi-line ROs where B is a legitimate customer concern, not mislabeled
 * inspection detail).
 */
export function filterLegacyScannedServiceLines<T extends ScannedServiceLine>(lines: T[]): T[] {
  const kept: T[] = [];
  for (const line of lines) {
    // Legacy: if (line.code === 'B') continue;
    // B-service lines are retained for warranty narrative support.
    kept.push(line);
  }
  return kept;
}

/** Pair complaints with letter codes, applying the legacy B-service filter policy. */
export function filterScannedComplaintsForProcessing(
  complaints: string[],
  complaintLabels?: string[]
): { complaints: string[]; complaintLabels: string[] } {
  const labels =
    complaintLabels?.length === complaints.length
      ? complaintLabels
      : complaints.map((_, index) => String.fromCharCode(65 + index));

  const serviceLines = filterLegacyScannedServiceLines(
    complaints.map((text, index) => ({ code: labels[index] ?? '', text: text ?? '' }))
  );

  return {
    complaints: serviceLines.map((line) => line.text),
    complaintLabels: serviceLines.map((line) => line.code),
  };
}

function scoreCustomerPayTemplateMatch(scanText: string, templateTitle: string): number {
  const normalized = normalizeScanMatchText(scanText);
  if (normalized.length < 6) return 0;

  const titleNorm = normalizeScanMatchText(templateTitle);
  if (normalized.includes(titleNorm)) return 1000 + titleNorm.length;

  const titleTokens = titleNorm.split(' ').filter((token) => token.length > 2);
  if (titleTokens.length === 0) return 0;

  const matchedTokens = titleTokens.filter((token) => normalized.includes(token));
  if (matchedTokens.length === 0) return 0;

  const coverage = matchedTokens.length / titleTokens.length;
  if (coverage < 0.66) return 0;

  // Guardrail: disambiguate front vs rear brake templates on partial matches.
  if (titleNorm.includes('front brake') && normalized.includes('rear') && !normalized.includes('front')) {
    return 0;
  }
  if (titleNorm.includes('rear brake') && normalized.includes('front') && !normalized.includes('rear')) {
    return 0;
  }
  if (titleNorm.includes('mercedes benz brake fluid') && !/(mercedes|benz|mb)\b/.test(normalized)) {
    return 0;
  }
  if (titleNorm.includes('standard brake fluid') && /(mercedes|benz|mb)\b/.test(normalized)) {
    return 0;
  }
  if (titleNorm.includes('auxiliary battery') && normalized.includes('main') && !normalized.includes('auxiliary')) {
    return 0;
  }
  if (titleNorm.includes('main battery') && normalized.includes('auxiliary') && !normalized.includes('main')) {
    return 0;
  }

  return Math.round(matchedTokens.reduce((sum, token) => sum + token.length, 0) * coverage);
}

/** Match a scanned line to a defined Customer Pay template, if any. */
export function matchCustomerPayTemplateFromScanText(scanText: string): CustomerPayScanTemplateMatch | null {
  const trimmed = scanText?.trim() ?? '';
  if (trimmed.length < 6) return null;

  let best: CustomerPayScanTemplateMatch | null = null;
  let bestScore = 0;

  for (const template of CUSTOMER_PAY_TEMPLATES) {
    const score = scoreCustomerPayTemplateMatch(trimmed, template.title);
    if (score > bestScore) {
      bestScore = score;
      best = { templateTitle: template.title, preWrittenStory: template.preWrittenStory };
    }
  }

  return bestScore >= 8 ? best : null;
}

/**
 * Apply Customer Pay pre-written narratives to scanned repair lines when scan text matches
 * a defined template. Warranty lines without a match are unchanged; existing stories are never
 * overwritten.
 */
export function enrichScannedRepairLinesWithCustomerPayTemplates(
  repairLines: RepairLine[],
  complaints: string[],
  complaintLabels?: string[]
): RepairLine[] {
  const { complaints: filteredComplaints } = filterScannedComplaintsForProcessing(
    complaints,
    complaintLabels
  );

  return repairLines.map((line, index) => {
    if (line.isCustomerPay || line.warrantyStory?.trim()) return line;

    const scanText = [filteredComplaints[index], line.customerConcern, line.description]
      .filter(Boolean)
      .join(' ');

    const match = matchCustomerPayTemplateFromScanText(scanText);
    if (!match) return line;

    return {
      ...line,
      warrantyStory: match.preWrittenStory,
      isCustomerPay: true,
    };
  });
}