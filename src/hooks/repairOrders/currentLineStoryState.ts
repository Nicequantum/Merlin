import type { RepairLine, RepairOrder, StoryQualityResult, StoryReviewResult } from '@/types';
import { isStoryQualityCurrent } from '@/lib/storyQualityState';
import type { StoryCertificationRecord } from '@/hooks/repairOrders/useROStoryWorkflow';

interface CurrentLineStoryStateInput {
  currentRO: RepairOrder | null;
  currentLineId: string | null;
  isGenerating: boolean;
  generatingLineId: string | null;
  isScoring: boolean;
  scoringLineId: string | null;
  isReviewing: boolean;
  reviewingLineId: string | null;
  storyQualityByLine: Record<string, StoryQualityResult>;
  storyReviewByLine: Record<string, StoryReviewResult>;
  storyCertificationByLine: Record<string, StoryCertificationRecord>;
  lastGeneratedStoryByLine: Record<string, string>;
  cdkSanitizedByLine: Record<string, boolean>;
}

export function deriveCurrentLineStoryState({
  currentRO,
  currentLineId,
  isGenerating,
  generatingLineId,
  isScoring,
  scoringLineId,
  isReviewing,
  reviewingLineId,
  storyQualityByLine,
  storyReviewByLine,
  storyCertificationByLine,
  lastGeneratedStoryByLine,
  cdkSanitizedByLine,
}: CurrentLineStoryStateInput) {
  const currentLine = currentRO?.repairLines.find((l) => l.id === currentLineId);
  const lastGeneratedStoryForLine =
    currentLineId && lastGeneratedStoryByLine[currentLineId]
      ? lastGeneratedStoryByLine[currentLineId]
      : null;
  const cdkSanitizedForLine = Boolean(currentLineId && cdkSanitizedByLine[currentLineId]);

  const isGeneratingForLine = isGenerating && generatingLineId === currentLineId;
  const isScoringForLine = isScoring && scoringLineId === currentLineId;
  const isReviewingForLine = isReviewing && reviewingLineId === currentLineId;

  const storyQualityForLine = (() => {
    if (!currentLineId || isGeneratingForLine || isScoringForLine || isReviewingForLine) return null;
    const quality = storyQualityByLine[currentLineId];
    if (!quality) return null;
    const storyText = currentLine?.warrantyStory?.trim() ?? '';
    if (!storyText) return null;
    if (!isStoryQualityCurrent(quality, storyText)) return null;
    return quality;
  })();

  const storyReviewForLine = (() => {
    if (!currentLineId || isGeneratingForLine || isScoringForLine || isReviewingForLine) return null;
    if (!storyQualityForLine) return null;
    return storyReviewByLine[currentLineId] ?? null;
  })();

  const storyQualityStaleForLine = (() => {
    if (!currentLineId || isGeneratingForLine || isScoringForLine || isReviewingForLine) return false;
    const quality = storyQualityByLine[currentLineId];
    const storyText = currentLine?.warrantyStory?.trim() ?? '';
    if (!quality || !storyText) return false;
    return !isStoryQualityCurrent(quality, storyText);
  })();

  const storyCertificationForLine = (() => {
    if (!currentLineId) return null;
    const certification = storyCertificationByLine[currentLineId];
    const storyText = currentLine?.warrantyStory?.trim() ?? '';
    if (!certification || !storyText || certification.storyText !== storyText) return null;
    return certification;
  })();

  return {
    currentLine,
    lastGeneratedStoryForLine,
    cdkSanitizedForLine,
    isGeneratingForLine,
    isScoringForLine,
    isReviewingForLine,
    storyQualityForLine,
    storyReviewForLine,
    storyQualityStaleForLine,
    storyCertificationForLine,
  };
}