import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { CONSENT_VERSION } from '@/types';

export async function POST() {
  return withAuth(async (session) => {
    const now = new Date();
    await prisma.technician.update({
      where: { id: session.technicianId },
      data: { consentAt: now, consentVersion: CONSENT_VERSION },
    });
    return { consentAt: now.toISOString() };
  });
}