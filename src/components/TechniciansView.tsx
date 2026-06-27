'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  PlayCircle,
  ScrollText,
  UsersRound,
} from 'lucide-react';
import { BenzEmptyState } from '@/components/BenzEmptyState';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { TechnicianActivityLogEntry, TechnicianDetail, TechnicianListItem } from '@/types';

interface TechniciansViewProps {
  onBack: () => void;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatEventLabel(event: string) {
  return event.replace(/\./g, ' · ');
}

function LogRow({ log }: { log: TechnicianActivityLogEntry }) {
  const roNumber = typeof log.metadata.roNumber === 'string' ? log.metadata.roNumber : null;
  const lineNumber = typeof log.metadata.lineNumber === 'number' ? log.metadata.lineNumber : null;

  return (
    <div className="benz-list-row px-3 py-2.5">
      <div className="flex justify-between items-start gap-2 mb-1">
        <span className="text-xs font-semibold text-benz-blue uppercase tracking-wide">
          {formatEventLabel(log.event)}
        </span>
        <span className="text-xs text-benz-secondary shrink-0">{formatDateTime(log.createdAt)}</span>
      </div>
      <div className="text-sm leading-snug">{log.message}</div>
      {(roNumber || lineNumber) && (
        <div className="text-xs text-benz-muted mt-1">
          {roNumber ? `RO ${roNumber}` : ''}
          {roNumber && lineNumber ? ' · ' : ''}
          {lineNumber ? `Line ${lineNumber}` : ''}
        </div>
      )}
    </div>
  );
}

function TechnicianDetailPanel({
  technician,
  appStartLogs,
  storyLogs,
  logsLoading,
}: {
  technician: TechnicianDetail;
  appStartLogs: TechnicianActivityLogEntry[];
  storyLogs: TechnicianActivityLogEntry[];
  logsLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="benz-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold tracking-tight">{technician.name}</div>
            <div className="text-xs text-benz-secondary mt-1">
              {technician.d7Number} · {technician.role}
              {!technician.isActive ? ' · Inactive' : ''}
            </div>
          </div>
          <span className="status-pill bg-benz-accent/15 text-benz-blue border border-benz-accent/30">
            {technician.appStartLogCount + technician.storyLogCount} logs
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-4 text-sm">
          <div className="benz-list-row p-3">
            <div className="text-xs text-benz-secondary">App starts</div>
            <div className="font-medium mt-1">{technician.appStartLogCount}</div>
          </div>
          <div className="benz-list-row p-3">
            <div className="text-xs text-benz-secondary">Story events</div>
            <div className="font-medium mt-1">{technician.storyLogCount}</div>
          </div>
        </div>
      </div>

      <div className="benz-card p-4">
        <div className="flex items-center gap-2 benz-section-title mb-3">
          <PlayCircle size={14} />
          App Start Logs
        </div>
        {logsLoading ? (
          <div className="text-sm text-benz-secondary">Loading session logs…</div>
        ) : appStartLogs.length === 0 ? (
          <p className="text-xs text-benz-secondary leading-relaxed">
            No app-start logs yet. Logs are recorded when this technician opens Merlin and repair orders
            finish loading.
          </p>
        ) : (
          <div className="space-y-2">
            {appStartLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      <div className="benz-card p-4">
        <div className="flex items-center gap-2 benz-section-title mb-3">
          <ScrollText size={14} />
          Story Activity Logs
        </div>
        {logsLoading ? (
          <div className="text-sm text-benz-secondary">Loading story logs…</div>
        ) : storyLogs.length === 0 ? (
          <p className="text-xs text-benz-secondary leading-relaxed">
            No story logs yet. Generate, score, review, or certify warranty stories to build this
            history.
          </p>
        ) : (
          <div className="space-y-2">
            {storyLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      <div className="benz-card p-4 benz-alert-info border">
        <div className="flex items-center gap-2 text-benz-blue text-sm font-medium mb-2">
          <ClipboardList size={16} />
          Separate from advisor & audit data
        </div>
        <p className="text-xs text-benz-secondary leading-relaxed">
          Technician logs track operational app sessions and story workflow events only. They are stored
          separately from Service Advisor intelligence and the compliance audit hash chain.
        </p>
      </div>
    </div>
  );
}

export function TechniciansView({ onBack }: TechniciansViewProps) {
  const [technicians, setTechnicians] = useState<TechnicianListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TechnicianDetail | null>(null);
  const [appStartLogs, setAppStartLogs] = useState<TechnicianActivityLogEntry[]>([]);
  const [storyLogs, setStoryLogs] = useState<TechnicianActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  const loadTechnicians = useCallback(async () => {
    setLoading(true);
    try {
      const { technicians: list } = await api.listTechnicians();
      setTechnicians(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load technicians');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    setLogsLoading(true);
    try {
      const [{ technician }, { logs: appLogs }, { logs: story }] = await Promise.all([
        api.getTechnician(id),
        api.listTechnicianLogs(id, { category: 'app_start', limit: 50 }),
        api.listTechnicianLogs(id, { category: 'story', limit: 50 }),
      ]);
      setDetail(technician);
      setAppStartLogs(appLogs);
      setStoryLogs(story);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load technician logs');
      setSelectedId(null);
      setDetail(null);
      setAppStartLogs([]);
      setStoryLogs([]);
    } finally {
      setDetailLoading(false);
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTechnicians();
  }, [loadTechnicians]);

  useEffect(() => {
    if (selectedId) {
      loadDetail(selectedId);
    } else {
      setDetail(null);
      setAppStartLogs([]);
      setStoryLogs([]);
    }
  }, [selectedId, loadDetail]);

  const selectedTechnician = technicians.find((t) => t.id === selectedId);

  return (
    <div className="benz-page-compact">
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => {
            if (selectedId) {
              setSelectedId(null);
              return;
            }
            onBack();
          }}
          className="benz-icon-btn -ml-1 touch-target text-benz-blue"
          aria-label="Back"
        >
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="benz-dashboard-eyebrow text-left mb-0.5">Technician Activity</div>
          <h1 className="text-xl font-bold tracking-tight truncate">
            {selectedTechnician ? selectedTechnician.name : 'Technicians'}
          </h1>
          <p className="text-xs text-benz-secondary mt-0.5 leading-snug">
            {selectedTechnician
              ? 'App-start sessions & per-story workflow logs'
              : 'Dedicated logs — separate from advisors and audit trail'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="benz-card p-6 text-sm text-benz-secondary">Loading technicians...</div>
      ) : selectedId ? (
        detailLoading || !detail ? (
          <div className="benz-card p-6 text-sm text-benz-secondary">Loading technician logs...</div>
        ) : (
          <TechnicianDetailPanel
            technician={detail}
            appStartLogs={appStartLogs}
            storyLogs={storyLogs}
            logsLoading={logsLoading}
          />
        )
      ) : technicians.length === 0 ? (
        <BenzEmptyState
          icon={UsersRound}
          title="No technicians found"
          hint="Add technician accounts in Settings. App-start and story logs appear here as they use Merlin."
        />
      ) : (
        <div className="space-y-2.5">
          {technicians.map((tech) => (
            <button key={tech.id} onClick={() => setSelectedId(tech.id)} className="benz-settings-nav">
              <div className="min-w-0 text-left">
                <div className="font-semibold text-sm truncate">
                  {tech.name}
                  {!tech.isActive ? (
                    <span className="text-benz-muted font-normal"> · inactive</span>
                  ) : null}
                </div>
                <div className="text-xs text-benz-secondary mt-1">
                  {tech.d7Number} · {tech.role} · {tech.appStartLogCount} start
                  {tech.appStartLogCount === 1 ? '' : 's'} · {tech.storyLogCount} story
                  {tech.storyLogCount === 1 ? '' : ' logs'}
                </div>
                <div className="text-xs text-benz-muted">
                  {tech.lastActivityAt
                    ? `Last activity ${formatDateTime(tech.lastActivityAt)}`
                    : 'No activity logged yet'}
                </div>
              </div>
              <ChevronRight size={18} className="text-benz-secondary shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}