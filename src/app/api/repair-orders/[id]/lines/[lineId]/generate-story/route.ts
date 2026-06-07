import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { generateWarrantyStory } from '@/lib/grok';
import { dbToRepairOrder } from '@/lib/roMapper';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { id, lineId } = await params;
  return withAuth(async (session) => {
    const ro = await prisma.repairOrder.findUnique({
      where: { id },
      include: { repairLines: true },
    });

    if (!ro) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.role !== 'manager' && ro.technicianId !== session.technicianId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const mapped = dbToRepairOrder(ro);
    const line = mapped.repairLines.find((l) => l.id === lineId);
    if (!line) return NextResponse.json({ error: 'Line not found' }, { status: 404 });

    let historyContext = '';
    const similar = await prisma.repairOrder.findMany({
      where: {
        dealershipId: session.dealershipId,
        id: { not: id },
        model: ro.model ? { contains: ro.model.split(' ')[0] } : undefined,
      },
      include: { repairLines: true },
      take: 2,
    });

    if (similar.length > 0) {
      historyContext =
        '\n\nFor writing style reference only (do NOT copy facts from these — use only current line data):\n' +
        similar
          .map((r) => {
            const m = dbToRepairOrder(r);
            return m.repairLines
              .filter((l) => l.warrantyStory)
              .map((l) => `For ${l.description}: ${l.warrantyStory!.substring(0, 250)}...`)
              .join('\n');
          })
          .join('\n---\n');
    }

    const warrantyStory = await generateWarrantyStory(mapped, line, historyContext);

    await prisma.repairLine.update({
      where: { id: lineId },
      data: { warrantyStory },
    });

    return { warrantyStory };
  });
}