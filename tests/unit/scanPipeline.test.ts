import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ApiError } from '@/lib/api';
import { GENERIC_ERROR } from '@/lib/errors';
import {
  enrichScannedRepairLinesWithCustomerPayTemplates,
  filterScannedComplaintsForProcessing,
  formatScanApiError,
  isRetriableScanMessage,
  isStrongGrokExtraction,
  matchCustomerPayTemplateFromScanText,
} from '@/lib/scanPipeline';
import { emptyExtractedData } from '@/utils/diagnosticParser';

describe('scan pipeline errors', () => {
  it('surfaces ApiError messages to technicians', () => {
    const message = formatScanApiError(
      new ApiError('Repair order scan timed out — try again in a moment.', 504)
    );
    assert.equal(message, 'Repair order scan timed out — try again in a moment.');
  });

  it('includes HTTP status when server returns generic error text', () => {
    const message = formatScanApiError(new ApiError(GENERIC_ERROR, 500));
    assert.match(message, /HTTP 500/);
    assert.match(message, /Something went wrong/);
  });

  it('prefers server message over fallback', () => {
    const message = formatScanApiError(
      new ApiError('Photo upload failed: storage quota exceeded', 502),
      'ignored fallback'
    );
    assert.equal(message, 'Photo upload failed: storage quota exceeded');
  });

  it('detects retriable scan messages', () => {
    assert.equal(isRetriableScanMessage('AI service is busy. Wait a moment and try again.'), true);
    assert.equal(isRetriableScanMessage('This photo is not available for processing.'), false);
  });

  it('treats Grok output with complaints as strong enough to skip OCR wait', () => {
    assert.equal(
      isStrongGrokExtraction({
        vehicle: { vin: '', year: '', make: '', model: '', engine: '', mileageIn: '', mileageOut: '' },
        complaints: ['Check engine light on'],
        customerName: 'Jane',
        roNumber: '12345',
      }),
      true
    );
  });

  it('requires OCR fallback when Grok returns no complaints and incomplete header', () => {
    assert.equal(isStrongGrokExtraction(null), false);
    assert.equal(
      isStrongGrokExtraction({
        vehicle: { vin: '', year: '', make: '', model: '', engine: '', mileageIn: '', mileageOut: '' },
        complaints: [],
        customerName: '',
        roNumber: '',
      }),
      false
    );
  });
});

describe('scan pipeline service lines', () => {
  it('retains B-service lines for warranty narrative support', () => {
    const filtered = filterScannedComplaintsForProcessing(
      ['Check engine light on', 'Front brake job customer pay'],
      ['A', 'B']
    );
    assert.deepEqual(filtered.complaintLabels, ['A', 'B']);
    assert.equal(filtered.complaints.length, 2);
  });

  it('matches customer pay templates from scanned line text', () => {
    const match = matchCustomerPayTemplateFromScanText('B. Front brake job — rotors and pads');
    assert.equal(match?.templateTitle, 'Front Brake Job');
    assert.match(match?.preWrittenStory ?? '', /^Performed a complete front brake service/);
  });

  it('does not match ambiguous warranty concerns', () => {
    assert.equal(matchCustomerPayTemplateFromScanText('Customer states vibration at highway speed'), null);
  });

  it('applies pre-written narratives only to matching unscanned lines', () => {
    const lines = enrichScannedRepairLinesWithCustomerPayTemplates(
      [
        {
          id: 'line-1',
          lineNumber: 1,
          description: 'A. Check engine light',
          customerConcern: 'Check engine light',
          technicianNotes: '',
          xentryImages: [],
          extractedData: emptyExtractedData(),
        },
        {
          id: 'line-2',
          lineNumber: 2,
          description: 'B. Front brake job',
          customerConcern: 'Front brake job',
          technicianNotes: '',
          xentryImages: [],
          extractedData: emptyExtractedData(),
        },
      ],
      ['Check engine light', 'Front brake job'],
      ['A', 'B']
    );

    assert.equal(lines[0].isCustomerPay, undefined);
    assert.equal(lines[0].warrantyStory, undefined);
    assert.equal(lines[1].isCustomerPay, true);
    assert.match(lines[1].warrantyStory ?? '', /^Performed a complete front brake service/);
  });

  it('does not overwrite an existing warranty story', () => {
    const existingStory = 'Existing warranty narrative.';
    const lines = enrichScannedRepairLinesWithCustomerPayTemplates(
      [
        {
          id: 'line-1',
          lineNumber: 1,
          description: 'B. Front brake job',
          customerConcern: 'Front brake job',
          technicianNotes: '',
          xentryImages: [],
          extractedData: emptyExtractedData(),
          warrantyStory: existingStory,
        },
      ],
      ['Front brake job'],
      ['B']
    );

    assert.equal(lines[0].warrantyStory, existingStory);
    assert.equal(lines[0].isCustomerPay, undefined);
  });
});