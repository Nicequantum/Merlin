import { useCallback, useEffect, useState } from 'react';
import { extractVehicleAndComplaintsWithGrok, generateWarrantyStoryWithGrok } from '../services/grokApi';
import { preprocessImageForOCR, runOCR } from '../services/ocr';
import { deleteROFromDB, loadAllROs, saveROToDB } from '../services/storage';
import type { AppView, ExtractedData, ImageAttachment, RepairLine, RepairOrder } from '../types';
import { emptyExtractedData, mergeExtracted, parseDiagnosticText } from '../utils/diagnosticParser';
import { dataUrlToFile, fileToDataUrl } from '../utils/fileHelpers';
import { getSuggestions } from '../utils/mercedesKb';
import { createManualRepairOrder, createNewRepairLine, createRepairOrderFromScan } from '../utils/repairOrderFactory';
import {
  extractComplaints,
  extractCustomerName,
  extractRoNumberFromText,
  extractVehicleDetails,
  sanitizeComplaints,
  sanitizeVehicle,
} from '../utils/roExtractor';

interface UseRepairOrdersOptions {
  apiKey: string;
  onOcrStart: () => void;
  onOcrFinish: () => void;
  setOcrProgress: (p: number) => void;
}

export function useRepairOrders({ apiKey, onOcrStart, onOcrFinish, setOcrProgress }: UseRepairOrdersOptions) {
  const [view, setView] = useState<AppView>('home');
  const [currentRO, setCurrentRO] = useState<RepairOrder | null>(null);
  const [currentLineId, setCurrentLineId] = useState<string | null>(null);
  const [allROs, setAllROs] = useState<RepairOrder[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [pendingROImages, setPendingROImages] = useState<ImageAttachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadAllROs().then(setAllROs);
  }, []);

  const saveRO = useCallback((ro: RepairOrder | null) => {
    if (ro) {
      saveROToDB(ro);
      setAllROs((prev) => {
        const idx = prev.findIndex((r) => r.id === ro.id);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = ro;
          return copy;
        }
        return [ro, ...prev];
      });
    }
    setCurrentRO(ro);
  }, []);

  const getLatestRO = useCallback(
    (ro?: RepairOrder | null) => {
      const id = ro?.id || currentRO?.id;
      if (!id) return ro || currentRO;
      return allROs.find((r) => r.id === id) || ro || currentRO;
    },
    [allROs, currentRO]
  );

  const deleteRO = useCallback(
    async (id: string) => {
      if (!confirm('Delete this RO and all its data?')) return;
      await deleteROFromDB(id);
      setAllROs((prev) => prev.filter((r) => r.id !== id));
      if (currentRO?.id === id) {
        setCurrentRO(null);
        setCurrentLineId(null);
        setView('home');
      }
    },
    [currentRO]
  );

  const openRO = useCallback((ro: RepairOrder) => {
    setCurrentRO(ro);
    setCurrentLineId(null);
    setView('ro');
  }, []);

  const createROFromText = useCallback(
    (text: string) => {
      const roNumber = extractRoNumberFromText(text);
      const vehicle = sanitizeVehicle(extractVehicleDetails(text));
      const complaints = sanitizeComplaints(extractComplaints(text));
      const custName = extractCustomerName(text);
      const newRO = createRepairOrderFromScan({ roNumber, vehicle, customerName: custName, complaints });
      saveRO(newRO);
      setView('ro');
    },
    [saveRO]
  );

  const createROFromExtracted = useCallback(
    (extracted: { vehicle: RepairOrder['vehicle']; complaints: string[]; customerName: string; roNumber?: string }) => {
      const newRO = createRepairOrderFromScan({
        roNumber: extracted.roNumber || `R-${Date.now().toString().slice(-6)}`,
        vehicle: sanitizeVehicle(extracted.vehicle),
        customerName: extracted.customerName,
        complaints: sanitizeComplaints(extracted.complaints || []),
      });
      saveRO(newRO);
      setView('ro');
    },
    [saveRO]
  );

  const addROPhoto = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.setAttribute('capture', 'environment');
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      const newImgs: ImageAttachment[] = [];
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        newImgs.push({
          id: 'roimg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
          dataUrl,
          name: file.name || `page-${newImgs.length + 1}.jpg`,
        });
      }
      setPendingROImages((prev) => [...prev, ...newImgs]);
    };
    input.click();
  }, []);

  const processPendingROImages = useCallback(async () => {
    if (pendingROImages.length === 0) return;
    onOcrStart();
    try {
      const dataUrls = pendingROImages.map((img) => img.dataUrl);
      if (apiKey) {
        setOcrProgress(20);
        const extracted = await extractVehicleAndComplaintsWithGrok(dataUrls, apiKey);
        setOcrProgress(90);
        createROFromExtracted(extracted);
      } else {
        let combinedText = '';
        for (let i = 0; i < pendingROImages.length; i++) {
          const img = pendingROImages[i];
          const file = await dataUrlToFile(img.dataUrl, img.name);
          const preprocessed = await preprocessImageForOCR(file);
          const text = await runOCR(preprocessed, (p) =>
            setOcrProgress(Math.round((i / pendingROImages.length) * 80 + (p / pendingROImages.length) * 80 * 0.2))
          );
          combinedText += `\n\n=== PAGE ${i + 1} ===\n` + text;
        }
        setOcrProgress(95);
        createROFromText(combinedText);
      }
      setPendingROImages([]);
    } catch (error) {
      console.error('Multi-image RO extraction error', error);
      alert('Processing images failed. Try fewer images or add your Grok key in Settings for reliable vision OCR.');
    } finally {
      onOcrFinish();
    }
  }, [apiKey, pendingROImages, createROFromExtracted, createROFromText, onOcrStart, onOcrFinish, setOcrProgress]);

  const createManualRO = useCallback(() => {
    saveRO(createManualRepairOrder());
    setView('ro');
  }, [saveRO]);

  const updateLine = useCallback(
    (lineId: string, updates: Partial<RepairLine>) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      const updatedLines = latestRO.repairLines.map((line) => (line.id === lineId ? { ...line, ...updates } : line));
      saveRO({ ...latestRO, repairLines: updatedLines });
    },
    [getLatestRO, saveRO]
  );

  const updateVehicle = useCallback(
    (updates: Partial<RepairOrder['vehicle']>) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      saveRO({ ...latestRO, vehicle: { ...latestRO.vehicle, ...updates } });
    },
    [getLatestRO, saveRO]
  );

  const updateCustomer = useCallback(
    (name: string) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      saveRO({ ...latestRO, customer: { ...latestRO.customer, name } });
    },
    [getLatestRO, saveRO]
  );

  const updateComplaints = useCallback(
    (newComplaints: string[]) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      let updatedLines = latestRO.repairLines;
      if (newComplaints.length > 0) {
        const oldFirst = latestRO.complaints[0] || '';
        updatedLines = latestRO.repairLines.map((l, idx) => {
          if (idx === 0 && (!l.customerConcern || l.customerConcern === oldFirst)) {
            return { ...l, customerConcern: newComplaints[0] || '' };
          }
          return l;
        });
      }
      saveRO({ ...latestRO, complaints: newComplaints, repairLines: updatedLines });
    },
    [getLatestRO, saveRO]
  );

  const addComplaint = useCallback(() => {
    const latestRO = getLatestRO();
    if (!latestRO) return;
    updateComplaints([...(latestRO.complaints || []), 'New concern - describe symptom']);
  }, [getLatestRO, updateComplaints]);

  const removeComplaint = useCallback(
    (index: number) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      updateComplaints((latestRO.complaints || []).filter((_, i) => i !== index));
    },
    [getLatestRO, updateComplaints]
  );

  const editComplaint = useCallback(
    (index: number, value: string) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      const updated = [...(latestRO.complaints || [])];
      updated[index] = value;
      updateComplaints(updated);
    },
    [getLatestRO, updateComplaints]
  );

  const updateRONumber = useCallback(
    (roNumber: string) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      saveRO({ ...latestRO, roNumber: roNumber.trim() });
    },
    [getLatestRO, saveRO]
  );

  const addRepairLine = useCallback(() => {
    const latestRO = getLatestRO();
    if (!latestRO) return;
    const newLine = createNewRepairLine(latestRO.repairLines.length + 1);
    const updated = { ...latestRO, repairLines: [...latestRO.repairLines, newLine] };
    saveRO(updated);
    setCurrentLineId(newLine.id);
    setView('line');
  }, [getLatestRO, saveRO]);

  const applySmartDefaultsToLine = useCallback(
    (lineId: string) => {
      const latestRO = getLatestRO();
      if (!latestRO) return;
      const line = latestRO.repairLines.find((l) => l.id === lineId);
      if (!line) return;

      const sugg = getSuggestions(latestRO);
      let notes = (line.technicianNotes || '').trim();
      const addBlock = `\n\n[Reference only — not performed unless documented]\n[Smart defaults for ${sugg.bandNote}]\nCommon issues at this mileage: ${sugg.issues.join(' • ')}\nTypical spec references: ${sugg.tests.map((t) => `${t.label}: ${t.spec}${t.note ? ' (' + t.note + ')' : ''}`).join('; ')}`;

      if (!notes.includes('Smart defaults')) {
        notes = (notes + addBlock).trim();
      }

      const updatedLines = latestRO.repairLines.map((l) =>
        l.id === lineId ? { ...l, technicianNotes: notes } : l
      );
      saveRO({ ...latestRO, repairLines: updatedLines });
    },
    [getLatestRO, saveRO]
  );

  const processXentryImages = useCallback(
    async (
      files: File[],
      existingImages: ImageAttachment[],
      existingOcr: string[],
      existingExtracted: ExtractedData
    ) => {
      let updatedExtracted = existingExtracted;
      let updatedOcrTexts = existingOcr;
      const newImgs: ImageAttachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await fileToDataUrl(file);
        newImgs.push({ id: 'ximg-' + Date.now() + i, dataUrl, name: file.name });
        try {
          const pre = await preprocessImageForOCR(file);
          const text = await runOCR(pre, (p) => setOcrProgress(Math.round(((i + p) / files.length) * 100)));
          const diag = parseDiagnosticText(text);
          updatedExtracted = mergeExtracted(updatedExtracted, diag);
          updatedOcrTexts = [...updatedOcrTexts, text];
        } catch (err) {
          console.warn('Xentry OCR failed for one image', err);
        }
      }

      return {
        newImgs,
        updatedExtracted,
        updatedOcrTexts,
        allImages: [...existingImages, ...newImgs],
      };
    },
    [setOcrProgress]
  );

  const addXentryPhotos = useCallback(
    async (lineId: string) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = true;
      input.setAttribute('capture', 'environment');
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        if (files.length === 0 || !currentRO) return;

        onOcrStart();
        const latestRO = getLatestRO();
        const lineForExtract = latestRO?.repairLines.find((l) => l.id === lineId);
        if (!latestRO || !lineForExtract) {
          onOcrFinish();
          return;
        }

        const result = await processXentryImages(
          files,
          lineForExtract.xentryImages || [],
          lineForExtract.xentryOcrTexts || [],
          lineForExtract.extractedData || emptyExtractedData()
        );

        const updatedLines = latestRO.repairLines.map((l) =>
          l.id === lineId
            ? {
                ...l,
                xentryImages: result.allImages,
                xentryOcrTexts: result.updatedOcrTexts,
                extractedData: result.updatedExtracted,
              }
            : l
        );
        saveRO({ ...latestRO, repairLines: updatedLines });
        onOcrFinish();

        const updatedLine = updatedLines.find((l) => l.id === lineId);
        if (updatedLine && (!updatedLine.technicianNotes || updatedLine.technicianNotes.trim().length < 5)) {
          setTimeout(() => applySmartDefaultsToLine(lineId), 60);
        }
        alert(`${files.length} diagnostic photo(s) added and analyzed.`);
      };
      input.click();
    },
    [currentRO, getLatestRO, processXentryImages, saveRO, onOcrStart, onOcrFinish, applySmartDefaultsToLine]
  );

  const addROXentryPhotos = useCallback(async () => {
    if (!currentRO) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    input.setAttribute('capture', 'environment');
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0 || !currentRO) return;

      onOcrStart();
      const latestRO = getLatestRO();
      if (!latestRO) {
        onOcrFinish();
        return;
      }

      const firstLine = latestRO.repairLines[0];
      const result = await processXentryImages(
        files,
        latestRO.xentryImages || [],
        latestRO.xentryOcrTexts || [],
        firstLine?.extractedData || emptyExtractedData()
      );

      let updatedLines = latestRO.repairLines;
      if (firstLine) {
        updatedLines = latestRO.repairLines.map((l, idx) =>
          idx === 0
            ? {
                ...l,
                xentryImages: [...(l.xentryImages || []), ...result.newImgs],
                xentryOcrTexts: result.updatedOcrTexts,
                extractedData: result.updatedExtracted,
              }
            : l
        );
      }

      saveRO({
        ...latestRO,
        xentryImages: result.allImages,
        xentryOcrTexts: result.updatedOcrTexts,
        repairLines: updatedLines,
      });
      onOcrFinish();
      alert(`${files.length} Xentry saved data photo(s) added and analyzed.`);
    };
    input.click();
  }, [currentRO, getLatestRO, processXentryImages, saveRO, onOcrStart, onOcrFinish]);

  const generateStory = useCallback(
    async (lineId: string, key: string, hasEncryptedKey: boolean, isUnlocked: boolean, onNeedSettings: () => void) => {
      if (!currentRO || !key) {
        if (hasEncryptedKey && !isUnlocked) {
          alert('Unlock your encrypted xAI key in Settings using your passphrase.');
        } else {
          alert('Please enter / unlock your xAI Grok API key in Settings (gear icon).');
        }
        onNeedSettings();
        return;
      }

      const latestRO = getLatestRO();
      if (!latestRO) return;
      const line = latestRO.repairLines.find((l) => l.id === lineId);
      if (!line) return;

      setIsGenerating(true);
      try {
        let historyContext = '';
        const similar = allROs
          .filter(
            (r) =>
              r.id !== latestRO.id &&
              r.vehicle.model &&
              latestRO.vehicle.model &&
              (r.vehicle.model.toLowerCase().includes(latestRO.vehicle.model.toLowerCase().split(' ')[0]) ||
                (r.vehicle.make &&
                  latestRO.vehicle.make &&
                  r.vehicle.make.toLowerCase() === latestRO.vehicle.make.toLowerCase()))
          )
          .slice(0, 2);
        if (similar.length > 0) {
          historyContext =
            '\n\nFor writing style reference only (do NOT copy facts from these — use only current line data):\n' +
            similar
              .map((r) =>
                r.repairLines
                  .filter((l) => l.warrantyStory)
                  .map((l) => `For ${l.description}: ${l.warrantyStory!.substring(0, 250)}...`)
                  .join('\n')
              )
              .join('\n---\n');
        }

        const story = await generateWarrantyStoryWithGrok(latestRO, line, key, historyContext);
        const updatedLines = latestRO.repairLines.map((l) => (l.id === lineId ? { ...l, warrantyStory: story } : l));
        saveRO({ ...latestRO, repairLines: updatedLines });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Check your API key and internet connection.';
        alert('Failed to generate story: ' + message);
      } finally {
        setIsGenerating(false);
      }
    },
    [allROs, currentRO, getLatestRO, saveRO]
  );

  const copyStory = useCallback((story: string) => {
    navigator.clipboard.writeText(story);
    alert('Copied to clipboard!');
  }, []);

  const currentLine = currentRO?.repairLines.find((l) => l.id === currentLineId);

  const filteredROs = allROs
    .filter(
      (ro) =>
        ro.roNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (ro.vehicle.make && ro.vehicle.make.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ro.vehicle.model && ro.vehicle.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (ro.vehicle.year && ro.vehicle.year.includes(searchTerm)) ||
        (ro.vehicle.vin && ro.vehicle.vin.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => ((b.createdAt || '0') > (a.createdAt || '0') ? 1 : -1));

  return {
    view,
    setView,
    currentRO,
    setCurrentRO,
    currentLineId,
    setCurrentLineId,
    currentLine,
    allROs,
    searchTerm,
    setSearchTerm,
    pendingROImages,
    setPendingROImages,
    isGenerating,
    filteredROs,
    saveRO,
    getLatestRO,
    deleteRO,
    openRO,
    addROPhoto,
    processPendingROImages,
    createManualRO,
    updateLine,
    updateVehicle,
    updateCustomer,
    addComplaint,
    removeComplaint,
    editComplaint,
    updateRONumber,
    addRepairLine,
    applySmartDefaultsToLine,
    addXentryPhotos,
    addROXentryPhotos,
    generateStory,
    copyStory,
  };
}