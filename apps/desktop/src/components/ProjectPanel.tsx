import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import { useProjectPanelShell } from "../pages/useProjectPanelShell";
import { MAIN_SHELL_SURFACE_CLASS } from "../config/shellVisualTokens";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { EditorView } from "./EditorView";
import { ProjectHubView } from "./ProjectHubView";
import { WelcomeView } from "./WelcomeView";
import { WelcomeSidebar } from "./WelcomeSidebar";
import { ProjectBusyOverlay, TranscribeWorkspaceBanners } from "./ProjectStatusFeedback";
import { ProjectPanelDialogs } from "./ProjectPanelDialogs";
import { useWelcomeWorkflowShortcuts } from "../hooks/useWelcomeWorkflowShortcuts";
import { syncOnboardingExport } from "../services/onboarding/onboardingAutoSync";
import { CollapsibleWorkspaceShell } from "./CollapsibleWorkspaceShell";
import { WORKSPACE_EDITOR_SHELL_PURPOSE } from "./WorkspaceShellLayout";
import { hasRecordedProjectMetadata } from "../services/deliveryModeChecklist";

export function ProjectPanel() {
  const shell = useProjectPanelShell();
  const {
    c,
    deliveryMode,
    envOpen,
    setEnvOpen,
    focusLocalAsrSeq,
    focusOnlineSttSeq,
    focusLlmSeq,
    llmUiEpoch,
    welcomePage,
    setWelcomePage,
    glossaryWorkspaceId,
    setGlossaryWorkspaceId,
    exportKey,
    deliveryExportOpen,
    setDeliveryExportOpen,
    busyElapsedSec,
    segmentCtxMenu,
    setSegmentCtxMenu,
    workspaceShellVariant,
    openEnvironment,
    openAsrSettings,
    openOnlineSttSettings,
    openLlmSettings,
    notifyLlmRuntimeChanged,
    onLeaveProjectForWelcome,
    showTranscribeGlossaryLink,
    openGlossaryFromTranscribe,
    stayAfterCloseAttempt,
    openSegmentContextMenu,
    onExportSelect,
    dismissTranscribeDiag,
    cancelTranscribe,
  } = shell;

  useWelcomeWorkflowShortcuts({
    enabled: workspaceShellVariant !== "editor",
    onOpenSettings: openEnvironment,
  });

  const tx = useTranscriptionLayer({
    projectId: c.current?.id ?? null,
    fileId: c.currentFileId,
    mediaUrl: c.audioSrc,
    mediaDiskPath: c.audioStoragePath,
    segments: c.segments,
    selectedIdx: c.selectedIdx,
    busy: c.busy,
    selectionLo: c.selectionLo,
    selectionHi: c.selectionHi,
    selectionCount: c.selectionCount,
    isMultiSegmentSelection: c.isMultiSegmentSelection,
    isContiguousSelection: c.isContiguousSelection,
    selectedIndicesArray: c.selectedIndicesArray,
    isIndexInSelection: c.isIndexInSelection,
    selectSegmentAt: c.selectSegmentAt,
    selectSegmentRange: c.selectSegmentRange,
    selectSegmentIndices: c.selectSegmentIndices,
    undo: c.undo,
    redo: c.redo,
    updateSegmentBounds: c.updateSegmentBounds,
    insertSegmentFromTimeRange: c.insertSegmentFromTimeRange,
    splitAtSelection: c.splitAtSelection,
    splitAtPlayhead: c.splitAtPlayhead,
    mergeWithNext: c.mergeWithNext,
    mergeWithPrev: c.mergeWithPrev,
    mergeWithNextAt: c.mergeWithNextAt,
    mergeWithPrevAt: c.mergeWithPrevAt,
    mergeSegmentRange: c.mergeSegmentRange,
    insertSegmentAfter: c.insertSegmentAfter,
    deleteSegmentAt: c.deleteSegmentAt,
    requestDeleteSelection: c.requestDeleteSelection,
    requestDeleteSelectedIndices: c.requestDeleteSelectedIndices,
    confirmSegmentEditAndAdvance: c.confirmSegmentEditAndAdvance,
    saveSegments: c.saveSegments,
    triggerFindReplaceShortcut: c.triggerFindReplaceShortcut,
    closeFile: c.closeFile,
    openEnvironment,
    openSegmentAnnotationDialog: c.openSegmentAnnotationDialog,
    openManualCorrectionMemoryDialog: c.openManualCorrectionMemoryDialog,
    clearMultiSelection: c.clearMultiSelection,
    onOpenSegmentContextMenu: openSegmentContextMenu,
  });

  const transcribeBanners = (
    <TranscribeWorkspaceBanners
      transcribeFailureDiag={c.transcribeFailureDiag}
      errorMessage={c.error || null}
      busy={c.busy}
      busyReason={c.busyReason}
      busyElapsedSec={busyElapsedSec}
      transcribeProgress={c.transcribeProgress}
      transcribeSource={c.transcribeSource}
      transcribeVocabularyPreflightLines={c.transcribeVocabularyPreflightLines}
      transcribeCancelling={c.transcribeCancelling}
      onCancelTranscribe={cancelTranscribe}
      onDismissDiag={dismissTranscribeDiag}
      onOpenEnvironment={openEnvironment}
    />
  );

  return (
    <section
      className={[
        "workspace relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden select-none",
        workspaceShellVariant !== "editor"
          ? `rounded-none border-0 ${MAIN_SHELL_SURFACE_CLASS.sidebarBg} font-sans antialiased text-notion-text`
          : `rounded-none border-0 ${MAIN_SHELL_SURFACE_CLASS.pageBg} font-sans antialiased text-notion-text`,
      ].join(" ")}
    >
      {envOpen ? (
        <FloatingPanelTemplate id="environment-v3" title="设置" preset="environment" onClose={() => setEnvOpen(false)}>
          <EnvironmentPanel
            asrPresentation={c.asrPresentation}
            asrHealthDetail={c.asrHealthDetail}
            bundledAsrDiag={c.bundledAsrDiag}
            asrCaps={c.asrCaps}
            asrModelCacheInfo={c.asrModelCacheInfo}
            waveformPeaksCacheInfo={c.waveformPeaksCacheInfo}
            asrModelCacheBusy={c.asrModelCacheBusy}
            asrCacheMessage={c.asrCacheMessage}
            funasrInstallMessage={c.funasrInstallMessage}
            prepareModelBusy={c.prepareModelBusy}
            prepareModelCancelling={c.prepareModelCancelling}
            prepareModelProgress={c.prepareModelProgress}
            prepareModelFailure={c.prepareModelFailure}
            busy={c.busy}
            refreshAsrHealth={c.refreshAsrHealth}
            copyFunasrManualCommands={c.copyFunasrManualCommands}
            refreshAsrModelCacheInfo={c.refreshAsrModelCacheInfo}
            clearAsrModelCache={c.clearAsrModelCache}
            clearOrphanWaveformPeaksCache={c.clearOrphanWaveformPeaksCache}
            retryBundledAsrSidecar={c.retryBundledAsrSidecar}
            openAppDataFolder={c.openAppDataFolder}
            exportDiagnosticBundle={c.exportDiagnosticBundle}
            asrSetup={c.asrSetup}
            localAsrModelCatalog={c.localAsrModelCatalog}
            onSttOnlineRuntimeChanged={c.bumpSttOnlineRuntimeChanged}
            onLlmRuntimeChanged={notifyLlmRuntimeChanged}
            focusLocalAsrSeq={focusLocalAsrSeq}
            focusOnlineSttSeq={focusOnlineSttSeq}
            focusLlmSeq={focusLlmSeq}
            llmStatusRefreshSeq={llmUiEpoch}
          />
        </FloatingPanelTemplate>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {workspaceShellVariant === "welcome" ? (
          <WelcomeView
            controller={c}
            onOpenSettings={openEnvironment}
            onOpenAsrSettings={openAsrSettings}
            onOpenOnlineSttSettings={openOnlineSttSettings}
            onOpenLlmSettings={openLlmSettings}
            llmStatusRefreshSeq={llmUiEpoch}
            page={welcomePage}
            onPageChange={setWelcomePage}
            glossaryWorkspaceId={glossaryWorkspaceId}
            onGlossaryWorkspaceChange={setGlossaryWorkspaceId}
          />
        ) : workspaceShellVariant === "hub" ? (
          <ProjectHubView
            controller={c}
            onOpenSettings={openEnvironment}
            onOpenAsrSettings={openAsrSettings}
            onOpenOnlineSttSettings={openOnlineSttSettings}
            onOpenLlmSettings={openLlmSettings}
            llmStatusRefreshSeq={llmUiEpoch}
            onLeaveProjectForWelcome={onLeaveProjectForWelcome}
            glossaryWorkspaceId={glossaryWorkspaceId}
            onGlossaryWorkspaceChange={setGlossaryWorkspaceId}
            headerSlot={transcribeBanners}
          />
        ) : (
          <CollapsibleWorkspaceShell
            purpose={WORKSPACE_EDITOR_SHELL_PURPOSE}
            sidebar={
              <WelcomeSidebar
                controller={c}
                onOpenSettings={openEnvironment}
                page="home"
                onPageChange={() => {}}
                hubMode
                editorMode
                embeddedInCollapsibleShell
                activeProjectId={c.current?.id ?? null}
                activeFileId={c.currentFileId}
                onLeaveProjectForWelcome={onLeaveProjectForWelcome}
                glossaryWorkspaceId={glossaryWorkspaceId}
                onGlossaryWorkspaceChange={setGlossaryWorkspaceId}
              />
            }
          >
            <main className={`relative flex min-h-[12rem] min-w-0 flex-1 flex-col ${MAIN_SHELL_SURFACE_CLASS.pageBg} lg:min-h-0`}>
              {transcribeBanners}
              <EditorView
                controller={c}
                tx={tx}
                exportKey={exportKey}
                onExportSelect={onExportSelect}
                onOpenEnvironment={openEnvironment}
                onOpenAsrSettings={openAsrSettings}
                onOpenOnlineSttSettings={openOnlineSttSettings}
                onOpenLlmSettings={openLlmSettings}
                llmStatusRefreshSeq={llmUiEpoch}
                segmentCtxMenu={segmentCtxMenu}
                setSegmentCtxMenu={setSegmentCtxMenu}
                onOpenSegmentContextMenu={openSegmentContextMenu}
              />
            </main>
          </CollapsibleWorkspaceShell>
        )}
      </div>

      {c.busy &&
      c.busyReason !== "transcribe" &&
      c.busyReason !== "batch_transcribe" &&
      !c.duplicateImportConfirmOpen &&
      !c.duplicateImportChecking &&
      !(c.busyReason === "stage_b" && c.postTranscribeStageBDialog.phase === "loading") ? (
        <ProjectBusyOverlay
          reason={c.busyReason}
          elapsedSec={busyElapsedSec}
          transcribeProgress={c.transcribeProgress}
        />
      ) : null}

      <ProjectPanelDialogs
        c={c}
        deliveryModeOpen={deliveryMode.deliveryModeOpen}
        deliveryExportOpen={deliveryExportOpen}
        llmStatusRefreshSeq={llmUiEpoch}
        segments={c.segments}
        showTranscribeGlossaryLink={showTranscribeGlossaryLink}
        onOpenLlmSettings={openLlmSettings}
        onOpenGlossaryFromTranscribe={openGlossaryFromTranscribe}
        onStayAfterCloseAttempt={stayAfterCloseAttempt}
        onDeliveryModeClose={deliveryMode.closeDeliveryMode}
        onDeliveryModeContinue={() => {
          syncOnboardingExport();
          deliveryMode.continueToDeliveryExport(() => setDeliveryExportOpen(true));
        }}
        onDeliveryExportClose={() => setDeliveryExportOpen(false)}
        onDeliveryExport={(mode, includeRevisionAppendix, includeProjectMetadata, llmPolish, polishPreview) => {
          syncOnboardingExport();
          void c.exportDeliveryDocx({
            mode,
            includeRevisionAppendix,
            includeProjectMetadata,
            llmPolish,
            polishPreview,
          });
        }}
        hasRecordedMetadata={hasRecordedProjectMetadata({
          narrator: c.current?.narrator,
          recorded_at: c.current?.recorded_at,
          location: c.current?.location,
          subject: c.current?.subject,
          transcriber: c.current?.transcriber,
        })}
      />
    </section>
  );
}
