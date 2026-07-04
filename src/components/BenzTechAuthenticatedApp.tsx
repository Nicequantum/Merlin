'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { AppFooter } from '@/components/AppFooter';
import { AppHeader } from '@/components/AppHeader';
import { MaintenanceBanner } from '@/components/MaintenanceBanner';
import { HomeView } from '@/components/HomeView';
import { LoadingOverlay } from '@/components/LoadingOverlay';
import { LoadErrorScreen } from '@/components/LoadErrorScreen';
import { LoadingScreen } from '@/components/LoadingScreen';
import { RepairOrderHomeLists } from '@/components/RepairOrderHomeLists';
import { ROView } from '@/components/ROView';
import { SettingsView } from '@/components/SettingsView';
import { ViewErrorBoundary } from '@/components/ViewErrorBoundary';
import { CompanionSyncBridge } from '@/components/CompanionSyncBridge';
import { useDesktopCompanion } from '@/hooks/useDesktopCompanion';
import { useOcrProgress } from '@/hooks/useOcrProgress';
import { useRepairOrders } from '@/hooks/useRepairOrders';
import { clientLog } from '@/lib/clientLog';
import { recordTechnicianAppStart } from '@/lib/recordTechnicianAppStart';
import type { TechnicianSession } from '@/types';

const ManagerDashboard = dynamic(
  () => import('@/components/ManagerDashboard').then((m) => m.ManagerDashboard),
  { loading: () => <LoadingScreen label="Loading manager dashboard" /> }
);

const AuditLogView = dynamic(
  () => import('@/components/AuditLogView').then((m) => m.AuditLogView),
  {
    loading: () => (
      <LoadingScreen label="Loading audit logs" sublabel="Fetching dealership activity…" />
    ),
  }
);

const ServiceAdvisorsView = dynamic(
  () => import('@/components/ServiceAdvisorsView').then((m) => m.ServiceAdvisorsView),
  { loading: () => <LoadingScreen label="Loading service advisors" /> }
);

const TechniciansView = dynamic(
  () => import('@/components/TechniciansView').then((m) => m.TechniciansView),
  { loading: () => <LoadingScreen label="Loading technicians" /> }
);

const LineView = dynamic(
  () => import('@/components/LineView').then((m) => m.LineView),
  { loading: () => <LoadingScreen label="Loading repair line" sublabel="Preparing warranty tools…" /> }
);

const AdvisorDashboard = dynamic(
  () => import('@/components/AdvisorDashboard').then((m) => m.AdvisorDashboard),
  { loading: () => <LoadingScreen label="Loading advisor dashboard" /> }
);

const DesktopCompanionLayout = dynamic(
  () => import('@/components/desktop/DesktopCompanionLayout').then((m) => m.DesktopCompanionLayout),
  { loading: () => <LoadingScreen label="Loading desktop companion" /> }
);

function runAction(label: string, action: () => void | Promise<void>): void {
  void Promise.resolve(action()).catch((error: unknown) => {
    clientLog.error('ui.action_failed', { label, error });
    toast.error(error instanceof Error ? error.message : `${label} failed`);
  });
}

interface BenzTechAuthenticatedAppProps {
  session: TechnicianSession;
  onLogout: () => Promise<void>;
}

/** Post-auth Merlinus shell — isolated from login so heavy RO/OCR modules never load on sign-in. */
export function BenzTechAuthenticatedApp({ session, onLogout }: BenzTechAuthenticatedAppProps) {
  const ocr = useOcrProgress();
  const ro = useRepairOrders({
    session,
    onOcrStart: ocr.startOcr,
    onOcrFinish: ocr.finishOcr,
    setOcrProgress: ocr.setOcrProgress,
    setScanStatusMessage: ocr.setScanStatusMessage,
  });

  const isServiceAdvisor = session.role === 'service_advisor';
  const isDesktop = useDesktopCompanion();

  useEffect(() => {
    if (isServiceAdvisor || ro.loading || ro.listError) return;
    void recordTechnicianAppStart({
      role: session.role,
      todayRoCount: ro.todayROs.length,
      previousRoCount: ro.previousROs.length,
    });
  }, [
    isServiceAdvisor,
    ro.loading,
    ro.listError,
    ro.todayROs.length,
    ro.previousROs.length,
    session.role,
  ]);

  if (!isServiceAdvisor && ro.loading && !ro.listError) {
    return <LoadingScreen label="Loading today's repair orders" sublabel="Getting your active work ready..." />;
  }

  if (!isServiceAdvisor && ro.listError) {
    return (
      <LoadErrorScreen
        title="Could not load repair orders"
        message={ro.listError}
        onRetry={() => runAction('Retry loading repair orders', () => ro.retryListLoad())}
        retrying={ro.listRetrying}
      />
    );
  }

  const goToSettings = () => ro.setView('settings');
  const isManager = session.role === 'manager';

  if (isServiceAdvisor) {
    return (
      <div className="app-container">
        <MaintenanceBanner />
        {ro.view === 'settings' ? (
          <SettingsView
            session={session}
            onBack={() => ro.setView('home')}
            onLogout={onLogout}
          />
        ) : (
          <ViewErrorBoundary viewName="the service advisor dashboard">
            <AdvisorDashboard
              session={session}
              onOpenSettings={goToSettings}
              onLogout={onLogout}
            />
          </ViewErrorBoundary>
        )}
        <AppFooter />
      </div>
    );
  }

  const roListSection = (
    <RepairOrderHomeLists
      searchTerm={ro.searchTerm}
      searchLoading={ro.searchLoading}
      searchResults={ro.searchROs}
      todayROs={ro.todayROs}
      previousROs={ro.previousROs}
      previousExpanded={ro.previousExpanded}
      onTogglePrevious={ro.togglePreviousExpanded}
      previousLoading={ro.previousLoading}
      previousLoadingMore={ro.previousLoadingMore}
      previousHasMore={ro.previousHasMore}
      onLoadMorePrevious={ro.loadMorePrevious}
      openingROId={ro.openingROId}
      onOpenRO={ro.openRO}
      onDeleteRO={ro.deleteRO}
    />
  );

  const openingRoNumber =
    ro.openingROId &&
    (ro.allROs.find((item) => item.id === ro.openingROId)?.roNumber || 'repair order');

  const wideLayout = ro.view === 'home' && isManager;
  const showDesktopCompanion =
    isDesktop && ro.currentRO && (ro.view === 'ro' || ro.view === 'line');
  const companionMode = showDesktopCompanion;

  return (
    <CompanionSyncBridge session={session} enabled ro={ro} ocr={ocr}>
      {(companion) => (
    <div
      className={`app-container${wideLayout ? ' benz-app-wide' : ''}${companionMode ? ' benz-companion-mode' : ''}`}
    >
      <MaintenanceBanner />
      <LoadingOverlay
        visible={!!ro.openingROId}
        message={openingRoNumber ? `Loading ${openingRoNumber}…` : 'Loading repair order…'}
      />

      {ro.view !== 'home' &&
        ro.view !== 'settings' &&
        ro.view !== 'audit' &&
        ro.view !== 'advisors' &&
        ro.view !== 'technicians' && (
          <AppHeader technicianName={session.name} onOpenSettings={goToSettings} />
        )}

      {ro.view === 'home' && isManager && (
        <ViewErrorBoundary viewName="the manager dashboard">
          <ManagerDashboard
            session={session}
            searchTerm={ro.searchTerm}
            onSearchChange={ro.setSearchTerm}
            openingROId={ro.openingROId}
            onOpenRO={ro.openRO}
            onOpenSettings={goToSettings}
            onOpenAuditLogs={() => ro.setView('audit')}
            onOpenServiceAdvisors={() => ro.setView('advisors')}
            onOpenTechnicians={() => ro.setView('technicians')}
            pendingROImages={ro.pendingROImages}
            onScanRO={ro.scanRO}
            onAddFromGallery={ro.addScanPagesFromGallery}
            onProcessScan={ro.processPendingScan}
            onClearPendingScan={ro.clearPendingScan}
            onCancelScan={ro.cancelScan}
            onCreateManualRO={ro.createManualRO}
            isProcessingOCR={ocr.isProcessingOCR}
            ocrProgress={ocr.ocrProgress}
            scanStatusMessage={ocr.scanStatusMessage}
          >
            {roListSection}
          </ManagerDashboard>
        </ViewErrorBoundary>
      )}

      {ro.view === 'home' && !isManager && (
        <HomeView
          technicianName={session.name}
          searchTerm={ro.searchTerm}
          onSearchChange={ro.setSearchTerm}
          searchLoading={ro.searchLoading}
          searchROs={ro.searchROs}
          todayROs={ro.todayROs}
          previousROs={ro.previousROs}
          previousExpanded={ro.previousExpanded}
          onTogglePrevious={ro.togglePreviousExpanded}
          previousLoading={ro.previousLoading}
          previousLoadingMore={ro.previousLoadingMore}
          previousHasMore={ro.previousHasMore}
          onLoadMorePrevious={ro.loadMorePrevious}
          pendingROImages={ro.pendingROImages}
          isProcessingOCR={ocr.isProcessingOCR}
          ocrProgress={ocr.ocrProgress}
          scanStatusMessage={ocr.scanStatusMessage}
          onScanRO={ro.scanRO}
          onAddFromGallery={ro.addScanPagesFromGallery}
          onProcessScan={ro.processPendingScan}
          onClearPendingScan={ro.clearPendingScan}
          onCancelScan={ro.cancelScan}
          onCreateManualRO={ro.createManualRO}
          openingROId={ro.openingROId}
          onOpenRO={ro.openRO}
          onDeleteRO={ro.deleteRO}
          onOpenSettings={goToSettings}
        />
      )}

      {showDesktopCompanion && ro.currentRO && (
        <div className="benz-desktop-only">
          <ViewErrorBoundary viewName="the desktop companion">
            <DesktopCompanionLayout
              view={ro.view}
              ro={ro.currentRO}
              line={ro.view === 'line' ? (ro.currentLine ?? null) : null}
              technicianName={session.name}
              storyQuality={ro.storyQualityForLine}
              storyReview={ro.storyReviewForLine}
              storyQualityStale={ro.storyQualityStaleForLine}
              storyCertification={ro.storyCertificationForLine}
              connectionState={companion.connectionState}
              workflowStatus={companion.workflowStatus}
              statusMessage={companion.statusMessage}
              statusProgress={companion.statusProgress}
              activities={companion.activities}
            />
          </ViewErrorBoundary>
        </div>
      )}

      {ro.view === 'ro' && ro.currentRO && (
        <ViewErrorBoundary viewName="the repair order">
          <div className={showDesktopCompanion ? 'benz-tablet-only' : undefined}>
          <ROView
            ro={ro.currentRO}
            isProcessingOCR={ocr.isProcessingOCR}
            ocrProgress={ocr.ocrProgress}
            onDone={() => ro.setView('home')}
            onUpdateRONumber={ro.updateRONumber}
            onUpdateVehicle={(field, value) => ro.updateVehicle({ [field]: value })}
            onUpdateCustomer={ro.updateCustomer}
            onAddComplaint={ro.addComplaint}
            onEditComplaint={ro.editComplaint}
            onRemoveComplaint={ro.removeComplaint}
            onDecodeVin={ro.decodeVinForRO}
            onAddROXentryPhotos={ro.addROXentryPhotos}
            onDeleteROXentryImage={(imageId) =>
              runAction('Delete Xentry photo', () => ro.deleteROXentryImage(imageId))
            }
            onAddRepairLine={ro.addRepairLine}
            onOpenLine={ro.navigateToLine}
            onDeleteRO={() =>
              runAction('Delete repair order', () => ro.deleteRO(ro.currentRO!.id))
            }
          />
          </div>
        </ViewErrorBoundary>
      )}

      {ro.view === 'line' && ro.currentRO && ro.currentLine && (
        <ViewErrorBoundary viewName="the repair line">
          <div className={showDesktopCompanion ? 'benz-tablet-only' : undefined}>
          <LineView
            ro={ro.currentRO}
            line={ro.currentLine}
            technicianName={session.name}
            isProcessingOCR={ocr.isProcessingOCR}
            ocrProgress={ocr.ocrProgress}
            isGenerating={ro.isGeneratingForLine}
            isScoring={ro.isScoringForLine}
            isReviewing={ro.isReviewingForLine}
            storyQuality={ro.storyQualityForLine}
            storyReview={ro.storyReviewForLine}
            storyQualityStale={ro.storyQualityStaleForLine}
            storyCertification={ro.storyCertificationForLine}
            isCertifyingStory={ro.isCertifyingStory}
            lastGeneratedStoryText={ro.lastGeneratedStoryForLine}
            cdkSanitizedNotice={ro.cdkSanitizedForLine}
            onClearCdkSanitizedNotice={() => ro.clearCdkSanitizedNotice(ro.currentLine!.id)}
            onBack={() => ro.setView('ro')}
            onUpdateLine={(updates) => {
              const lineId = ro.currentLine!.id;
              const roId = ro.currentRO!.id;
              ro.updateLine(lineId, updates);
              if (updates.warrantyStory !== undefined || updates.technicianNotes !== undefined || updates.customerConcern !== undefined) {
                companion.publishROPatch({
                  repairOrderId: roId,
                  lineId,
                  linePatch: updates,
                });
                companion.publishActivity('Updated line fields', {
                  repairOrderId: roId,
                  lineId,
                });
              }
            }}
            onAddXentryPhotos={() => ro.addXentryPhotos(ro.currentLine!.id)}
            onDeleteXentryImage={(imageId) =>
              runAction('Delete diagnostic photo', () =>
                ro.deleteLineXentryImage(ro.currentLine!.id, imageId)
              )
            }
            onGenerateStory={() => {
              const lineId = ro.currentLineId;
              if (!lineId || typeof ro.generateStory !== 'function') {
                clientLog.error('story.generate_unavailable', {
                  lineId,
                  hasGenerateStory: typeof ro.generateStory === 'function',
                });
                toast.error('Story generation is unavailable — refresh and try again');
                return;
              }
              companion.publishActivity('Generating warranty story', {
                repairOrderId: ro.currentRO!.id,
                lineId,
              });
              runAction('Generate warranty story', () => ro.generateStory(lineId));
            }}
            onScoreStory={(storyText) => {
              companion.publishActivity('Running MI audit', {
                repairOrderId: ro.currentRO!.id,
                lineId: ro.currentLine!.id,
              });
              runAction('Audit warranty story', () => ro.scoreStory(ro.currentLine!.id, storyText));
            }}
            onReviewStory={(storyText) => {
              companion.publishActivity('Running AI review', {
                repairOrderId: ro.currentRO!.id,
                lineId: ro.currentLine!.id,
              });
              runAction('Review warranty story', () => ro.reviewStory(ro.currentLine!.id, storyText));
            }}
            onApplyCustomerPayTemplate={(templateId) => {
              companion.publishActivity('Applied Customer Pay template', {
                repairOrderId: ro.currentRO!.id,
                lineId: ro.currentLine!.id,
              });
              runAction('Apply Customer Pay template', () =>
                ro.applyCustomerPayTemplate(ro.currentLine!.id, templateId)
              );
            }}
            onClearCustomerPayMode={() =>
              runAction('Clear Customer Pay mode', () => ro.clearCustomerPayMode(ro.currentLine!.id))
            }
            onAcknowledgeStoryBaseline={(text) => ro.acknowledgeStoryBaseline(ro.currentLine!.id, text)}
            onCertifyAndSaveStory={(storyText, certifiedByName) => {
              companion.publishActivity('Certifying story', {
                repairOrderId: ro.currentRO!.id,
                lineId: ro.currentLine!.id,
              });
              runAction('Certify and save story', () =>
                ro.certifyAndSaveStory(ro.currentLine!.id, storyText, certifiedByName)
              );
            }}
          />
          </div>
        </ViewErrorBoundary>
      )}

      {ro.view === 'settings' && (
        <SettingsView
          session={session}
          onBack={() => ro.setView(ro.currentRO ? 'ro' : 'home')}
          onLogout={onLogout}
          onOpenAuditLogs={isManager ? () => ro.setView('audit') : undefined}
          onOpenServiceAdvisors={isManager ? () => ro.setView('advisors') : undefined}
          onOpenTechnicians={isManager ? () => ro.setView('technicians') : undefined}
        />
      )}

      {ro.view === 'audit' && (
        <ViewErrorBoundary viewName="audit logs">
          <AuditLogView session={session} onBack={() => ro.setView(isManager ? 'home' : 'settings')} />
        </ViewErrorBoundary>
      )}

      {ro.view === 'advisors' && isManager && (
        <ViewErrorBoundary viewName="service advisors">
          <ServiceAdvisorsView onBack={() => ro.setView('home')} />
        </ViewErrorBoundary>
      )}

      {ro.view === 'technicians' && isManager && (
        <ViewErrorBoundary viewName="technicians">
          <TechniciansView onBack={() => ro.setView('home')} />
        </ViewErrorBoundary>
      )}

      <AppFooter />
    </div>
      )}
    </CompanionSyncBridge>
  );
}