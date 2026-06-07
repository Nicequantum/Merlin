'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Download, ScrollText, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, type TechnicianUser } from '@/lib/api';
import type { AuditDashboardSummary, AuditLogEntry, TechnicianSession } from '@/types';
import { AUDIT_ACTIONS } from '@/types';

interface AuditLogViewProps {
  session: TechnicianSession;
  onBack: () => void;
}

export function AuditLogView({ session, onBack }: AuditLogViewProps) {
  const [users, setUsers] = useState<TechnicianUser[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [summary, setSummary] = useState<AuditDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [technicianId, setTechnicianId] = useState('');
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const loadUsers = useCallback(async () => {
    try {
      const { users: list } = await api.listUsers();
      setUsers(list);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load technicians');
    }
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      const data = await api.getAuditSummary();
      setSummary(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit summary');
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const { logs: entries } = await api.listAuditLogs({
        technicianId: technicianId || undefined,
        action: action || undefined,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      });
      setLogs(entries);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [technicianId, action, from, to]);

  useEffect(() => {
    if (session.role === 'manager') {
      loadUsers();
      loadSummary();
    }
  }, [session.role, loadUsers, loadSummary]);

  useEffect(() => {
    if (session.role === 'manager') {
      loadLogs();
    }
  }, [session.role, loadLogs]);

  const handleExport = () => {
    const url = api.exportAuditLogsCsv({
      technicianId: technicianId || undefined,
      action: action || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to).toISOString() : undefined,
    });
    window.open(url, '_blank');
  };

  if (session.role !== 'manager') {
    return (
      <div className="px-5 pt-6 pb-10">
        <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-6">
          <ArrowLeft size={18} className="mr-1" /> Back
        </button>
        <p className="text-sm text-[#8e8e93]">Manager access required.</p>
      </div>
    );
  }

  const chain = summary?.chain;

  return (
    <div className="px-5 pt-6 pb-10">
      <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-6">
        <ArrowLeft size={18} className="mr-1" /> Back
      </button>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ScrollText size={20} className="text-[#0a84ff]" />
          <h2 className="text-2xl font-semibold">Audit Log</h2>
        </div>
        <button onClick={handleExport} className="secondary-btn h-10 px-4 flex items-center gap-2 text-xs">
          <Download size={14} /> CSV
        </button>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="stat-card p-3 text-center">
            <div className="text-lg font-semibold">{summary.totalEntries}</div>
            <div className="text-[10px] text-[#8e8e93] uppercase">Total</div>
          </div>
          <div className="stat-card p-3 text-center">
            <div className="text-lg font-semibold">{summary.last24Hours}</div>
            <div className="text-[10px] text-[#8e8e93] uppercase">24 Hours</div>
          </div>
          <div className="stat-card p-3 text-center">
            <div className="text-lg font-semibold">{summary.last7Days}</div>
            <div className="text-[10px] text-[#8e8e93] uppercase">7 Days</div>
          </div>
        </div>
      )}

      {chain && (
        <div className="ios-card p-4 mb-4 border-l-4 border-l-[#0a84ff]">
          <div className="flex items-start gap-2 mb-2">
            <ShieldCheck size={16} className={chain.valid ? 'text-[#30d158] mt-0.5' : 'text-[#ff9f0a] mt-0.5'} />
            <div>
              <div className="font-semibold text-sm">
                Tamper-evident hash chain — {chain.valid ? 'integrity verified' : 'integrity check failed'}
              </div>
              <p className="text-xs text-[#8e8e93] mt-1 leading-relaxed">{chain.description}</p>
            </div>
          </div>
          <ul className="text-[10px] text-[#666] space-y-1 mt-3 list-disc pl-4">
            {chain.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {chain.headHash && (
            <div className="text-[10px] text-[#8e8e93] font-mono mt-3 break-all">Chain head: {chain.headHash.slice(0, 24)}…</div>
          )}
        </div>
      )}

      {summary && summary.actionCounts.length > 0 && (
        <div className="ios-card p-4 mb-4">
          <div className="text-xs uppercase tracking-widest text-[#8e8e93] mb-3">Top Actions (7 days)</div>
          <div className="space-y-2">
            {summary.actionCounts.slice(0, 6).map((item) => (
              <div key={item.action} className="flex justify-between text-sm">
                <span className="text-[#c7c7cc]">{item.action}</span>
                <span className="text-[#8e8e93]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="ios-card p-4 mb-4 grid grid-cols-1 gap-3">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={technicianId}
            onChange={(e) => setTechnicianId(e.target.value)}
            className="bg-[#1c1c1e] rounded px-3 py-2 text-sm"
          >
            <option value="">All technicians</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="bg-[#1c1c1e] rounded px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            {AUDIT_ACTIONS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="datetime-local"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="bg-[#1c1c1e] rounded px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="bg-[#1c1c1e] rounded px-3 py-2 text-sm"
          />
        </div>
        <button onClick={loadLogs} className="primary-btn h-10 text-sm">
          APPLY FILTERS
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 text-sm text-[#8e8e93]">
          <div className="loading-spinner w-5 h-5" aria-hidden="true" />
          Loading audit entries...
        </div>
      ) : logs.length === 0 ? (
        <div className="text-sm text-[#8e8e93]">No audit entries match your filters.</div>
      ) : (
        <div className="space-y-2">
          {logs.map((log) => (
            <div key={log.id} className="ios-card p-3">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="text-sm font-semibold">{log.action}</div>
                  <div className="text-[10px] text-[#8e8e93] mt-1">
                    {log.technicianName || 'System'} · {new Date(log.createdAt).toLocaleString()}
                  </div>
                  {(log.entityType || log.entityId) && (
                    <div className="text-[10px] text-[#666] mt-1">
                      {log.entityType || 'entity'} {log.entityId || ''}
                    </div>
                  )}
                  {log.entryHash && (
                    <div className="text-[9px] text-[#555] font-mono mt-1">hash {log.entryHash.slice(0, 16)}…</div>
                  )}
                </div>
                {log.ipAddress && <div className="text-[10px] text-[#666] font-mono">{log.ipAddress}</div>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}