import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { isKvConfigured } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

interface HealthCheck {
  status: 'ok' | 'degraded' | 'error';
  version: string;
  uptimeSeconds: number;
  checks: Record<string, { status: 'ok' | 'warn' | 'error'; detail?: string }>;
}

const startedAt = Date.now();

export async function GET() {
  const checks: HealthCheck['checks'] = {
    database: { status: 'ok' },
    blob: { status: process.env.BLOB_READ_WRITE_TOKEN ? 'ok' : 'warn', detail: process.env.BLOB_READ_WRITE_TOKEN ? undefined : 'not configured' },
    grok: { status: process.env.GROK_API_KEY ? 'ok' : 'warn', detail: process.env.GROK_API_KEY ? undefined : 'not configured' },
    kv: { status: isKvConfigured() ? 'ok' : 'warn', detail: isKvConfigured() ? undefined : 'using in-memory rate limit fallback' },
    encryption: {
      status: process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32 ? 'ok' : 'error',
      detail: process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32 ? undefined : 'missing or too short',
    },
    session: {
      status: process.env.SESSION_SECRET ? 'ok' : 'error',
      detail: process.env.SESSION_SECRET ? undefined : 'missing',
    },
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (error) {
    checks.database = {
      status: 'error',
      detail: error instanceof Error ? error.message : 'connection failed',
    };
    logger.error('health.database_failed', { error: checks.database.detail });
  }

  const hasError = Object.values(checks).some((c) => c.status === 'error');
  const hasWarn = Object.values(checks).some((c) => c.status === 'warn');

  const payload: HealthCheck = {
    status: hasError ? 'error' : hasWarn ? 'degraded' : 'ok',
    version: process.env.npm_package_version || '3.0.0',
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    checks,
  };

  const statusCode = payload.status === 'error' ? 503 : 200;
  return Response.json(payload, { status: statusCode });
}