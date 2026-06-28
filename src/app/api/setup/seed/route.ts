import { NextResponse } from 'next/server';
import { apiError, handleRouteError } from '@/lib/errors';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { runDatabaseSeed } from '@/lib/seedDatabase';

export const dynamic = 'force-dynamic';

/** H-4: Block bootstrap re-seed in production unless explicitly enabled for initial store setup. */
function isBootstrapAllowed(): boolean {
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
  if (!isProduction) return true;
  return process.env.ALLOW_BOOTSTRAP?.trim().toLowerCase() === 'true';
}

function authorizeSetup(request: Request): boolean {
  const expected = process.env.SETUP_SECRET?.trim();
  if (!expected) return false;

  const auth = request.headers.get('authorization')?.trim();
  if (auth?.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim() === expected;
  }

  return false;
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'setup.seed', RATE_LIMITS.auth);
  if (rateLimited) return rateLimited;

  if (!isBootstrapAllowed()) {
    return apiError('Bootstrap seed is disabled in production.', 403);
  }

  if (!authorizeSetup(request)) {
    return apiError('Unauthorized.', 401);
  }

  try {
    const result = await runDatabaseSeed();
    return NextResponse.json({
      ok: true,
      managerD7: result.managerD7,
      techD7: result.techD7,
      templates: result.templates,
      knowledgeBase: result.knowledgeBase,
    });
  } catch (error) {
    return handleRouteError(error, 'setup.seed');
  }
}