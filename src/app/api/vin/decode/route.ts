import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiRoute';
import { decodeVin } from '@/lib/vin';

export async function POST(request: Request) {
  return withAuth(async () => {
    const { vin } = await request.json();
    if (!vin || typeof vin !== 'string') {
      return NextResponse.json({ error: 'VIN required' }, { status: 400 });
    }
    const result = await decodeVin(vin);
    return result;
  });
}