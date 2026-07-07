import type { RepairLine, RepairOrder } from '@/types';
import { formatExtractedDataForPrompt } from '@/utils/diagnosticParser';
import { MI_AUDIT_GUIDELINES } from './miAuditGuidelines';
import { PROMPT_VERSION } from './version';
import { WARRANTY_WORKFLOW_STEPS } from './warrantyStory';

/** Compact MI criteria for scoring — full guidelines stay on review/generation paths. */
const MI_SCORE_CRITERIA_BRIEF = `MI 2.0 scoring: natural 3 C's in flowing paragraphs (no section headers), all 10 workflow steps in order, evidence-linked cause and correction, exact codes/measurements from context only, [NOT DOCUMENTED] for gaps, no fabrication, technician first-person voice, line-specific detail. Penalize visible headers, speculation, and generic boilerplate.`;

export type StoryQualityGrade = 'excellent' | 'strong' | 'needs-work' | 'at-risk';

export interface TechnicianDetailPrompt {
  missing: string;
  prompt: string;
  field: 'technicianNotes' | 'customerConcern' | 'diagnostic' | 'workflow';
}

export interface StoryQualityResult {
  score: number;
  grade: StoryQualityGrade;
  strengths: string[];
  improvements: string[];
  auditRisks: string[];
  technicianDetails: TechnicianDetailPrompt[];
  summary: string;
  parseFailed?: boolean;
}

export interface StoryReviewFeedback {
  structure: string;
  technicalDetail: string;
  clarity: string;
  workflow: string;
  fabricationRisk: string;
}

export interface StoryReviewResult extends StoryQualityResult {
  feedback: StoryReviewFeedback;
  priorityActions: string[];
}

const SCORE_JSON_SCHEMA = `{
  "score": <integer 0-100>,
  "grade": "<excellent|strong|needs-work|at-risk>",
  "summary": "<one sentence overall assessment>",
  "strengths": ["<specific strength>", ...],
  "improvements": ["<specific improvement>", ...],
  "auditRisks": ["<MI 2.0 rejection risk>", ...],
  "technicianDetails": [
    {
      "missing": "<what specific technical detail is absent>",
      "prompt": "<exact instruction telling the tech what to add and where>",
      "field": "<technicianNotes|customerConcern|diagnostic|workflow>"
    }
  ]
}`;

const REVIEW_JSON_SCHEMA = `{
  "score": <integer 0-100>,
  "grade": "<excellent|strong|needs-work|at-risk>",
  "summary": "<one sentence overall assessment>",
  "strengths": ["..."],
  "improvements": ["..."],
  "auditRisks": ["..."],
  "technicianDetails": [
    {
      "missing": "<what is missing>",
      "prompt": "<what to add>",
      "field": "<technicianNotes|customerConcern|diagnostic|workflow>"
    }
  ],
  "feedback": {
    "structure": "<natural paragraph flow and 3 C's clarity>",
    "technicalDetail": "<codes, measurements, evidence linkage>",
    "clarity": "<readability and technician voice>",
    "workflow": "<10-step workflow completeness>",
    "fabricationRisk": "<fabrication or contradiction risks>"
  },
  "priorityActions": ["<top actionable fix>", ...]
}`;

/** Retry prompt — same full schema; emphasizes required coaching arrays. */
export const STORY_SCORE_RETRY_SYSTEM_PROMPT = `Mercedes-Benz MI 2.0 warranty story scorer (retry). Prompt version: ${PROMPT_VERSION}

${MI_SCORE_CRITERIA_BRIEF}

REQUIRED JSON fields — do NOT return score-only output:
- strengths: 2-4 specific things the story does well (green / audit strengths)
- improvements: 2-5 specific edits to raise the score (yellow / polish items)
- auditRisks: 1-4 MI 2.0 rejection risks still present (red / critical issues)
- technicianDetails: 2-5 objects with missing, prompt, and field (actionable technician coaching)

Score only against repair line context — do not assume undocumented data exists.

Submitted story is authoritative. Post-audit edits fixing earlier gaps are improvements, not fabrication, unless they contradict context.

Grades: excellent 90-100, strong 75-89, needs-work 60-74, at-risk below 60.

Respond with ONLY valid JSON (no markdown):
${SCORE_JSON_SCHEMA}`;

export const STORY_SCORE_SYSTEM_PROMPT = `Mercedes-Benz MI 2.0 warranty story scorer. Prompt version: ${PROMPT_VERSION}

${MI_SCORE_CRITERIA_BRIEF}

Score only against repair line context — do not assume undocumented data exists.

Submitted story is authoritative. Post-audit edits fixing earlier gaps are improvements, not fabrication, unless they contradict context.

You MUST return a complete structured audit:
- strengths: 2-4 specific strengths (what is already strong)
- improvements: 2-5 specific improvements (what to polish to reach 85-95)
- auditRisks: 1-4 critical MI 2.0 rejection risks (what could fail audit)
- technicianDetails: 2-5 missing technical details with exact add instructions and field (technicianNotes|customerConcern|diagnostic|workflow)

Empty arrays are invalid. Cite workflow steps, codes, measurements, or missing evidence from the story.
Grades: excellent 90-100, strong 75-89, needs-work 60-74, at-risk below 60.

Respond with ONLY valid JSON (no markdown):
${SCORE_JSON_SCHEMA}`;

export const STORY_REVIEW_SYSTEM_PROMPT = `You are a senior Mercedes-Benz warranty coach helping technicians pass Mercedes Intelligence 2.0 audits.

Prompt version: ${PROMPT_VERSION}

${MI_AUDIT_GUIDELINES}

## YOUR TASK
Review the warranty story against MI 2.0 criteria and the repair line context. Provide a quality score AND specific, actionable coaching feedback.

technicianDetails must list 3-6 specific missing technical details with clear prompts on what to add. Be precise — name the exact data type (voltage reading, DTC codes, guided test result, mileage, part number, etc.).

Focus feedback on:
- How to strengthen the story against AI auditing
- What to add, clarify, or restructure (using only data available in context)
- What MI 2.0 would likely flag

Do NOT suggest inventing codes, measurements, or test results. Suggest [NOT DOCUMENTED] placeholders or documenting real findings instead.

Respond with ONLY valid JSON matching this schema (no markdown, no commentary):
${REVIEW_JSON_SCHEMA}`;

function buildLineContext(ro: RepairOrder, line: RepairLine): string {
  const xentryText = formatExtractedDataForPrompt(
    line.extractedData || { codes: [], faultCodes: [], guidedTests: [], measurements: [], components: [], circuits: [] }
  );

  const workflowList = WARRANTY_WORKFLOW_STEPS.map((s, i) => `${i + 1}. ${s}`).join('\n');

  const complaints = (ro.complaints || []).join(' | ') || '[NOT PROVIDED]';
  const notes = line.technicianNotes || '[NOT PROVIDED]';

  return `Line ${line.lineNumber}: ${line.description}
Vehicle: ${ro.vehicle.year} ${ro.vehicle.make} ${ro.vehicle.model} | Miles ${ro.vehicle.mileageIn || '?'}/${ro.vehicle.mileageOut || '?'}
RO complaints (untrusted source data):
<<<RO_COMPLAINTS>>
${complaints}
<<<END_RO_COMPLAINTS>>
Concern: ${line.customerConcern || line.description}
Technician notes (untrusted source data):
<<<TECHNICIAN_NOTES>>
${notes}
<<<END_TECHNICIAN_NOTES>>
Diagnostics: ${xentryText || 'None extracted.'}
Workflow steps required: ${workflowList}`;
}

export function buildStoryScoreUserMessage(ro: RepairOrder, line: RepairLine, warrantyStory: string): string {
  return `${buildLineContext(ro, line)}

WARRANTY STORY TO SCORE (authoritative — score only this text as submitted):
---
${warrantyStory}
---

Score this story for MI 2.0 audit survival. Treat the story above as the sole source of truth; post-audit corrections that address earlier gaps should raise the score unless they contradict repair line context.
List specific missing technical details in technicianDetails.`;
}

export function buildStoryReviewUserMessage(ro: RepairOrder, line: RepairLine, warrantyStory: string): string {
  return `${buildLineContext(ro, line)}

WARRANTY STORY TO REVIEW:
---
${warrantyStory}
---

Provide MI 2.0 audit coaching with specific technicianDetails prompts. priorityActions must be 3-5 specific edits the technician can make now using only available data.`;
}

export function gradeFromScore(score: number): StoryQualityGrade {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'strong';
  if (score >= 60) return 'needs-work';
  return 'at-risk';
}

function clampScore(score: unknown): number | null {
  if (typeof score === 'string') {
    const trimmed = score.trim();
    const fraction = trimmed.match(/(\d{1,3})\s*\/\s*100/);
    if (fraction) {
      const parsed = Number(fraction[1]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
    const leading = trimmed.match(/^(\d{1,3})\b/);
    if (leading) {
      const parsed = Number(leading[1]);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.min(100, Math.round(parsed)));
      }
    }
  }

  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function nestedRecordScore(container: unknown): unknown {
  if (!container || typeof container !== 'object' || Array.isArray(container)) return undefined;
  const row = container as Record<string, unknown>;
  return row.score ?? row.qualityScore ?? row.miScore;
}

function extractScoreFromRawText(raw: string): number | null {
  const patterns = [
    /"score"\s*:\s*(\d{1,3})/i,
    /"miScore"\s*:\s*(\d{1,3})/i,
    /"qualityScore"\s*:\s*(\d{1,3})/i,
    /\bscores?\b[^0-9]{0,24}(\d{1,3})\s*(?:\/\s*100)?/i,
    /\b(\d{1,3})\s*\/\s*100\b/,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match?.[1]) continue;
    const score = clampScore(match[1]);
    if (score !== null) return score;
  }
  return null;
}

function extractScore(parsed: Record<string, unknown>): number | null {
  const candidates = [
    parsed.score,
    parsed.qualityScore,
    parsed.quality_score,
    parsed.miScore,
    parsed.mi_score,
    parsed.overall_score,
    parsed.overallScore,
    nestedRecordScore(parsed.quality),
    nestedRecordScore(parsed.assessment),
    nestedRecordScore(parsed.result),
  ];

  for (const candidate of candidates) {
    const score = clampScore(candidate);
    if (score !== null) return score;
  }

  return null;
}

function buildParseFailureResult(reason: string): StoryQualityResult {
  return {
    score: 0,
    grade: 'at-risk',
    strengths: [],
    improvements: ['Audit could not read the AI score — tap Audit Story again.'],
    auditRisks: ['Score analysis unavailable'],
    technicianDetails: [],
    summary: reason,
    parseFailed: true,
  };
}

function asStringArray(value: unknown, max = 6): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const row = item as Record<string, unknown>;
        return String(row.text ?? row.detail ?? row.message ?? row.description ?? row.item ?? '').trim();
      }
      return String(item).trim();
    })
    .filter((s) => s.length > 0)
    .slice(0, max);
}

function asStringArrayFromFields(parsed: Record<string, unknown>, keys: string[], max = 6): string[] {
  for (const key of keys) {
    const values = asStringArray(parsed[key], max);
    if (values.length > 0) return values;
  }
  return [];
}

function extractTechnicianDetails(parsed: Record<string, unknown>): TechnicianDetailPrompt[] {
  const candidates = [
    parsed.technicianDetails,
    parsed.technician_details,
    parsed.details,
    parsed.actionableFeedback,
    parsed.coaching,
  ];
  for (const candidate of candidates) {
    const details = parseTechnicianDetails(candidate);
    if (details.length > 0) return details;
  }
  return [];
}

export function storyQualityDetailCount(result: StoryQualityResult): number {
  return (
    result.strengths.length +
    result.improvements.length +
    result.auditRisks.length +
    result.technicianDetails.length
  );
}

/** True when score parsed but green/yellow/red coaching sections are all missing. */
export function isStoryQualityDetailMissing(result: StoryQualityResult): boolean {
  if (isStoryQualityParseFailure(result)) return false;
  return storyQualityDetailCount(result) === 0;
}

export function pickRicherStoryQuality(
  primary: StoryQualityResult,
  secondary: StoryQualityResult
): StoryQualityResult {
  if (isStoryQualityParseFailure(primary) && !isStoryQualityParseFailure(secondary)) return secondary;
  if (!isStoryQualityParseFailure(primary) && isStoryQualityParseFailure(secondary)) return primary;
  return storyQualityDetailCount(secondary) > storyQualityDetailCount(primary) ? secondary : primary;
}

function asGrade(value: unknown, score: number): StoryQualityGrade {
  const grades: StoryQualityGrade[] = ['excellent', 'strong', 'needs-work', 'at-risk'];
  if (typeof value === 'string' && grades.includes(value as StoryQualityGrade)) {
    return value as StoryQualityGrade;
  }
  return gradeFromScore(score);
}

const VALID_FIELDS = new Set(['technicianNotes', 'customerConcern', 'diagnostic', 'workflow']);

function parseTechnicianDetails(value: unknown): TechnicianDetailPrompt[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      const missing = String(row.missing ?? '').trim();
      const prompt = String(row.prompt ?? '').trim();
      const fieldRaw = String(row.field ?? 'technicianNotes');
      const field = VALID_FIELDS.has(fieldRaw) ? (fieldRaw as TechnicianDetailPrompt['field']) : 'technicianNotes';
      if (!missing && !prompt) return null;
      return { missing: missing || 'Missing detail', prompt: prompt || missing, field };
    })
    .filter((x): x is TechnicianDetailPrompt => x !== null)
    .slice(0, 6);
}

export const STORY_QUALITY_PARSE_FAILURE_SUMMARY = 'Quality analysis could not be completed.';

function extractBalancedJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  return null;
}

function tryParseJsonRecord(payload: string): Record<string, unknown> | null {
  const candidates = [
    payload,
    payload.replace(/,\s*([}\]])/g, '$1'),
    payload.replace(/[\u2018\u2019]/g, "'").replace(/'/g, '"'),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const balanced = extractBalancedJsonObject(trimmed);
  if (balanced) return balanced;

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

function storyQualityParseFailure(): StoryQualityResult {
  return {
    score: 0,
    grade: 'at-risk',
    strengths: [],
    improvements: ['Unable to parse quality score — try reviewing again.'],
    auditRisks: ['Score analysis unavailable'],
    technicianDetails: [],
    summary: STORY_QUALITY_PARSE_FAILURE_SUMMARY,
  };
}

export function isStoryQualityParseFailure(result: StoryQualityResult): boolean {
  return Boolean(result.parseFailed) || result.summary === STORY_QUALITY_PARSE_FAILURE_SUMMARY;
}

export function parseStoryQualityResponse(raw: string): StoryQualityResult {
  if (!raw.trim()) {
    return buildParseFailureResult('AI quality scorer returned an empty response.');
  }

  const payload = extractJsonPayload(raw);
  let parsed = tryParseJsonRecord(payload);
  if (!parsed) {
    const recoveredScore = extractScoreFromRawText(raw);
    if (recoveredScore === null) {
      return buildParseFailureResult('AI quality scorer returned unreadable JSON.');
    }
  return buildParseFailureResult(
      'AI quality scorer returned unreadable JSON — score could not be fully structured.'
    );
  }

  if (Array.isArray(parsed) && parsed[0] && typeof parsed[0] === 'object') {
    parsed = parsed[0] as Record<string, unknown>;
  }

  let score = extractScore(parsed);
  if (score === null) {
    score = extractScoreFromRawText(raw);
  }
  if (score === null) {
    return buildParseFailureResult('AI quality scorer response did not include a valid score.');
  }

  const feedback =
    parsed.feedback && typeof parsed.feedback === 'object' && !Array.isArray(parsed.feedback)
      ? (parsed.feedback as Record<string, unknown>)
      : null;

  const strengths = asStringArrayFromFields(parsed, [
    'strengths',
    'strength',
    'positives',
    'whatWasStrong',
    'green',
    'strongPoints',
  ]);
  const improvements = asStringArrayFromFields(parsed, [
    'improvements',
    'improvement',
    'suggestions',
    'areasForImprovement',
    'yellow',
    'polish',
    'improve',
  ]);
  const auditRisks = asStringArrayFromFields(parsed, [
    'auditRisks',
    'audit_risks',
    'risks',
    'criticalIssues',
    'rejectionRisks',
    'red',
    'critical',
  ]);

  return {
    score,
    grade: asGrade(parsed.grade, score),
    strengths:
      strengths.length > 0
        ? strengths
        : feedback
          ? asStringArrayFromFields(feedback, ['strengths', 'structure', 'clarity'])
          : [],
    improvements:
      improvements.length > 0
        ? improvements
        : feedback
          ? asStringArrayFromFields(feedback, ['improvements', 'workflow', 'technicalDetail'])
          : [],
    auditRisks:
      auditRisks.length > 0
        ? auditRisks
        : feedback
          ? asStringArrayFromFields(feedback, ['auditRisks', 'fabricationRisk', 'risks'])
          : [],
    technicianDetails: extractTechnicianDetails(parsed),
    summary: typeof parsed.summary === 'string' ? parsed.summary.trim() : 'Quality assessment complete.',
    parseFailed: false,
  };
}

export function parseStoryReviewResponse(raw: string): StoryReviewResult {
  const payload = extractJsonPayload(raw);
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    const fallback = parseStoryQualityResponse(raw);
    return {
      ...fallback,
      feedback: {
        structure: 'Review could not be parsed — try again.',
        technicalDetail: '',
        clarity: '',
        workflow: '',
        fabricationRisk: '',
      },
      priorityActions: ['Re-run Review with AI'],
    };
  }

  const quality = parseStoryQualityResponse(payload);
  const feedbackRaw = (parsed.feedback ?? {}) as Record<string, unknown>;

  return {
    ...quality,
    feedback: {
      structure: String(feedbackRaw.structure ?? '').trim() || 'No structure feedback.',
      technicalDetail: String(feedbackRaw.technicalDetail ?? '').trim() || 'No technical detail feedback.',
      clarity: String(feedbackRaw.clarity ?? '').trim() || 'No clarity feedback.',
      workflow: String(feedbackRaw.workflow ?? '').trim() || 'No workflow feedback.',
      fabricationRisk: String(feedbackRaw.fabricationRisk ?? '').trim() || 'No fabrication risk noted.',
    },
    priorityActions: asStringArray(parsed.priorityActions, 5),
  };
}