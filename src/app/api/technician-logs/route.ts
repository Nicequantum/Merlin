import { withAuth } from '@/lib/apiRoute';
import { writeTechnicianActivityLog } from '@/lib/technicianActivityLog';

import { parseRequestBody, technicianAppStartLogSchema } from '@/lib/validation';

export async function POST(request: Request) {
  return withAuth(
    request,
    async (session) => {
      const parsed = await parseRequestBody(request, technicianAppStartLogSchema);
      if ('error' in parsed) return parsed.error;

      const { clientSessionId, metadata } = parsed.data;

      await writeTechnicianActivityLog({
        dealershipId: session.dealershipId,
        technicianId: session.technicianId,
        category: 'app_start',
        event: 'app.ready',
        message: 'Merlin session ready — repair orders loaded',
        clientSessionId,
        metadata: {
          role: metadata?.role ?? session.role,
          todayRoCount: metadata?.todayRoCount,
          previousRoCount: metadata?.previousRoCount,
          appVersion: metadata?.appVersion,
          clientSessionId,
        },
      });

      return { ok: true };
    },
    { rateLimitKey: 'technician_logs.ingest', skipConsent: false }
  );
}