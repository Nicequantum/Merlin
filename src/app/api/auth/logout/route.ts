import { NextResponse } from 'next/server';
import { writeAuditLog } from '@/lib/audit';
import { clearSessionCookie, getSession, revokeTechnicianSessions } from '@/lib/auth';
import { handleRouteError } from '@/lib/errors';
import { checkRateLimit, getRequestIp, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'auth.logout', RATE_LIMITS.default);
  if (rateLimited) return rateLimited;

  try {
    const session = await getSession();

    if (session) {
      await revokeTechnicianSessions(session.technicianId);
      await writeAuditLog({
        action: 'auth.logout',
        dealershipId: session.dealershipId,
        technicianId: session.technicianId,
        ipAddress: getRequestIp(request),
      });
    }

    await clearSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error, 'auth.logout');
  }
}