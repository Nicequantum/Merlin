import { api } from '@/lib/api';
import { clientLog } from '@/lib/clientLog';
import { runDiagnosticOCR } from '@/services/ocr';
import type { ExtractedData, ImageAttachment } from '@/types';
import {
  emptyExtractedData,
  formatExtractionAsOcrText,
  mergeExtracted,
  parseDiagnosticExtraction,
} from '@/utils/diagnosticParser';

export async function analyzeXentryImage(
  file: File,
  attachment: ImageAttachment,
  onProgress: (p: number) => void
): Promise<{ text: string; extracted: Partial<ExtractedData> }> {
  let extracted: Partial<ExtractedData> = {};
  let text = '';

  onProgress(10);
  try {
    const grokData = await api.extractDiagnostics(attachment.pathname);
    extracted = mergeExtracted(emptyExtractedData(), grokData);
    text = formatExtractionAsOcrText(grokData);
    onProgress(50);
  } catch (err) {
    clientLog.warn('Grok diagnostic extraction failed, falling back to OCR', err);
  }

  try {
    const ocrText = await runDiagnosticOCR(file, (p) =>
      onProgress(text ? 50 + Math.round(p * 0.45) : Math.round(p * 0.9))
    );
    if (ocrText.trim()) {
      const ocrExtracted = parseDiagnosticExtraction(ocrText);
      extracted = mergeExtracted(mergeExtracted(emptyExtractedData(), extracted), ocrExtracted);
      text = text ? `${text}\n\n[OCR SUPPLEMENT]\n${ocrText}` : ocrText;
    }
  } catch (err) {
    clientLog.warn('Diagnostic OCR failed for one image', err);
  }

  if (!text.trim()) {
    text = '[No diagnostic text extracted from image]';
  }

  return { text, extracted };
}