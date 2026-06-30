import 'server-only';
import { PrismaClient } from '@prisma/client';
import { logger } from './logger';
import { withDbConnectionRetry } from './dbRetry';

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

/** Singleton Prisma client — reused across warm serverless invocations and dev HMR. */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

/** Health-check probe with connection retry — not used on request hot paths. */
export async function probeDatabaseConnection(): Promise<void> {
  await withDbConnectionRetry(
    async () => {
      await prisma.$queryRaw`SELECT 1`;
    },
    { context: 'health.database' }
  );
}

/** Background cold-start warmup; never blocks login or RO scan handlers. */
export function warmDatabaseConnectionInBackground(): void {
  void withDbConnectionRetry(
    async () => {
      await prisma.$connect();
    },
    { context: 'startup.warmup', maxAttempts: 3 }
  ).catch((error) => {
    logger.warn('db.warmup_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
  });
}