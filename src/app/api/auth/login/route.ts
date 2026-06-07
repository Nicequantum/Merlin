import { NextResponse } from 'next/server';
import { createSessionToken, loginTechnician, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const session = await loginTechnician(email, password);
    if (!session) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await createSessionToken(session);
    await setSessionCookie(token);
    return NextResponse.json({ session });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Login failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}