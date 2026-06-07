import { createHash } from 'crypto';

export const AUDIT_GENESIS_HASH = 'GENESIS';

export interface AuditChainPayload {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  technicianId: string | null;
  dealershipId: string;
  metadata: string;
  ipAddress: string | null;
  createdAt: string;
  previousHash: string;
}

export function computeAuditEntryHash(payload: AuditChainPayload): string {
  const canonical = JSON.stringify({
    id: payload.id,
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId,
    technicianId: payload.technicianId,
    dealershipId: payload.dealershipId,
    metadata: payload.metadata,
    ipAddress: payload.ipAddress,
    createdAt: payload.createdAt,
    previousHash: payload.previousHash,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function verifyAuditChain(
  entries: Array<{ previousHash: string; entryHash: string } & AuditChainPayload>
): { valid: boolean; brokenAt: number | null } {
  let expectedPrevious = AUDIT_GENESIS_HASH;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.previousHash !== expectedPrevious) {
      return { valid: false, brokenAt: i };
    }
    const recomputed = computeAuditEntryHash(entry);
    if (recomputed !== entry.entryHash) {
      return { valid: false, brokenAt: i };
    }
    expectedPrevious = entry.entryHash;
  }

  return { valid: true, brokenAt: null };
}