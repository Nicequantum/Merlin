import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiRoute';
import { prisma } from '@/lib/db';
import { dbToRepairOrder, repairLineToDbFields, repairOrderToDbFields, type RepairOrderInput } from '@/lib/roMapper';
import { emptyExtractedData } from '@/utils/diagnosticParser';
import { createRepairOrderFromScan } from '@/utils/repairOrderFactory';

export async function GET() {
  return withAuth(async (session) => {
    const where =
      session.role === 'manager'
        ? { dealershipId: session.dealershipId }
        : { technicianId: session.technicianId };

    const orders = await prisma.repairOrder.findMany({
      where,
      include: {
        repairLines: true,
        technician: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const repairOrders = orders.map((ro) => {
      const mapped = dbToRepairOrder(ro);
      mapped.technicianName = ro.technician.name;
      return mapped;
    });

    return { repairOrders };
  });
}

export async function POST(request: Request) {
  return withAuth(async (session) => {
    const body = await request.json();

    let input: RepairOrderInput;
    if (body.fromExtraction) {
      const ro = createRepairOrderFromScan({
        roNumber: body.roNumber || `R-${Date.now().toString().slice(-6)}`,
        vehicle: body.vehicle,
        customerName: body.customerName || '',
        complaints: body.complaints || [],
      });
      input = {
        roNumber: ro.roNumber,
        vehicle: ro.vehicle,
        customer: ro.customer,
        complaints: ro.complaints,
        xentryImages: ro.xentryImages,
        xentryOcrTexts: ro.xentryOcrTexts,
        repairLines: ro.repairLines,
      };
    } else {
      input = {
        roNumber: body.roNumber || `R-${Date.now().toString().slice(-6)}`,
        vehicle: body.vehicle || { vin: '', year: '', make: '', model: '', engine: '', mileageIn: '', mileageOut: '' },
        customer: body.customer || { name: '' },
        complaints: body.complaints || [],
        xentryImages: body.xentryImages || [],
        xentryOcrTexts: body.xentryOcrTexts || [],
        repairLines: (body.repairLines || []).map((l: RepairOrderInput['repairLines'][0], i: number) => ({
          ...l,
          lineNumber: l.lineNumber || i + 1,
          extractedData: l.extractedData || emptyExtractedData(),
          xentryImages: l.xentryImages || [],
        })),
      };
      if (input.repairLines.length === 0) {
        input.repairLines = [
          {
            id: 'temp',
            lineNumber: 1,
            description: 'Enter repair description',
            customerConcern: '',
            technicianNotes: '',
            xentryImages: [],
            extractedData: emptyExtractedData(),
          },
        ];
      }
    }

    const created = await prisma.repairOrder.create({
      data: {
        ...repairOrderToDbFields(input),
        technicianId: session.technicianId,
        dealershipId: session.dealershipId,
        repairLines: {
          create: input.repairLines.map((line) => repairLineToDbFields(line)),
        },
      },
      include: { repairLines: true },
    });

    return { repairOrder: dbToRepairOrder(created) };
  });
}