import { Camera, Plus, Settings } from 'lucide-react';
import type { PendingImage, RepairOrder } from '../types';

interface HomeViewProps {
  technicianName?: string;
  dealershipName?: string;
  filteredROs: RepairOrder[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  pendingROImages: PendingImage[];
  isProcessingOCR: boolean;
  ocrProgress: number;
  onAddROPhoto: () => void;
  onCreateManualRO: () => void;
  onClearPending: () => void;
  onRemovePending: (index: number) => void;
  onProcessPending: () => void;
  onOpenRO: (ro: RepairOrder) => void;
  onDeleteRO: (id: string) => void;
  onOpenSettings: () => void;
}

export function HomeView({
  technicianName,
  dealershipName,
  filteredROs,
  searchTerm,
  onSearchChange,
  pendingROImages,
  isProcessingOCR,
  ocrProgress,
  onAddROPhoto,
  onCreateManualRO,
  onClearPending,
  onRemovePending,
  onProcessPending,
  onOpenRO,
  onDeleteRO,
  onOpenSettings,
}: HomeViewProps) {
  return (
    <div className="relative min-h-dvh px-4 pt-2 pb-8">
      <button
        onClick={onOpenSettings}
        className="absolute top-4 right-4 p-2 text-[#8e8e93] z-10 touch-target"
        aria-label="Settings"
      >
        <Settings size={22} />
      </button>

      <div className="pt-12">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#0a84ff] to-[#0066cc] flex items-center justify-center mb-3 p-1">
            <img src="/icon-512.png" alt="Benz Tech - Mercedes-Benz" className="w-full h-full rounded-2xl" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tighter">Benz Tech</h1>
            <p className="text-[#8e8e93] text-sm">
              {dealershipName || 'Mercedes-Benz Dealership'} • {technicianName || 'Technician'}
            </p>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            onClick={onAddROPhoto}
            disabled={isProcessingOCR}
            className="primary-btn flex-1 h-12 flex items-center justify-center gap-2 text-sm"
          >
            <Camera size={18} />
            {isProcessingOCR ? `PROCESSING... ${ocrProgress}%` : 'ADD RO PHOTO'}
          </button>
          <button onClick={onCreateManualRO} className="secondary-btn flex-1 h-12 flex items-center justify-center gap-2 text-sm">
            <Plus size={18} /> NEW MANUAL
          </button>
        </div>

        {pendingROImages.length > 0 && (
          <div className="ios-card p-3 mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs uppercase tracking-widest text-[#8e8e93]">
                SELECTED RO PAGES ({pendingROImages.length}) — recommend 2-3 different pages
              </div>
              <button onClick={onClearPending} disabled={isProcessingOCR} className="text-[10px] text-[#ff9f0a]">
                CLEAR
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {pendingROImages.map((img, idx) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.previewUrl}
                    className="w-full h-16 object-cover rounded border border-[#38383a] cursor-pointer"
                    alt={img.name}
                    onClick={() => window.open(img.previewUrl)}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemovePending(idx);
                    }}
                    disabled={isProcessingOCR}
                    className="absolute -top-1 -right-1 bg-[#ff3b30] text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center leading-none"
                    title="Remove page"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button onClick={onProcessPending} disabled={isProcessingOCR} className="primary-btn w-full h-11 text-sm font-semibold">
              {isProcessingOCR ? `PROCESSING ALL IMAGES... ${ocrProgress}%` : 'PROCESS ALL IMAGES'}
            </button>
            <div className="text-center text-[9px] text-[#8e8e93] mt-1">
              Combines pages for accurate first-block extraction (RO#, vehicle, VIN, mileage, complaints A/B/C...)
            </div>
          </div>
        )}

        <div className="text-center text-[10px] text-[#8e8e93] mb-4 -mt-1">
          Add 2-3 RO page photos (tap Add repeatedly or select multiple). Then Process All for reliable extraction of RO# +
          first-block fields + all labeled complaints.
        </div>

        <div className="mb-3">
          <input
            type="text"
            placeholder="Search past ROs (number, model, VIN)..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-xl px-4 py-2.5 text-sm placeholder-[#8e8e93]"
          />
        </div>

        {filteredROs.length === 0 ? (
          <div className="text-center py-10 text-[#8e8e93]">
            <p>No past ROs yet.</p>
            <p className="text-xs mt-1">Scan your first repair order above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredROs.map((ro) => (
              <div
                key={ro.id}
                onClick={() => onOpenRO(ro)}
                className="ios-card p-3 active:bg-[#252528] cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold text-sm">{ro.roNumber}</div>
                    <div className="text-xs text-[#8e8e93]">
                      {[ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(' ')} • {ro.repairLines.length} lines
                      {ro.technicianName ? ` • ${ro.technicianName}` : ''}
                    </div>
                  <div className="text-[10px] text-[#8e8e93] mt-0.5">{ro.complaints[0]?.slice(0, 60)}...</div>
                  <div className="text-[9px] text-[#666]">{ro.createdAt ? new Date(ro.createdAt).toLocaleDateString() : ''}</div>
                </div>
                <div className="text-right">
                  {ro.repairLines.some((l) => l.warrantyStory) && <div className="text-[10px] text-[#30d158]">✓ stories</div>}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteRO(ro.id);
                    }}
                    className="text-[10px] text-[#ff9f0a] mt-1"
                  >
                    DEL
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}