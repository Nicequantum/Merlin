import { ArrowLeft, Camera, Copy, RefreshCw } from 'lucide-react';
import type { RepairLine, RepairOrder } from '../types';
import { getSuggestions } from '../utils/mercedesKb';

interface LineViewProps {
  ro: RepairOrder;
  line: RepairLine;
  isProcessingOCR: boolean;
  ocrProgress: number;
  isGenerating: boolean;
  hasApiKey: boolean;
  onBack: () => void;
  onUpdateLine: (updates: Partial<RepairLine>) => void;
  onAddXentryPhotos: () => void;
  onApplySmartDefaults: () => void;
  onGenerateStory: () => void;
  onCopyStory: (story: string) => void;
}

const letter = (i: number) => String.fromCharCode(65 + i);

export function LineView({
  ro,
  line,
  isProcessingOCR,
  ocrProgress,
  isGenerating,
  hasApiKey,
  onBack,
  onUpdateLine,
  onAddXentryPhotos,
  onApplySmartDefaults,
  onGenerateStory,
  onCopyStory,
}: LineViewProps) {
  const vehicleSummary = [ro.vehicle.year, ro.vehicle.make, ro.vehicle.model].filter(Boolean).join(' ') || 'Vehicle';
  const mileageStr = ro.vehicle.mileageIn ? `${ro.vehicle.mileageIn} mi` : '';
  const suggestions = getSuggestions(ro);

  return (
    <div className="px-5 pt-4 pb-10">
      <button onClick={onBack} className="flex items-center text-[#0a84ff] mb-4">
        <ArrowLeft size={18} className="mr-1" /> Back to RO
      </button>

      <div className="ios-card p-3 mb-4 text-xs">
        <div className="font-semibold mb-0.5">
          {vehicleSummary} {mileageStr ? `• ${mileageStr}` : ''}{' '}
          {ro.vehicle.vin ? `• VIN ${ro.vehicle.vin.slice(0, 10)}...` : ''}
        </div>
        {ro.customer?.name && <div className="text-[#8e8e93]">Customer: {ro.customer.name}</div>}
        {ro.complaints && ro.complaints.length > 0 && (
          <div className="mt-1.5 text-[10px] text-[#8e8e93]">
            Complaints:{' '}
            {ro.complaints.map((c, i) => `${letter(i)}. ${c.slice(0, 42)}${c.length > 42 ? '…' : ''}`).join('  ')}
          </div>
        )}
      </div>

      <div className="mb-5">
        <div className="text-sm text-[#8e8e93]">LINE {line.lineNumber}</div>
        <input
          value={line.description}
          onChange={(e) => onUpdateLine({ description: e.target.value })}
          className="text-xl font-semibold bg-transparent w-full focus:outline-none"
        />
      </div>

      <div className="space-y-5">
        <div>
          <label className="text-xs uppercase tracking-widest text-[#8e8e93] block mb-1.5">CUSTOMER CONCERN (prefilled from scan)</label>
          <textarea
            value={line.customerConcern}
            onChange={(e) => onUpdateLine({ customerConcern: e.target.value })}
            className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-3.5 text-sm min-h-[80px]"
            placeholder="Customer stated..."
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-widest text-[#8e8e93] block mb-1.5">TECHNICIAN NOTES + FINDINGS</label>
          <textarea
            value={line.technicianNotes}
            onChange={(e) => onUpdateLine({ technicianNotes: e.target.value })}
            className="w-full bg-[#1c1c1e] border border-[#38383a] rounded-2xl p-3.5 text-sm min-h-[100px]"
            placeholder="Document actual test results, findings, and repair steps performed..."
          />
        </div>

        <div>
          <div className="text-xs uppercase tracking-widest text-[#8e8e93] mb-1.5">DIAGNOSTIC EVIDENCE PHOTOS</div>
          <button
            onClick={onAddXentryPhotos}
            disabled={isProcessingOCR}
            className="secondary-btn w-full h-12 flex items-center justify-center gap-2 text-sm mb-2"
          >
            <Camera size={18} />
            {isProcessingOCR ? `ANALYZING PHOTOS... ${ocrProgress}%` : 'ADD XENTRY TESTS / FAULT CODES / GUIDED / WIRING / CONTINUITY'}
          </button>
          <p className="text-[10px] text-[#8e8e93] -mt-1 mb-2">
            Photos analyzed with OCR. Only extracted data is used in warranty stories.
          </p>

          {line.xentryImages && line.xentryImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mb-2">
              {line.xentryImages.map((img, idx) => (
                <img
                  key={idx}
                  src={img.dataUrl}
                  className="w-full h-16 object-cover rounded border border-[#38383a]"
                  alt={img.name}
                  onClick={() => window.open(img.dataUrl)}
                />
              ))}
            </div>
          )}
          {line.extractedData &&
            (line.extractedData.codes.length || line.extractedData.guidedTests.length || line.extractedData.measurements.length) > 0 && (
              <div className="text-[10px] bg-[#1c1c1e] p-2 rounded mb-2">
                <div className="font-semibold mb-1">Extracted from photos:</div>
                {line.extractedData.codes.length > 0 && <div>Codes: {line.extractedData.codes.join(', ')}</div>}
                {line.extractedData.guidedTests.length > 0 && (
                  <div>Guided: {line.extractedData.guidedTests.slice(0, 2).join(' | ')}</div>
                )}
                {line.extractedData.measurements.length > 0 && (
                  <div>
                    Meas: {line.extractedData.measurements[0].label}={line.extractedData.measurements[0].value}
                  </div>
                )}
              </div>
            )}
        </div>

        <div className="ios-card p-3 mb-1">
          <div className="flex justify-between items-center mb-1">
            <div className="text-xs uppercase tracking-widest text-[#8e8e93]">REFERENCE: COMMON ISSUES &amp; TYPICAL SPECS</div>
            <button onClick={onApplySmartDefaults} className="text-[10px] px-2 py-0.5 bg-[#2c2c2e] rounded text-[#0a84ff]">
              ADD TO NOTES
            </button>
          </div>
          <div className="text-[10px] text-[#8e8e93]">
            {suggestions.bandNote} — {suggestions.issues.slice(0, 2).join(', ')}... Typical:{' '}
            {suggestions.tests.slice(0, 2).map((t) => t.label).join(' / ')}
          </div>
          <div className="text-[9px] mt-1 text-[#666]">
            Reference only — not used as performed work unless you document actual results in notes or OCR.
          </div>
        </div>

        <div>
          <button
            onClick={onGenerateStory}
            disabled={isGenerating || !hasApiKey}
            className="primary-btn w-full h-14 text-base disabled:opacity-60"
          >
            {isGenerating ? 'GENERATING WITH GROK...' : 'GENERATE WARRANTY STORY (ONE-CLICK)'}
          </button>
          {!hasApiKey && (
            <p className="text-center text-xs text-[#ff9f0a] mt-2">Add xAI Grok API key in Settings (gear) to generate.</p>
          )}
        </div>

        {line.warrantyStory && (
          <div className="story-card p-5 mt-2">
            <div className="text-xs uppercase tracking-[1px] text-[#8e8e93] mb-3">WARRANTY STORY — 3 C&apos;s • AUDIT-SAFE</div>
            <div className="whitespace-pre-line text-[14.5px] leading-relaxed mb-5">{line.warrantyStory}</div>
            <div className="flex gap-3">
              <button
                onClick={() => onCopyStory(line.warrantyStory!)}
                className="flex-1 secondary-btn h-11 flex items-center justify-center gap-2 text-sm"
              >
                <Copy size={16} /> COPY
              </button>
              <button onClick={onGenerateStory} className="secondary-btn h-11 px-5 flex items-center gap-2 text-sm">
                <RefreshCw size={16} /> REGENERATE
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}