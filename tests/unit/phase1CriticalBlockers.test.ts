import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { CRITICAL_AUDIT_ACTIONS } from '@/lib/audit';
import { buildRoExtractAuditMetadata } from '@/lib/roExtractAudit';
import { assessRoExtractionQuality } from '@/lib/scanPipeline';
import type { StructuredROExtraction } from '@/types';

const root = resolve(process.cwd());

function readSrc(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('Phase 1 critical blockers', () => {
  it('registers ro.extract as a critical audit action', () => {
    assert.ok(CRITICAL_AUDIT_ACTIONS.has('ro.extract'));
  });

  it('ro.extract audit metadata contains no PII fields', () => {
    const extracted: StructuredROExtraction = {
      roNumber: 'RO-12345',
      customerName: 'Jane Customer',
      complaints: ['Check engine light on'],
      complaintLabels: ['A'],
      vehicle: { vin: 'WDDWF4KB0FR123456', year: '2019', make: 'Mercedes-Benz', model: 'C300' },
    };
    const meta = buildRoExtractAuditMetadata({
      pageCount: 2,
      durationMs: 4500,
      extracted,
    });

    assert.equal(meta.pageCount, 2);
    assert.equal(meta.durationMs, 4500);
    assert.equal(meta.success, true);
    assert.equal(meta.complaintCount, 1);
    assert.equal(typeof meta.pathnameDigest, 'string');
    assert.equal('customerName' in meta, false);
    assert.equal('vin' in meta, false);
    assert.equal('complaints' in meta, false);
    assert.equal('roNumber' in meta, false);
  });

  it('assessRoExtractionQuality classifies strong extractions without exposing PII', () => {
    const strong = assessRoExtractionQuality({
      roNumber: '771234',
      customerName: 'Hidden',
      complaints: ['State inspection'],
      vehicle: { vin: 'WDDZF8EB5MA123456', year: '2021', make: 'Mercedes-Benz', model: 'E350' },
    });
    assert.equal(strong.extractionStrength, 'strong');
    assert.equal(strong.complaintCount, 1);
    assert.equal(strong.hasVin17, true);
  });

  it('story AI routes persist audit and DB update in a single transaction', () => {
    for (const route of [
      'src/app/api/repair-orders/[id]/lines/[lineId]/generate-story/route.ts',
      'src/app/api/repair-orders/[id]/lines/[lineId]/score-story/route.ts',
      'src/app/api/repair-orders/[id]/lines/[lineId]/review-story/route.ts',
    ]) {
      const src = readSrc(route);
      assert.match(src, /prisma\.\$transaction/);
      assert.match(src, /persistRepairLineStoryInTransaction/);
      assert.equal(src.includes('writeAuditLog({'), false, `${route} should not call writeAuditLog directly`);
    }
  });

  it('certify-story evaluates gate inside transaction with row lock', () => {
    const src = readSrc('src/app/api/repair-orders/[id]/lines/[lineId]/certify-story/route.ts');
    assert.match(src, /lockRepairLineForCertification/);
    assert.match(src, /validateStoryCertificationPrerequisitesInTransaction/);
    assert.match(src, /StoryCertificationGateError/);
    assert.equal(src.includes('validateStoryCertificationPrerequisites({'), false);
  });

  it('extract route writes critical ro.extract audit after successful scan', () => {
    const src = readSrc('src/app/api/repair-orders/extract/route.ts');
    assert.match(src, /writeRoExtractAudit/);
    assert.match(src, /extractStartedAt/);
  });
});