/**
 * S2 — Backfill encrypted columns for dual-storage PII fields.
 *
 * SAFETY (non-breaking by design):
 *   • Writes ONLY to *Encrypted columns (roNumberEncrypted, descriptionEncrypted,
 *     displayNameEncrypted, serviceAdvisorNameEncrypted).
 *   • Plaintext columns (roNumber, description, displayName) are NEVER modified or removed.
 *   • Application search, reads, and UI continue using existing dual-storage paths unchanged.
 *   • Idempotent: already-encrypted rows are skipped; safe to re-run until pending = 0.
 *
 * ROLLBACK (one command):
 *   Restore the pre-migration database backup. This script does not delete data.
 *   Do NOT rotate ENCRYPTION_KEY without a planned key-migration procedure.
 *
 * RECOMMENDED WORKFLOW (production):
 *   1. npm run db:migrate-pii-safe     # dry-run first — preview counts, zero writes
 *   2. npm run db:migrate-pii            # execute backfill (batched)
 *   3. Re-run step 2 until pendingAfterRun is 0
 *   4. Spot-check RO/advisor in UI; npm run validate:pre-rollout
 *
 * Usage:
 *   npm run db:migrate-pii-safe          # dry-run (preferred entry point)
 *   npm run db:migrate-pii               # execute backfill
 *   DRY_RUN=true npm run db:migrate-pii  # dry-run via env (Unix shells)
 *   npx tsx scripts/migrate-pii-to-encrypted.ts --dry-run
 *   REENCRYPT_BATCH_SIZE=50 npm run db:migrate-pii
 *
 * Requires: DATABASE_URL and ENCRYPTION_KEY (min 32 chars).
 *
 * See prisma/schema.prisma "PII PLAINTEXT MIGRATION PLAN" for phased cutover.
 */
import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'node:url';
import {
  isLikelyEncryptedPayload,
  migratePlaintextToEncrypted,
} from '../src/lib/encryption';

const prisma = new PrismaClient();

const BATCH_SIZE = Math.max(10, Number(process.env.REENCRYPT_BATCH_SIZE ?? 100));
const DRY_RUN =
  process.argv.includes('--dry-run') ||
  ['1', 'true', 'yes'].includes((process.env.DRY_RUN ?? '').toLowerCase());

export interface MigrationStats {
  scanned: number;
  updated: number;
  skipped: number;
}

export interface S2MigrationResults {
  dryRun: boolean;
  batchSize: number;
  pendingBeforeRun: {
    repairOrders: number;
    repairLines: number;
    serviceAdvisors: number;
  };
  repairOrders: MigrationStats;
  repairLines: MigrationStats;
  serviceAdvisors: MigrationStats;
  pendingAfterRun: {
    repairOrders: number;
    repairLines: number;
    serviceAdvisors: number;
  };
}

function resolveEncryptedFromDualStorage(encrypted: string, plaintext: string): string | null {
  const source = encrypted?.trim() ? encrypted : plaintext;
  if (!source?.trim()) return null;
  // Idempotent: migratePlaintextToEncrypted returns input unchanged when already encrypted.
  const next = migratePlaintextToEncrypted(source);
  if (!next || next === encrypted) return null;
  return next;
}

function logBatch(table: string, batch: number, stats: MigrationStats): void {
  console.log(
    `[migrate-pii] ${table} batch ${batch}: scanned=${stats.scanned} updated=${stats.updated} skipped=${stats.skipped}${
      DRY_RUN ? ' (dry-run)' : ''
    }`
  );
}

export async function migrateRepairOrdersS2(): Promise<MigrationStats> {
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;
  let batch = 0;

  for (;;) {
    const rows = await prisma.repairOrder.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        roNumber: true,
        roNumberEncrypted: true,
        serviceAdvisorNameEncrypted: true,
      },
    });
    if (rows.length === 0) break;
    batch += 1;
    cursor = rows[rows.length - 1]?.id;

    let batchUpdated = 0;
    let batchSkipped = 0;

    for (const row of rows) {
      scanned += 1;
      const data: Record<string, string> = {};

      const roNumberEnc = resolveEncryptedFromDualStorage(row.roNumberEncrypted, row.roNumber);
      if (roNumberEnc) data.roNumberEncrypted = roNumberEnc;

      // serviceAdvisorNameEncrypted has no plaintext twin column — only re-encrypt if stored as legacy plaintext.
      if (row.serviceAdvisorNameEncrypted?.trim()) {
        const advisorEnc = migratePlaintextToEncrypted(row.serviceAdvisorNameEncrypted);
        if (advisorEnc !== row.serviceAdvisorNameEncrypted) {
          data.serviceAdvisorNameEncrypted = advisorEnc;
        }
      }

      if (Object.keys(data).length === 0) {
        skipped += 1;
        batchSkipped += 1;
        continue;
      }

      if (!DRY_RUN) {
        await prisma.repairOrder.update({ where: { id: row.id }, data });
      }
      updated += 1;
      batchUpdated += 1;
    }

    logBatch('repairOrder', batch, {
      scanned: rows.length,
      updated: batchUpdated,
      skipped: batchSkipped,
    });

    if (rows.length < BATCH_SIZE) break;
  }

  return { scanned, updated, skipped };
}

export async function migrateRepairLinesS2(): Promise<MigrationStats> {
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;
  let batch = 0;

  for (;;) {
    const rows = await prisma.repairLine.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        description: true,
        descriptionEncrypted: true,
      },
    });
    if (rows.length === 0) break;
    batch += 1;
    cursor = rows[rows.length - 1]?.id;

    let batchUpdated = 0;
    let batchSkipped = 0;

    for (const row of rows) {
      scanned += 1;
      const descriptionEnc = resolveEncryptedFromDualStorage(row.descriptionEncrypted, row.description);
      if (!descriptionEnc) {
        skipped += 1;
        batchSkipped += 1;
        continue;
      }

      if (!DRY_RUN) {
        await prisma.repairLine.update({
          where: { id: row.id },
          data: { descriptionEncrypted: descriptionEnc },
        });
      }
      updated += 1;
      batchUpdated += 1;
    }

    logBatch('repairLine', batch, {
      scanned: rows.length,
      updated: batchUpdated,
      skipped: batchSkipped,
    });

    if (rows.length < BATCH_SIZE) break;
  }

  return { scanned, updated, skipped };
}

export async function migrateServiceAdvisorsS2(): Promise<MigrationStats> {
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let cursor: string | undefined;
  let batch = 0;

  for (;;) {
    const rows = await prisma.serviceAdvisor.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        displayName: true,
        displayNameEncrypted: true,
      },
    });
    if (rows.length === 0) break;
    batch += 1;
    cursor = rows[rows.length - 1]?.id;

    let batchUpdated = 0;
    let batchSkipped = 0;

    for (const row of rows) {
      scanned += 1;
      const displayNameEnc = resolveEncryptedFromDualStorage(row.displayNameEncrypted, row.displayName);
      if (!displayNameEnc) {
        skipped += 1;
        batchSkipped += 1;
        continue;
      }

      if (!DRY_RUN) {
        await prisma.serviceAdvisor.update({
          where: { id: row.id },
          data: { displayNameEncrypted: displayNameEnc },
        });
      }
      updated += 1;
      batchUpdated += 1;
    }

    logBatch('serviceAdvisor', batch, {
      scanned: rows.length,
      updated: batchUpdated,
      skipped: batchSkipped,
    });

    if (rows.length < BATCH_SIZE) break;
  }

  return { scanned, updated, skipped };
}

function needsS2Backfill(encrypted: string, plaintext: string): boolean {
  if (!plaintext?.trim()) return false;
  if (!encrypted?.trim()) return true;
  return !isLikelyEncryptedPayload(encrypted);
}

/** Full-table batched scan — rows still needing *Encrypted backfill. */
async function countPendingS2Rows(): Promise<S2MigrationResults['pendingAfterRun']> {
  const pending = { repairOrders: 0, repairLines: 0, serviceAdvisors: 0 };

  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.repairOrder.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, roNumber: true, roNumberEncrypted: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]?.id;
    for (const row of rows) {
      if (needsS2Backfill(row.roNumberEncrypted, row.roNumber)) pending.repairOrders += 1;
    }
    if (rows.length < BATCH_SIZE) break;
  }

  cursor = undefined;
  for (;;) {
    const rows = await prisma.repairLine.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, description: true, descriptionEncrypted: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]?.id;
    for (const row of rows) {
      if (needsS2Backfill(row.descriptionEncrypted, row.description)) pending.repairLines += 1;
    }
    if (rows.length < BATCH_SIZE) break;
  }

  cursor = undefined;
  for (;;) {
    const rows = await prisma.serviceAdvisor.findMany({
      take: BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, displayName: true, displayNameEncrypted: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1]?.id;
    for (const row of rows) {
      if (needsS2Backfill(row.displayNameEncrypted, row.displayName)) pending.serviceAdvisors += 1;
    }
    if (rows.length < BATCH_SIZE) break;
  }

  return pending;
}

export async function runS2PiiMigration(): Promise<S2MigrationResults> {
  const pendingBeforeRun = await countPendingS2Rows();

  const repairOrders = await migrateRepairOrdersS2();
  const repairLines = await migrateRepairLinesS2();
  const serviceAdvisors = await migrateServiceAdvisorsS2();

  const pendingAfterRun = DRY_RUN ? pendingBeforeRun : await countPendingS2Rows();

  return {
    dryRun: DRY_RUN,
    batchSize: BATCH_SIZE,
    pendingBeforeRun,
    repairOrders,
    repairLines,
    serviceAdvisors,
    pendingAfterRun,
  };
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error('DATABASE_URL must be set before running db:migrate-pii');
  }
  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
    throw new Error('ENCRYPTION_KEY must be set (min 32 chars) before running db:migrate-pii');
  }

  console.log(
    DRY_RUN
      ? '[migrate-pii] DRY RUN — no database writes; reporting rows that WOULD be updated'
      : '[migrate-pii] EXECUTE — backfilling *Encrypted columns from plaintext twins (batched)'
  );
  console.log(`[migrate-pii] batch size: ${BATCH_SIZE}`);
  if (!DRY_RUN) {
    console.log('[migrate-pii] Rollback: restore pre-migration database backup if needed.');
  }

  const results = await runS2PiiMigration();
  console.log(JSON.stringify({ ok: true, ...results }, null, 2));

  const totalWouldUpdate =
    results.repairOrders.updated + results.repairLines.updated + results.serviceAdvisors.updated;

  if (DRY_RUN) {
    console.log(
      `[migrate-pii] Dry-run complete — ${totalWouldUpdate} row(s) would be updated across all tables.`
    );
    if (Object.values(results.pendingBeforeRun).some((n) => n > 0)) {
      console.log(
        '[migrate-pii] Run npm run db:migrate-pii to execute after reviewing counts above.'
      );
    } else {
      console.log('[migrate-pii] No pending S2 backfill rows — database is already up to date.');
    }
    return;
  }

  if (Object.values(results.pendingAfterRun).some((n) => n > 0)) {
    console.warn(
      '[migrate-pii] Some rows still need backfill — re-run npm run db:migrate-pii until pendingAfterRun is 0.'
    );
  } else {
    console.log('[migrate-pii] S2 backfill complete — all pending counts are 0.');
  }
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}