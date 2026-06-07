import { useState } from 'react';

export function useOcrProgress() {
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);

  const startOcr = () => {
    setIsProcessingOCR(true);
    setOcrProgress(0);
  };

  const finishOcr = () => {
    setIsProcessingOCR(false);
    setOcrProgress(0);
  };

  return {
    isProcessingOCR,
    ocrProgress,
    setOcrProgress,
    startOcr,
    finishOcr,
  };
}