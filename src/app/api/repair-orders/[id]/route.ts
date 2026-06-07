import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { dbToRepairOrder, repairLineToDbFields, repairOrderToDbFields } from '@/lib/roMapper';

async function canAccess(session: { technicianId: string; role: string; dealershipId: string }, roId: string) {
  const ro = await prisma.repairOrder.findUnique({ where: { id: roId } });
  if (!ro) return null;
  if (session.role === 'manager' && ro.dealershipId === session.dealershipId) return ro;
  if (ro.technicianId === session.technicianId) return ro;
  return null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const ro = await canAccess(session, id);
    if (!ro) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const full = await prisma.repairOrder.findUnique({
      where: { id },
      include: { repairLines: true },
    });
    return { repairOrder: dbToRepairOrder(full!) };
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const existing = await canAccess(session, id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const input = {
      roNumber: body.roNumber ?? existing.roNumber,
      vehicle: body.vehicle ?? {
        vin: existing.vin,
        year: existing.year,
        make: existing.make,
        model: existing.model,
        engine: existing.engine,
        mileageIn: existing.mileageIn,
        mileageOut: existing.mileageOut,
      },
      customer: body.customer ?? { name: '' },
      complaints: body.complaints ?? JSON.parse(existing.complaints),
      xentryImages: body.xentryImages,
      xentryOcrTexts: body.xentryOcrTexts,
      repairLines: body.repairLines,
    };

    await prisma.repairOrder.update({
      where: { id },
      data: repairOrderToDbFields(input),
    });

    if (body.repairLines && Array.isArray(body.repairLines)) {
      for (const line of body.repairLines) {
        if (line.id) {
          await prisma.repairLine.upsert({
            where: { id: line.id },
            update: repairLineToDbFields(line),
            create: {
              id: line.id,
              repairOrderId: id,
              ...repairLineToDbFields(line),
            },
          });
        }
      }
      const incomingIds = new Set(body.repairLines.map((l: { id: string }) => l.id));
      const dbLines = await prisma.repairLine.findMany({ where: { repairOrderId: id } });
      for (const dbLine of dbLines) {
        if (!incomingIds.has(dbLine.id)) {
          await prisma.repairLine.delete({ where: { id: dbLine.id } });
        }
      }
    }

    const updated = await prisma.repairOrder.findUnique({
      where: { id },
      include: { repairLines: true },
    });

    return { repairOrder: dbToRepairOrder(updated!) };
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAuth(async (session) => {
    const existing = await canAccess(session, id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await prisma.repairOrder.delete({ where: { id } });
    return { ok: true };
  });
}