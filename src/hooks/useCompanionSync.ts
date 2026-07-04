'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getCompanionDeviceId } from '@/lib/companionDeviceId';
import type {
  CompanionActivityEntry,
  CompanionConnectionState,
  CompanionEvent,
  CompanionWorkflowStatus,
} from '@/lib/companionSyncTypes';
import type { AppView, RepairLine, RepairOrder, StoryQualityResult } from '@/types';

const MAX_ACTIVITY = 40;
const MAX_SEEN_EVENTS = 200;
const RECONNECT_BASE_MS = 800;
const RECONNECT_MAX_MS = 12_000;
const PING_INTERVAL_MS = 25_000;

interface CompanionSyncHandlers {
  onNavigation: (payload: {
    view: AppView;
    repairOrderId: string | null;
    lineId: string | null;
  }) => void | Promise<void>;
  onRORefresh: (repairOrderId: string) => void | Promise<void>;
  onROPatch: (payload: {
    repairOrderId: string;
    lineId?: string;
    linePatch?: Partial<RepairLine>;
    roPatch?: Partial<Pick<RepairOrder, 'roNumber' | 'complaints' | 'vehicle' | 'customer'>>;
  }) => void;
  onStoryQuality: (payload: {
    repairOrderId: string;
    lineId: string;
    quality: StoryQualityResult;
  }) => void;
  onStoryCertification: (payload: {
    repairOrderId: string;
    lineId: string;
    certifiedByName: string;
    certifiedAt: string;
    warrantyStory: string;
  }) => void;
}

interface UseCompanionSyncOptions extends CompanionSyncHandlers {
  enabled: boolean;
  technicianId: string;
  getNavigationState: () => {
    view: AppView;
    repairOrderId: string | null;
    lineId: string | null;
  };
}

export function useCompanionSync({
  enabled,
  technicianId,
  getNavigationState,
  onNavigation,
  onRORefresh,
  onROPatch,
  onStoryQuality,
  onStoryCertification,
}: UseCompanionSyncOptions) {
  const deviceId = getCompanionDeviceId();
  const [connectionState, setConnectionState] = useState<CompanionConnectionState>('disconnected');
  const [workflowStatus, setWorkflowStatus] = useState<CompanionWorkflowStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusProgress, setStatusProgress] = useState<number | null>(null);
  const [activities, setActivities] = useState<CompanionActivityEntry[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const lastSeqRef = useRef(0);
  const applyingRemoteRef = useRef(false);
  const lastPublishedNavRef = useRef('');
  const mountedRef = useRef(true);

  const rememberEvent = useCallback((id: string) => {
    const seen = seenEventIdsRef.current;
    seen.add(id);
    if (seen.size > MAX_SEEN_EVENTS) {
      const iter = seen.values();
      for (let i = 0; i < 50; i++) {
        const next = iter.next();
        if (next.done) break;
        seen.delete(next.value);
      }
    }
  }, []);

  const pushActivity = useCallback((entry: CompanionActivityEntry) => {
    setActivities((prev) => [entry, ...prev].slice(0, MAX_ACTIVITY));
  }, []);

  const handleIncomingEvent = useCallback(
    async (event: CompanionEvent) => {
      if (!event?.id || event.sourceDeviceId === deviceId) return;
      if (seenEventIdsRef.current.has(event.id)) return;
      if (event.seq && event.seq <= lastSeqRef.current) return;
      if (event.seq) lastSeqRef.current = event.seq;
      rememberEvent(event.id);

      switch (event.type) {
        case 'navigation':
          applyingRemoteRef.current = true;
          try {
            lastPublishedNavRef.current = `${event.view}:${event.repairOrderId}:${event.lineId}`;
            await onNavigation({
              view: event.view,
              repairOrderId: event.repairOrderId,
              lineId: event.lineId,
            });
          } finally {
            applyingRemoteRef.current = false;
          }
          break;
        case 'ro.refresh':
          await onRORefresh(event.repairOrderId);
          break;
        case 'ro.patch':
          onROPatch({
            repairOrderId: event.repairOrderId,
            lineId: event.lineId,
            linePatch: event.linePatch,
            roPatch: event.roPatch,
          });
          break;
        case 'status':
          setWorkflowStatus(event.status);
          setStatusMessage(event.message ?? null);
          setStatusProgress(typeof event.progress === 'number' ? event.progress : null);
          break;
        case 'activity':
          pushActivity({
            id: event.id,
            label: event.label,
            detail: event.detail,
            timestamp: event.timestamp,
            repairOrderId: event.repairOrderId,
            lineId: event.lineId,
          });
          break;
        case 'story.quality':
          onStoryQuality({
            repairOrderId: event.repairOrderId,
            lineId: event.lineId,
            quality: event.quality,
          });
          break;
        case 'story.certification':
          onStoryCertification({
            repairOrderId: event.repairOrderId,
            lineId: event.lineId,
            certifiedByName: event.certifiedByName,
            certifiedAt: event.certifiedAt,
            warrantyStory: event.warrantyStory,
          });
          break;
        default:
          break;
      }
    },
    [
      deviceId,
      onNavigation,
      onRORefresh,
      onROPatch,
      onStoryQuality,
      onStoryCertification,
      pushActivity,
      rememberEvent,
    ]
  );

  const sendEvent = useCallback(
    (event: Omit<CompanionEvent, 'seq' | 'timestamp'>) => {
      const socket = wsRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      socket.send(
        JSON.stringify({
          type: 'event',
          event: {
            ...event,
            technicianId,
            sourceDeviceId: deviceId,
            timestamp: new Date().toISOString(),
          },
        })
      );
    },
    [deviceId, technicianId]
  );

  const publish = useCallback(
    (event: Omit<CompanionEvent, 'seq' | 'timestamp' | 'technicianId' | 'sourceDeviceId'>) => {
      sendEvent({
        ...event,
        technicianId,
        sourceDeviceId: deviceId,
      } as CompanionEvent);
    },
    [deviceId, sendEvent, technicianId]
  );

  const publishNavigation = useCallback(() => {
    if (applyingRemoteRef.current) return;
    const { view, repairOrderId, lineId } = getNavigationState();
    const key = `${view}:${repairOrderId}:${lineId}`;
    if (key === lastPublishedNavRef.current) return;
    lastPublishedNavRef.current = key;
    const id = crypto.randomUUID();
    publish({
      id,
      type: 'navigation',
      view,
      repairOrderId,
      lineId,
    } as CompanionEvent);
    pushActivity({
      id,
      label:
        view === 'line'
          ? 'Opened repair line'
          : view === 'ro'
            ? 'Opened repair order'
            : 'Changed view',
      timestamp: new Date().toISOString(),
      repairOrderId,
      lineId,
    });
  }, [getNavigationState, publish, pushActivity]);

  const publishStatus = useCallback(
    (status: CompanionWorkflowStatus, options?: { message?: string; progress?: number; repairOrderId?: string | null; lineId?: string | null }) => {
      setWorkflowStatus(status);
      setStatusMessage(options?.message ?? null);
      setStatusProgress(typeof options?.progress === 'number' ? options.progress : null);
      publish({
        id: crypto.randomUUID(),
        type: 'status',
        status,
        message: options?.message,
        progress: options?.progress,
        repairOrderId: options?.repairOrderId,
        lineId: options?.lineId,
      } as CompanionEvent);
    },
    [publish]
  );

  const publishActivity = useCallback(
    (label: string, options?: { detail?: string; repairOrderId?: string | null; lineId?: string | null }) => {
      const id = crypto.randomUUID();
      publish({
        id,
        type: 'activity',
        label,
        detail: options?.detail,
        repairOrderId: options?.repairOrderId,
        lineId: options?.lineId,
      } as CompanionEvent);
      pushActivity({
        id,
        label,
        detail: options?.detail,
        timestamp: new Date().toISOString(),
        repairOrderId: options?.repairOrderId,
        lineId: options?.lineId,
      });
    },
    [publish, pushActivity]
  );

  const publishROPatch = useCallback(
    (payload: {
      repairOrderId: string;
      lineId?: string;
      linePatch?: Partial<RepairLine>;
      roPatch?: Partial<Pick<RepairOrder, 'roNumber' | 'complaints' | 'vehicle' | 'customer'>>;
    }) => {
      publish({
        id: crypto.randomUUID(),
        type: 'ro.patch',
        ...payload,
      } as CompanionEvent);
    },
    [publish]
  );

  const clearTimers = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (pingTimerRef.current) {
      clearInterval(pingTimerRef.current);
      pingTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (!enabled || !mountedRef.current) return;
    clearTimers();
    setConnectionState(reconnectAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

    try {
      const response = await fetch('/api/companion/ws-token', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to obtain companion token');
      const { token, wsUrl } = (await response.json()) as { token: string; wsUrl: string };
      if (!wsUrl) throw new Error('Companion WebSocket URL is not configured');

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'auth', token }));
      };

      socket.onmessage = (message) => {
        let payload: { type?: string; event?: CompanionEvent };
        try {
          payload = JSON.parse(String(message.data));
        } catch {
          return;
        }
        if (payload.type === 'auth.ok') {
          reconnectAttemptRef.current = 0;
          setConnectionState('connected');
          pingTimerRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: 'ping' }));
            }
          }, PING_INTERVAL_MS);
          return;
        }
        if (payload.type === 'pong') return;
        if (payload.event) {
          void handleIncomingEvent(payload.event);
        }
      };

      socket.onclose = () => {
        wsRef.current = null;
        clearTimers();
        if (!mountedRef.current || !enabled) {
          setConnectionState('disconnected');
          return;
        }
        setConnectionState('reconnecting');
        const delay = Math.min(
          RECONNECT_MAX_MS,
          RECONNECT_BASE_MS * 2 ** reconnectAttemptRef.current
        );
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          void connect();
        }, delay);
      };

      socket.onerror = () => {
        setConnectionState('error');
      };
    } catch {
      setConnectionState('error');
      const delay = Math.min(
        RECONNECT_MAX_MS,
        RECONNECT_BASE_MS * 2 ** reconnectAttemptRef.current
      );
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        void connect();
      }, delay);
    }
  }, [clearTimers, enabled, handleIncomingEvent]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) void connect();
    return () => {
      mountedRef.current = false;
      clearTimers();
      wsRef.current?.close();
      wsRef.current = null;
      setConnectionState('disconnected');
    };
  }, [clearTimers, connect, enabled]);

  return {
    deviceId,
    connectionState,
    workflowStatus,
    statusMessage,
    statusProgress,
    activities,
    publish,
    publishNavigation,
    publishStatus,
    publishActivity,
    publishROPatch,
    isApplyingRemote: () => applyingRemoteRef.current,
  };
}