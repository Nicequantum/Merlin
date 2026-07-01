import { ApiError } from '@/lib/api';
import { GENERIC_ERROR } from '@/lib/errors';

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