import { ArrowLeft } from 'lucide-react';

interface SettingsViewProps {
  apiKey: string;
  passphrase: string;
  hasEncryptedKey: boolean;
  isUnlocked: boolean;
  onBack: () => void;
  onApiKeyChange: (value: string) => void;
  onPassphraseChange: (value: string) => void;
  onUnlock: () => void;
  onSaveKey: () => void;
  onClearKeys: () => void;
}

export function SettingsView({
  apiKey,
  passphrase,
  hasEncryptedKey,
  isUnlocked,
  onBack,
  onApiKeyChange,
  onPassphraseChange,
  onUnlock,
  onSaveKey,
  onClearKeys,
}: SettingsViewProps) {
  return (
    <div className="px-5 pt-6">
      <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-6">
        <ArrowLeft size={18} className="mr-1" /> Back
      </button>

      <h2 className="text-2xl font-semibold mb-6">Settings</h2>

      <div className="ios-card p-5 mb-6">
        <div className="font-semibold mb-1">xAI Grok API Key (encrypted storage)</div>
        <div className="text-[10px] text-[#8e8e93] mb-3">Key never stored in plain text. Uses AES-GCM encryption with your passphrase.</div>

        {hasEncryptedKey && !isUnlocked && (
          <div className="mb-4 p-3 bg-[#2c2c2e] rounded-xl">
            <div className="text-sm mb-2">Encrypted key detected. Enter passphrase to unlock for this session:</div>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => onPassphraseChange(e.target.value)}
              placeholder="Your encryption passphrase"
              className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-xl p-3 text-sm mb-2"
            />
            <button onClick={onUnlock} className="primary-btn w-full h-10 text-sm">
              UNLOCK KEY
            </button>
          </div>
        )}

        <div>
          <label className="text-xs text-[#8e8e93] mb-1 block">API KEY (xai-...)</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            placeholder="xai-yourkeyhere"
            className="w-full bg-[#2c2c2e] border border-[#444] rounded-xl p-3.5 font-mono text-sm mb-3"
          />
        </div>

        <div>
          <label className="text-xs text-[#8e8e93] mb-1 block">PASSPHRASE (for encryption - remember this!)</label>
          <input
            type="password"
            value={passphrase}
            onChange={(e) => onPassphraseChange(e.target.value)}
            placeholder="Strong passphrase to encrypt key"
            className="w-full bg-[#2c2c2e] border border-[#444] rounded-xl p-3.5 text-sm mb-3"
          />
        </div>

        <div className="flex gap-3">
          <button onClick={onSaveKey} className="flex-1 secondary-btn h-11">
            SAVE ENCRYPTED KEY
          </button>
          <button onClick={onClearKeys} className="secondary-btn h-11 px-6 text-[#ff9f0a]">
            CLEAR ALL
          </button>
        </div>
        <p className="text-xs text-[#8e8e93] mt-3 leading-snug">
          Get key at <span className="underline">console.x.ai</span>. Encrypted with passphrase using Web Crypto (AES-GCM + 150k
          PBKDF2). Passphrase required on each app restart if key is encrypted. The key also enables premium Grok vision OCR for
          the initial RO scan.
        </p>
        {isUnlocked && <div className="text-[10px] text-[#30d158] mt-2">✓ Key unlocked in memory for this session.</div>}
      </div>

      <div className="text-xs text-[#8e8e93] px-1 leading-relaxed">
        Warranty stories use an audit-safe prompt: only documented data from your RO, notes, and diagnostic photos. Missing
        information is marked [NOT DOCUMENTED] or [NOT PROVIDED] — never fabricated. Temperature 0.25 for factual, professional
        writing with strong 3 C&apos;s structure.
      </div>
    </div>
  );
}