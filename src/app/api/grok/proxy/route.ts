import { NextResponse } from 'next/server';
import {
  getGrokProxyApiKey,
  getGrokProxyUpstreamApiKey,
  isGrokProxyConfigured,
} from '@/lib/grokApiKey.shared';
import { logger } from '@/lib/logger';
import { parseGrokApiErrorBody } from '@/lib/scanRouteErrors';

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';

/**
 * Apex national platform — centralized Grok proxy endpoint.
 * Dealer nodes authenticate with GROK_PROXY_API_KEY; upstream calls use GROK_API_KEY
 * (Merlinus/Tiverton direct key) when present, otherwise GROK_PROXY_API_KEY.
 *
 * Merlinus single-dealer deployments typically omit GROK_PROXY_API_KEY — this route
 * returns 503 and all Grok traffic continues to use direct xAI from src/lib/grok.ts.
 */
export async function POST(request: Request) {
  if (!isGrokProxyConfigured()) {
    return NextResponse.json({ error: 'Grok proxy is not configured on this host' }, { status: 503 });
  }

  const expectedKey = getGrokProxyApiKey();
  const auth = request.headers.get('authorization')?.trim() ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== expectedKey) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
  }

  try {
    const upstreamKey = getGrokProxyUpstreamApiKey();
    const response = await fetch(GROK_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstreamKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const responseText = await response.text();
    if (!response.ok) {
      const detail = parseGrokApiErrorBody(responseText);
      logger.warn('grok.proxy.upstream_error', {
        status: response.status,
        detail: detail || undefined,
      });
      return NextResponse.json(
        { error: `Upstream Grok API error: ${response.status}${detail ? ` — ${detail}` : ''}` },
        { status: response.status >= 500 ? 502 : response.status }
      );
    }

    try {
      return NextResponse.json(JSON.parse(responseText));
    } catch {
      return NextResponse.json({ error: 'Upstream Grok API returned invalid JSON' }, { status: 502 });
    }
  } catch (error) {
    logger.error('grok.proxy.forward_failed', {
      error: error instanceof Error ? error.message : 'unknown',
    });
    return NextResponse.json({ error: 'Grok proxy forward failed' }, { status: 502 });
  }
}