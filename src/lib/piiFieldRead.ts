import { decryptPII, decryptSensitiveText } from '@/lib/encryption';

type RoNumberRow = {
  roNumber: string;
  roNumberEncrypted?: string | null;
};

type DescriptionRow = {
  description: string;
  descriptionEncrypted?: string | null;
};

type AdvisorDisplayNameRow = {
  displayName: string;
  displayNameEncrypted?: string | null;
};

/** Phase 3: encrypted-first RO number read with legacy plaintext fallback during migration. */
export function readRoNumberFromDb(row: RoNumberRow): string {
  const encrypted = row.roNumberEncrypted?.trim();
  if (encrypted) {
    try {
      const decrypted = decryptPII(encrypted);
      if (decrypted) return decrypted;
    } catch {
      // Fall through to legacy plaintext during migration window.
    }
  }
  return row.roNumber?.trim() || '';
}

/** Phase 3: encrypted-first line description read with legacy plaintext fallback. */
export function readDescriptionFromDb(row: DescriptionRow): string {
  const encrypted = row.descriptionEncrypted?.trim();
  if (encrypted) {
    try {
      const decrypted = decryptSensitiveText(encrypted);
      if (decrypted) return decrypted;
    } catch {
      // Fall through to legacy plaintext during migration window.
    }
  }
  return row.description?.trim() || '';
}

/** Phase 3: encrypted-first advisor display name read with legacy plaintext fallback. */
export function readAdvisorDisplayNameFromDb(row: AdvisorDisplayNameRow): string {
  const encrypted = row.displayNameEncrypted?.trim();
  if (encrypted) {
    try {
      const decrypted = decryptPII(encrypted);
      if (decrypted) return decrypted;
    } catch {
      // Fall through to legacy plaintext during migration window.
    }
  }
  return row.displayName?.trim() || '';
}