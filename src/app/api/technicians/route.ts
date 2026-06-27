import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';

export async function GET(request: Request) {
  return withAuth(
    request,
    async (session) => {
      const technicians = await prisma.technician.findMany({
        where: { dealershipId: session.dealershipId, deletedAt: null },
        select: {
          id: true,
          d7Number: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
        },
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      });

      const logCounts = await prisma.technicianActivityLog.groupBy({
        by: ['technicianId', 'category'],
        where: { dealershipId: session.dealershipId },
        _count: { _all: true },
      });

      const lastActivity = await prisma.technicianActivityLog.groupBy({
        by: ['technicianId'],
        where: { dealershipId: session.dealershipId },
        _max: { createdAt: true },
      });

      const countMap = new Map<string, { appStart: number; story: number }>();
      for (const row of logCounts) {
        const existing = countMap.get(row.technicianId) ?? { appStart: 0, story: 0 };
        if (row.category === 'app_start') existing.appStart = row._count._all;
        if (row.category === 'story') existing.story = row._count._all;
        countMap.set(row.technicianId, existing);
      }

      const lastMap = new Map(lastActivity.map((row) => [row.technicianId, row._max.createdAt]));

      return {
        technicians: technicians.map((tech) => {
          const counts = countMap.get(tech.id) ?? { appStart: 0, story: 0 };
          const last = lastMap.get(tech.id);
          return {
            id: tech.id,
            d7Number: tech.d7Number,
            name: tech.name,
            role: tech.role,
            isActive: tech.isActive,
            createdAt: tech.createdAt.toISOString(),
            appStartLogCount: counts.appStart,
            storyLogCount: counts.story,
            lastActivityAt: last?.toISOString() ?? null,
          };
        }),
      };
    },
    { rateLimitKey: 'technicians.list', requireManager: true }
  );
}