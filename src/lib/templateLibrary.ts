import { prisma } from '@/lib/db';
import { getKnowledgeBaseOriginal, listLoadedKnowledgeBaseOriginals } from '@/data/knowledgeBaseOriginals';
import {
  STORY_TEMPLATE_SEEDS,
  toKnowledgeBaseFields,
  toTemplateContent,
  type StoryTemplateSeed,
} from '@/lib/storyTemplateSeed';
import type { RepairLine, RepairOrder } from '@/types';

export async function seedTemplateLibraryIfEmpty(): Promise<{ templates: number; knowledgeBase: number }> {
  const [templateCount, kbCount] = await Promise.all([
    prisma.template.count(),
    prisma.knowledgeBase.count(),
  ]);

  if (templateCount > 0 && kbCount > 0) {
    return { templates: templateCount, knowledgeBase: kbCount };
  }

  for (const seed of STORY_TEMPLATE_SEEDS) {
    const content = toTemplateContent(seed);
    const kb = toKnowledgeBaseFields(seed);

    await prisma.template.upsert({
      where: { title: seed.title },
      update: { category: seed.category, content },
      create: {
        title: seed.title,
        category: seed.category,
        content,
      },
    });

    const userOriginal = getKnowledgeBaseOriginal(seed.title);
    await prisma.knowledgeBase.upsert({
      where: { title: seed.title },
      update: {
        category: kb.category,
        cleanTemplate: kb.cleanTemplate,
        tags: kb.tags,
        ...(userOriginal ? { fullOriginalText: userOriginal } : {}),
      },
      create: kb,
    });
  }

  return {
    templates: await prisma.template.count(),
    knowledgeBase: await prisma.knowledgeBase.count(),
  };
}

export interface TemplateRecord {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: string;
}

export interface KnowledgeBaseRecord {
  id: string;
  title: string;
  category: string;
  fullOriginalText: string;
  cleanTemplate: string;
  tags: string[];
  createdAt: string;
}

export function mapTemplate(row: {
  id: string;
  title: string;
  category: string;
  content: string;
  createdAt: Date;
}): TemplateRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapKnowledgeBase(row: {
  id: string;
  title: string;
  category: string;
  fullOriginalText: string;
  cleanTemplate: string;
  tags: string;
  createdAt: Date;
}): KnowledgeBaseRecord {
  let tags: string[] = [];
  try {
    const parsed = JSON.parse(row.tags);
    tags = Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    fullOriginalText: row.fullOriginalText,
    cleanTemplate: row.cleanTemplate,
    tags,
    createdAt: row.createdAt.toISOString(),
  };
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function scoreKnowledgeEntry(
  entry: KnowledgeBaseRecord,
  haystack: string,
  lineDescription: string
): number {
  let score = 0;
  const titleLower = entry.title.toLowerCase();
  const descLower = lineDescription.toLowerCase();

  if (descLower.includes(titleLower) || titleLower.includes(descLower)) {
    score += 12;
  }

  for (const tag of entry.tags) {
    const tagLower = tag.toLowerCase();
    if (haystack.includes(tagLower)) score += 4;
    if (descLower.includes(tagLower)) score += 6;
  }

  const titleTokens = tokenize(entry.title);
  for (const token of titleTokens) {
    if (haystack.includes(token)) score += 2;
  }

  return score;
}

export function selectRelevantKnowledgeEntries(
  ro: RepairOrder,
  line: RepairLine,
  entries: KnowledgeBaseRecord[],
  limit = 3
): KnowledgeBaseRecord[] {
  const codes = line.extractedData?.codes?.join(' ') || '';
  const haystack = [
    line.description,
    line.customerConcern,
    line.technicianNotes,
    ro.vehicle.make,
    ro.vehicle.model,
    ...(ro.complaints || []),
    codes,
  ]
    .join(' ')
    .toLowerCase();

  return [...entries]
    .filter((entry) => entry.fullOriginalText.trim().length > 0)
    .map((entry) => ({ entry, score: scoreKnowledgeEntry(entry, haystack, line.description) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => item.entry);
}

export function formatKnowledgeBaseForPrompt(entries: KnowledgeBaseRecord[]): string {
  if (entries.length === 0) return '';

  const blocks = entries.map(
    (entry, index) =>
      `### Reference ${index + 1}: ${entry.title} (${entry.category})\nTags: ${entry.tags.join(', ')}\n\nAPPROVED ORIGINAL (style, tone, sequencing — do NOT copy facts unless supported by current line data):\n${entry.fullOriginalText}\n\nCLEAN TEMPLATE SUMMARY:\n${entry.cleanTemplate}`
  );

  return [
    'KNOWLEDGE BASE — APPROVED WARRANTY WRITING STYLE REFERENCES',
    'Use these only for professional phrasing, workflow sequencing, and dealership tone.',
    'Never import codes, measurements, parts, or findings from these references unless the same facts appear in the current repair line data.',
    '',
    ...blocks,
  ].join('\n');
}

export function getSeedPreview(): StoryTemplateSeed[] {
  return STORY_TEMPLATE_SEEDS;
}

export { listLoadedKnowledgeBaseOriginals };