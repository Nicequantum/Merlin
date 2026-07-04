import { withAuth } from '@/lib/apiRoute';
import { createSessionToken } from '@/lib/auth';

export async function GET(request: Request) {
  return withAuth(
    request,
    async (session) => {
      const token = await createSessionToken(session);
      const wsUrl =
        process.env.NEXT_PUBLIC_COMPANION_WS_URL?.trim() ||
        (process.env.NODE_ENV !== 'production' ? 'ws://127.0.0.1:3001' : '');

      return {
        token,
        wsUrl,
        technicianId: session.technicianId,
        expiresInSec: 60 * 60 * 8,
      };
    },
    { rateLimitKey: 'companion.ws-token', skipRateLimit: true }
  );
}