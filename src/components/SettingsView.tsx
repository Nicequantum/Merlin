'use client';

import { ArrowLeft, Building2, LogOut, Shield, User } from 'lucide-react';
import { toast } from 'sonner';
import type { TechnicianSession } from '@/types';
import { CONSENT_VERSION } from '@/types';

interface SettingsViewProps {
  session: TechnicianSession;
  onBack: () => void;
  onLogout: () => Promise<void>;
}

export function SettingsView({ session, onBack, onLogout }: SettingsViewProps) {
  const handleLogout = async () => {
    try {
      await onLogout();
      toast.success('Signed out');
    } catch {
      toast.error('Logout failed');
    }
  };

  return (
    <div className="px-5 pt-6 pb-10">
      <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-6">
        <ArrowLeft size={18} className="mr-1" /> Back
      </button>

      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      <div className="ios-card p-5 mb-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-[#2c2c2e] flex items-center justify-center">
            <User size={18} className="text-[#0a84ff]" />
          </div>
          <div>
            <div className="font-semibold">{session.name}</div>
            <div className="text-xs text-[#8e8e93]">{session.email}</div>
            <div className="text-[10px] text-[#666] capitalize">{session.role}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-[#8e8e93]">
          <Building2 size={14} />
          {session.dealershipName}
        </div>
      </div>

      <div className="ios-card p-5 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield size={16} className="text-[#30d158]" />
          <div className="font-semibold text-sm">Security & Compliance</div>
        </div>
        <ul className="text-xs text-[#8e8e93] space-y-2 leading-relaxed">
          <li>✓ Grok API key secured server-side — never in browser</li>
          <li>✓ Customer PII encrypted at rest (AES-256-GCM)</li>
          <li>✓ Session-based technician authentication (12h)</li>
          <li>✓ Audit-safe warranty prompt — no fabricated data</li>
          <li>
            Consent accepted:{' '}
            {session.consentAt ? new Date(session.consentAt).toLocaleDateString() : 'Pending'} (v{CONSENT_VERSION})
          </li>
        </ul>
      </div>

      <div className="ios-card p-5 mb-6">
        <div className="font-semibold mb-1 text-sm">Multi-Technician Access</div>
        <p className="text-xs text-[#8e8e93] leading-relaxed">
          Each technician signs in with their own account. Repair orders are owned by the creating technician. Service
          managers can view all ROs for the dealership. Contact your administrator to provision accounts.
        </p>
      </div>

      <button
        onClick={handleLogout}
        className="w-full secondary-btn h-12 flex items-center justify-center gap-2 text-[#ff9f0a] text-sm font-semibold"
      >
        <LogOut size={16} /> SIGN OUT
      </button>
    </div>
  );
}