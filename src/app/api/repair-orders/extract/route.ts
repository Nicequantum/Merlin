import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/apiRoute';
import { extractROFromImages } from '@/lib/grok';

export async function POST(request: Request) {
  return withAuth(async () => {
    const { imageDataUrls } = await request.json();
    if (!Array.isArray(imageDataUrls) || imageDataUrls.length === 0) {
      return NextResponse.json({ error: 'imageDataUrls required' }, { status: 400 });
    }
    const extracted = await extractROFromImages(imageDataUrls);
    return extracted;
  });
}