import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { apiError, NOT_FOUND_ERROR } from '@/lib/errors';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return withAuth(
    request,
    async (session) => {
      const technician = await prisma.technician.findFirst({
        where: { id, dealershipId: session.dealershipId, deletedAt: null },
        select: {
          id: true,
          d7Number: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          consentAt: true,
        },
      });

      if (!technician) {
        return apiError(NOT_FOUND_ERROR, 404);
      }

      const [appStartCount, storyCount, lastLog, recentSessions] = await Promise.all([
        prisma.technicianActivityLog.count({
          where: { technicianId: id, dealershipId: session.dealershipId, category: 'app_start' },
        }),
        prisma.technicianActivityLog.count({
          where: { technicianId: id, dealershipId: session.dealershipId, category: 'story' },
        }),
        prisma.technicianActivityLog.findFirst({
          where: { technicianId: id, dealershipId: session.dealershipId },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
        prisma.technicianActivityLog.findMany({
          where: {
            technicianId: id,
            dealershipId: session.dealershipId,
            category: 'app_start',
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            event: true,
            message: true,
            clientSessionId: true,
            metadata: true,
            createdAt: true,
          },
        }),
      ]);

      return {
        technician: {
          id: technician.id,
          d7Number: technician.d7Number,
          name: technician.name,
          role: technician.role,
          isActive: technician.isActive,
          createdAt: technician.createdAt.toISOString(),
          consentAt: technician.consentAt?.toISOString() ?? null,
          appStartLogCount: appStartCount,
          storyLogCount: storyCount,
          lastActivityAt: lastLog?.createdAt.toISOString() ?? null,
          recentAppStarts: recentSessions.map((log) => ({
            id: log.id,
            event: log.event,
            message: log.message,
            clientSessionId: log.clientSessionId,
            metadata: safeParseMetadata(log.metadata),
            createdAt: log.createdAt.toISOString(),
          })),
        },
      };
    },
    { rateLimitKey: 'technicians.get', requireManager: true }
  );
}

function safeParseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}