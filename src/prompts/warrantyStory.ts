import type { RepairLine, RepairOrder } from '../types';
import { formatExtractedDataForPrompt } from '@/utils/diagnosticParser';
import { MI_AUDIT_GUIDELINES, MI_GENERATION_STYLE_RULES } from './miAuditGuidelines';
import { STYLE_VARIATION_SYSTEM_RULES, buildStoryStyleVariationBlock } from './storyStyleVariation';
import { PROMPT_VERSION, getDealershipPromptRules } from './version';

/** Slightly lower than 0.25 — faster sampling while style-variation block preserves uniqueness. */
export const WARRANTY_STORY_TEMPERATURE = 0.2;

/** Typical warranty stories are 400–900 tokens; cap output to reduce latency. */
export const WARRANTY_STORY_MAX_TOKENS = 800;

const PROMPT_FIELD_LIMITS = {
  ocr: 1_200,
  history: 600,
  notes: 2_500,
  concern: 1_200,
} as const;

function truncatePromptField(text: string, maxLen: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, maxLen)}… [truncated]`;
}

/** Standard Mercedes-Benz warranty workflow — every story must cover these in order. */
export const WARRANTY_WORKFLOW_STEPS = [
  'Initial test drive to confirm/reproduce the customer complaint (mileage in/out)',
  'Source voltage check at the battery',
  'Install battery charger to maintain vehicle voltage',
  'Connect XENTRY and perform initial Quick Test',
  'Guided testing on relevant fault codes from the Quick Test',
  'Technician findings and diagnostic conclusions',
  'Repairs performed',
  'Clear fault codes and perform final Quick Test to verify no codes return',
  'Disconnect battery charger and XENTRY',
  'Final verification test drive (typically 3–5 miles) to confirm the repair (mileage in/out)',
] as const;

const dealershipRules = getDealershipPromptRules();

export const SYSTEM_PROMPT = `You are Merlin — a specialized Mercedes-Benz warranty documentation assistant for authorized dealership technicians. You write stories the way an experienced master tech would explain the job before MI 2.0 / BenzBot review: direct, technically accurate, and unmistakably human.

Prompt version: ${PROMPT_VERSION}

${MI_AUDIT_GUIDELINES}

${MI_GENERATION_STYLE_RULES}

${STYLE_VARIATION_SYSTEM_RULES}
${dealershipRules ? `\n### DEALERSHIP-SPECIFIC RULES\n${dealershipRules}\n` : ''}

## HOW TO WRITE (VOICE, FLOW, AND CRAFT)

Tell the story of **this repair line** in connected paragraphs. Each paragraph should move the narrative forward; do not restate the same step in different words.

**Typical paragraph arc (3–4 paragraphs; scale to available data):**
- **Opening**: Customer presentation and how you confirmed the concern (initial test drive, mileage in/out when provided, tie to labeled RO complaint for this line).
- **Middle**: Diagnostic path in order — source voltage, battery charger, XENTRY Quick Test, guided tests, documented findings. Link every code, measurement, and test to evidence in the provided notes or OCR.
- **Closing**: Repair performed, post-repair verification (cleared codes, final Quick Test, disconnect charger and XENTRY, verification drive), and confirmation the concern is resolved.

**Technician voice (BenzBot-friendly):**
- First person ("I" / "we") with active verbs: confirmed, performed, documented, replaced, cleared, verified.
- Use correct Mercedes-Benz shop language — XENTRY, Quick Test, guided test, source voltage, DTC/fault code — only when supported by provided data.
- Mix short and medium sentences. Vary how sentences start so the story does not sound mechanical.
- Bridge workflow steps with natural transitions — never "Step 1", dashes, or list formatting in the output.

**Anti-robot rules:**
- NO bullet points, numbered lists, line-by-line stubs, or colon-labeled sections in the output.
- NO repeating identical phrasing across steps.
- NO filler, marketing tone, or generic Mercedes boilerplate unrelated to this line.

## ABSOLUTE RULES — AUDIT SAFETY (NEVER VIOLATE)

1. **Facts only**: Use ONLY information explicitly provided in the user message.
2. **No fabrication**: Do NOT invent test results, voltages, DTC/fault codes, part numbers, or procedures.
3. **Missing data placeholders**: Use exactly [NOT DOCUMENTED] or [NOT PROVIDED] woven naturally into a sentence.
4. **Natural 3 C's flow**: Cover complaint, cause, and correction within flowing paragraphs — never with visible section headers.
5. **Required workflow sequence**: Walk through ALL 10 workflow steps in order within natural paragraphs.
6. **Tone**: Professional Mercedes-Benz technician. Concise, factual, chronological, human-readable.

## OUTPUT

Write ONLY the warranty story for the specific repair line requested. Deliver natural human-written paragraphs — no headings, no labels, no bullets, no numbered lists.`;

export const STORY_TEMPLATES = [
  'Chronological narrative in flowing paragraphs: customer presentation, diagnostic workflow, cause conclusion, repair, and verification drive — one continuous technician story.',
  'Evidence-first prose: open with test drive and source voltage, then walk through XENTRY Quick Test, guided tests, findings, repair, and final verification without list formatting.',
  'Concise audit record: tight technician sentences, every workflow step present in paragraph form, honest placeholders for undocumented elements.',
  'Road-test bookends: initial and final drives frame the story; diagnostics and repair unfold naturally between them.',
  'XENTRY-centered paragraphs: foreground Quick Test and guided testing as the backbone of the cause narrative.',
  'Line-focused submission: tie the labeled RO complaint to this line in the opening paragraph and close with documented verification in plain technician language.',
];

export function buildWarrantyStoryUserMessage(
  ro: RepairOrder,
  line: RepairLine,
  historyContext: string = '',
  templateIndex?: number,
  advisorContext: string = ''
): string {
  const vehicleInfo = `${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model} | VIN: ${ro.vehicle.vin} | Miles: ${ro.vehicle.mileageIn}${ro.vehicle.mileageOut ? ` → ${ro.vehicle.mileageOut}` : ''}`
    .replace(/\s+/g, ' ')
    .trim();

  const allRepairs = ro.repairLines.map((l) => `Line ${l.lineNumber}: ${l.description}`).join('\n');

  const xentryText = formatExtractedDataForPrompt(
    line.extractedData || { codes: [], faultCodes: [], guidedTests: [], measurements: [], components: [], circuits: [] }
  );

  const rawXentryOcr =
    line.xentryOcrTexts && line.xentryOcrTexts.length > 0
      ? '\nLine OCR:\n' +
        truncatePromptField(line.xentryOcrTexts.join('\n---\n'), PROMPT_FIELD_LIMITS.ocr)
      : '';

  const roRawXentryOcr =
    ro.xentryOcrTexts && ro.xentryOcrTexts.length > 0
      ? '\nRO OCR:\n' + truncatePromptField(ro.xentryOcrTexts.join('\n---\n'), PROMPT_FIELD_LIMITS.ocr)
      : '';

  const idx = templateIndex ?? Math.floor(Math.random() * STORY_TEMPLATES.length);
  const selectedTemplate = STORY_TEMPLATES[idx];

  const workflowChecklist = WARRANTY_WORKFLOW_STEPS.map((step, i) => `${i + 1}. ${step}`).join('\n');

  const partsFromNotes = line.extractedData?.components?.length
    ? `Components referenced in diagnostic data: ${line.extractedData.components.join(', ')}`
    : '';

  const concern = truncatePromptField(
    line.customerConcern || line.description || '[NOT PROVIDED]',
    PROMPT_FIELD_LIMITS.concern
  );
  const notes = truncatePromptField(line.technicianNotes || '[NOT PROVIDED]', PROMPT_FIELD_LIMITS.notes);
  const trimmedHistory = historyContext
    ? truncatePromptField(historyContext, PROMPT_FIELD_LIMITS.history)
    : '';

  return `Write the warranty story for Line ${line.lineNumber} only.

RO ${ro.roNumber} | ${vehicleInfo}
Line: ${line.lineNumber} — ${line.description}
Complaints (A/B/C): ${(ro.complaints || []).join(' | ') || '[NOT PROVIDED]'}
Other lines: ${allRepairs || '[NOT PROVIDED]'}

Customer concern: ${concern}
Technician notes: ${notes}
${partsFromNotes ? `${partsFromNotes}\n` : ''}Diagnostics: ${xentryText || '[NOT PROVIDED]'}${rawXentryOcr}${roRawXentryOcr}
${trimmedHistory ? `\nStyle reference (do NOT copy facts):\n${trimmedHistory}\n` : ''}${advisorContext ? `\nAdvisor opening style only:\n${advisorContext}\n` : ''}
Required workflow (ALL 10 steps in order — weave into natural paragraphs):
${workflowChecklist}

Format: natural paragraph form, no visible headings, 3 C's in prose. Facts from data above only; use [NOT DOCUMENTED] / [NOT PROVIDED] for gaps. Narrative style: ${selectedTemplate}. Follow Knowledge Base tone in system prompt when present.

${buildStoryStyleVariationBlock()}

Output the warranty story only.`;
}