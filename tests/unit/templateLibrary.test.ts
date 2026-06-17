import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { STORY_TEMPLATE_SEEDS } from '@/lib/storyTemplateSeed';
import {
  formatKnowledgeBaseForPrompt,
  selectRelevantKnowledgeEntries,
  type KnowledgeBaseRecord,
} from '@/lib/templateLibrary';
import type { RepairLine, RepairOrder } from '@/types';

function kbFromSeed(title: string): KnowledgeBaseRecord {
  const seed = STORY_TEMPLATE_SEEDS.find((s) => s.title === title)!;
  return {
    id: `kb-${title}`,
    title: seed.title,
    category: seed.category,
    fullOriginalText: seed.fullDetail,
    cleanTemplate: seed.complaint,
    tags: seed.tags,
    createdAt: new Date().toISOString(),
  };
}

const baseRo: RepairOrder = {
  id: 'ro-1',
  roNumber: 'R-100',
  vehicle: {
    vin: 'WDD123',
    year: '2022',
    make: 'Mercedes-Benz',
    model: 'GLE 450',
    mileageIn: '42000',
    mileageOut: '',
  },
  customer: { name: 'Test' },
  complaints: ['Blind spot warning on'],
  repairLines: [],
};

const baseLine: RepairLine = {
  id: 'line-1',
  lineNumber: 1,
  description: 'Blind Spot Assist Warning repair',
  customerConcern: 'Blind spot assist fault message',
  technicianNotes: '',
  xentryImages: [],
};

describe('story template seed data', () => {
  it('includes 3 customer pay and 22 warranty templates', () => {
    const customer = STORY_TEMPLATE_SEEDS.filter((s) => s.category === 'customer');
    const warranty = STORY_TEMPLATE_SEEDS.filter((s) => s.category === 'warranty');
    assert.equal(customer.length, 3);
    assert.equal(warranty.length, 22);
    assert.equal(STORY_TEMPLATE_SEEDS.length, 25);
  });

  it('uses unique titles', () => {
    const titles = STORY_TEMPLATE_SEEDS.map((s) => s.title);
    assert.equal(new Set(titles).size, titles.length);
  });
});

describe('knowledge base selection', () => {
  it('ranks blind spot template for matching line description', () => {
    const entries = [
      kbFromSeed('Blind Spot Assist Warning'),
      kbFromSeed('B Service'),
      kbFromSeed('Cylinder Head Failure'),
    ];
    const selected = selectRelevantKnowledgeEntries(baseRo, baseLine, entries, 2);
    assert.equal(selected[0]?.title, 'Blind Spot Assist Warning');
  });

  it('formats knowledge base prompt with style guardrails', () => {
    const prompt = formatKnowledgeBaseForPrompt([kbFromSeed('B Service')]);
    assert.match(prompt, /KNOWLEDGE BASE/);
    assert.match(prompt, /B Service/);
    assert.match(prompt, /do NOT copy facts/i);
  });
});