import { AppHeader } from './components/AppHeader';
import { HomeView } from './components/HomeView';
import { LineView } from './components/LineView';
import { ROView } from './components/ROView';
import { SettingsView } from './components/SettingsView';
import { useApiKey } from './hooks/useApiKey';
import { useOcrProgress } from './hooks/useOcrProgress';
import { useRepairOrders } from './hooks/useRepairOrders';

function App() {
  const apiKeyState = useApiKey();
  const ocr = useOcrProgress();
  const ro = useRepairOrders({
    apiKey: apiKeyState.apiKey,
    onOcrStart: ocr.startOcr,
    onOcrFinish: ocr.finishOcr,
    setOcrProgress: ocr.setOcrProgress,
  });

  const goToSettings = () => ro.setView('settings');

  return (
    <div className="app-container">
      {ro.view !== 'home' && ro.view !== 'settings' && <AppHeader onOpenSettings={goToSettings} />}

      {ro.view === 'home' && (
        <HomeView
          filteredROs={ro.filteredROs}
          searchTerm={ro.searchTerm}
          onSearchChange={ro.setSearchTerm}
          pendingROImages={ro.pendingROImages}
          isProcessingOCR={ocr.isProcessingOCR}
          ocrProgress={ocr.ocrProgress}
          onAddROPhoto={ro.addROPhoto}
          onCreateManualRO={ro.createManualRO}
          onClearPending={() => ro.setPendingROImages([])}
          onRemovePending={(index) => ro.setPendingROImages((prev) => prev.filter((_, i) => i !== index))}
          onProcessPending={ro.processPendingROImages}
          onOpenRO={ro.openRO}
          onDeleteRO={ro.deleteRO}
          onOpenSettings={goToSettings}
        />
      )}

      {ro.view === 'ro' && ro.currentRO && (
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
          onAddROXentryPhotos={ro.addROXentryPhotos}
          onAddRepairLine={ro.addRepairLine}
          onOpenLine={(lineId) => {
            const latest = ro.getLatestRO(ro.currentRO);
            if (latest) ro.setCurrentRO(latest);
            ro.setCurrentLineId(lineId);
            ro.setView('line');
          }}
          onDeleteRO={() => ro.deleteRO(ro.currentRO!.id)}
        />
      )}

      {ro.view === 'line' && ro.currentRO && ro.currentLine && (
        <LineView
          ro={ro.currentRO}
          line={ro.currentLine}
          isProcessingOCR={ocr.isProcessingOCR}
          ocrProgress={ocr.ocrProgress}
          isGenerating={ro.isGenerating}
          hasApiKey={!!apiKeyState.apiKey}
          onBack={() => {
            const latest = ro.getLatestRO(ro.currentRO);
            if (latest) ro.setCurrentRO(latest);
            ro.setView('ro');
          }}
          onUpdateLine={(updates) => ro.updateLine(ro.currentLine!.id, updates)}
          onAddXentryPhotos={() => ro.addXentryPhotos(ro.currentLine!.id)}
          onApplySmartDefaults={() => ro.applySmartDefaultsToLine(ro.currentLine!.id)}
          onGenerateStory={() =>
            ro.generateStory(
              ro.currentLine!.id,
              apiKeyState.apiKey,
              apiKeyState.hasEncryptedKey,
              apiKeyState.isUnlocked,
              goToSettings
            )
          }
          onCopyStory={ro.copyStory}
        />
      )}

      {ro.view === 'settings' && (
        <SettingsView
          apiKey={apiKeyState.apiKey}
          passphrase={apiKeyState.passphrase}
          hasEncryptedKey={apiKeyState.hasEncryptedKey}
          isUnlocked={apiKeyState.isUnlocked}
          onBack={() => ro.setView(ro.currentRO ? 'ro' : 'home')}
          onApiKeyChange={apiKeyState.setApiKey}
          onPassphraseChange={apiKeyState.setPassphrase}
          onUnlock={() => apiKeyState.unlock(apiKeyState.passphrase)}
          onSaveKey={() => apiKeyState.saveKey(apiKeyState.apiKey, apiKeyState.passphrase)}
          onClearKeys={apiKeyState.clearKeys}
        />
      )}
    </div>
  );
}

export default App;