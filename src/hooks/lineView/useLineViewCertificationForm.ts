'use client';

import { useEffect, useState } from 'react';
import type { StoryCertificationRecord } from '@/hooks/repairOrders/useROStoryWorkflow';
import type { StoryQualityResult } from '@/types';

interface UseLineViewCertificationFormInput {
  lineId: string;
  isCustomerPayLine: boolean;
  technicianName?: string;
  storyQuality: StoryQualityResult | null;
  storyQualityStale: boolean;
  storyCertification: StoryCertificationRecord | null;
  lastGeneratedStoryText: string | null;
}

export function useLineViewCertificationForm({
  lineId,
  isCustomerPayLine,
  technicianName,
  storyQuality,
  storyQualityStale,
  storyCertification,
  lastGeneratedStoryText,
}: UseLineViewCertificationFormInput) {
  const [certificationChecked, setCertificationChecked] = useState(false);
  const [certificationName, setCertificationName] = useState('');

  const showCertificationSection = !isCustomerPayLine && Boolean(storyQuality);
  const isStoryCertified = Boolean(storyCertification);
  const isCertificationComplete =
    certificationChecked && certificationName.trim().length >= 2;
  const hasCompletedAuditForCurrentStory = Boolean(storyQuality) || storyQualityStale;
  const certificationActionsLocked =
    !isCustomerPayLine &&
    Boolean(lastGeneratedStoryText) &&
    hasCompletedAuditForCurrentStory &&
    !isStoryCertified;

  useEffect(() => {
    setCertificationChecked(false);
    setCertificationName('');
  }, [lineId]);

  useEffect(() => {
    setCertificationChecked(false);
    setCertificationName('');
  }, [storyQuality?.scoredAgainstStory, storyQuality?.score]);

  useEffect(() => {
    if (storyCertification) {
      setCertificationChecked(true);
      setCertificationName(storyCertification.certifiedByName);
    }
  }, [storyCertification]);

  useEffect(() => {
    if (!storyCertification && !certificationName.trim() && technicianName?.trim()) {
      setCertificationName(technicianName.trim());
    }
  }, [lineId, technicianName, storyCertification, certificationName]);

  return {
    certificationChecked,
    setCertificationChecked,
    certificationName,
    setCertificationName,
    showCertificationSection,
    isStoryCertified,
    isCertificationComplete,
    certificationActionsLocked,
  };
}