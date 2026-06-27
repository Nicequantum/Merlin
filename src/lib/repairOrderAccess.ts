import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isServiceAdvisorActive } from '@/lib/serviceAdvisorAccounts';

export interface RepairOrderAccessSession {
  technicianId: string;
  role: string;
  dealershipId: string;
  serviceAdvisorId?: string | null;
}

export function isServiceAdvisorUser(session: { role: string }): boolean {
  return session.role === 'service_advisor';
}

/** Shared RO access for technicians, managers, and linked service advisor accounts. */
export async function canAccessRepairOrder(
  session: RepairOrderAccessSession,
  roId: string,
  include: Prisma.RepairOrderInclude = { repairLines: true }
) {
  const ro = await prisma.repairOrder.findUnique({
    where: { id: roId },
    include,
  });

  if (!ro) return null;

  if (session.role === 'manager' && ro.dealershipId === session.dealershipId) {
    return ro;
  }

  if (session.role === 'service_advisor' && session.serviceAdvisorId) {
    if (
      ro.dealershipId === session.dealershipId &&
      ro.serviceAdvisorId === session.serviceAdvisorId
    ) {
      const advisor = await prisma.serviceAdvisor.findFirst({
        where: {
          id: session.serviceAdvisorId,
          dealershipId: session.dealershipId,
          deletedAt: null,
        },
      });
      if (!advisor || !isServiceAdvisorActive(advisor)) return null;
      return ro;
    }
    return null;
  }

  if (ro.technicianId === session.technicianId) {
    return ro;
  }

  return null;
}