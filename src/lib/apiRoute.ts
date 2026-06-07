import { NextResponse } from 'next/server';
import { getSession } from './auth';

export async function withAuth<T>(handler: (session: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<T>) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await handler(session);
    return result instanceof NextResponse ? result : NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error';
    console.error('[API]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}