import 'server-only';

import { randomUUID } from 'crypto';
import type { CompanionEvent } from '@/lib/companionSyncTypes';
import { logger } from '@/lib/logger';

function internalPublishUrl(): string | null {
  const url = process.env.COMPANION_WS_INTERNAL_URL?.trim();
  if (url) return url.replace(/\/$/, '');
  if (process.env.NODE_ENV !== 'production') return 'http://127.0.0.1:3001';
  return null;
}

type BroadcastCompanionEvent = {
  [K in CompanionEvent as K['type']]: Omit<K, 'seq' | 'timestamp' | 'technicianId' | 'sourceDeviceId' | 'id'> & {
    type: K['type'];
    id?: string;
    sourceDeviceId?: string;
  };
}[CompanionEvent['type']];

/** Broadcast a companion event to all devices for this technician via the WS server. */
export async function broadcastCompanionEvent(
  technicianId: string,
  event: BroadcastCompanionEvent
): Promise<void> {
  const baseUrl = internalPublishUrl();
  const secret = process.env.COMPANION_WS_SECRET?.trim();
  if (!baseUrl || !secret) return;

  try {
    const response = await fetch(`${baseUrl}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({
        technicianId,
        event: {
          ...event,
          id: event.id ?? randomUUID(),
          technicianId,
          sourceDeviceId: event.sourceDeviceId ?? 'server',
          timestamp: new Date().toISOString(),
        },
      }),
    });
    if (!response.ok) {
      logger.warn('companion.broadcast_failed', { status: response.status, type: event.type });
    }
  } catch (error) {
    logger.warn('companion.broadcast_error', {
      type: event.type,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}