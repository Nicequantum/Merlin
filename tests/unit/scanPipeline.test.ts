import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '@/lib/api';
import { formatScanApiError, isRetriableScanMessage } from '@/lib/scanPipeline';

describe('scan pipeline errors', () => {
  it('surfaces ApiError messages to technicians', () => {
    const message = formatScanApiError(new ApiError('Repair order scan timed out — try again in a moment.', 504), 'fallback');
    assert.equal(message, 'Repair order scan timed out — try again in a moment.');
  });

  it('detects retriable scan messages', () => {
    assert.equal(isRetriableScanMessage('AI service is busy. Wait a moment and try again.'), true);
    assert.equal(isRetriableScanMessage('This photo is not available for processing.'), false);
  });
});