import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import {
  buildSegmentContextMenuItems,
  type SegmentContextMenuKey,
  type SegmentContextMenuOpen,
} from "../utils/segmentContextMenuModel";
import { buildSegmentTextContextMenuItems } from "../utils/segmentTextContextMenuModel";
import { ManualCorrectionMemoryDialog } from "./segmentRow/ManualCorrectionMemoryDialog";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { FindReplaceDialog } from "./FindReplaceDialog";
import { CorrectionRulesPreviewDialog } from "./CorrectionRulesPreviewDialog";
import { PostTranscribeStageBDialog } from "./PostTranscribeStageBDialog";
import { CorrectSuggestionsDialog } from "./CorrectSuggestionsDialog";
import { GlossaryLearnPromptDialog } from "./GlossaryLearnPromptDialog";
import { AutoTranscribeStartDialog } from "./AutoTranscribeStartDialog";
import { EditorView } from "./EditorView";
import { DeliveryExportDialog } from "./DeliveryExportDialog";

import { WelcomeView, type WelcomePageId } from "./WelcomeView";
import { ProjectBusyOverlay, TranscribePreviewBanner } from "./ProjectStatusFeedback";
import { UnsavedCloseDialog } from "./UnsavedCloseDialog";
import { useProjectController } from "../pages/useProjectController";

export function ProjectPanel() {
  const c = useProjectController();
  const [envOpen, setEnvOpen] = useState(false);
  const [focusLlmSeq, setFocusLlmSeq] = useState(0);
  const [llmUiEpoch, setLlmUiEpoch] = useState(0);
  const [welcomePage, setWelcomePage] = useState<WelcomePageId>("home");
  const [exportKey, setExportKey] = useState("");
  const [deliveryExportOpen, setDeliveryExportOpen] = useState(false);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [segmentCtxMenu, setSegmentCtxMenu] = useState<SegmentContextMenuOpen | null>(null);
  const [segmentTextCtxMenu, setSegmentTextCtxMenu] = useState<{
    x: number;
    y: number;
    wrong: string;
  } | null>(null);
  const pendingGlossaryNavRef = useRef(false);

  const openEnvironment = useCallback(() => {
    setEnvOpen(true);
  }, []);

  const openLlmSettings = useCallback(() => {
    setEnvOpen(true);
    setFocusLlmSeq((n) => n + 1);
  }, []);

  const notifyLlmRuntimeChanged = useCallback(() => {
    c.bumpLlmRuntimeChanged();
    setLlmUiEpoch((n) => n + 1);
  }, [c]);

  const { segments, busy } = c;

  useEffect(() => {
    if (!deliveryExportOpen) return;
    c.flushSegmentTextDrafts();
  }, [deliveryExportOpen, c.flushSegmentTextDrafts]);

  const workspacePhase = useMemo<"A" | "C">(() => {
    if (c.current) return "C";
    return "A";
  }, [c]);

  useEffect(() => {
    if (workspacePhase !== "A") setWelcomePage("home");
  }, [workspacePhase]);

  useEffect(() => {
    if (workspacePhase === "A" && pendingGlossaryNavRef.current) {
      pendingGlossaryNavRef.current = false;
      setWelcomePage("glossary");
    }
  }, [workspacePhase]);

  const showTranscribeGlossaryLink = useMemo(
    () => c.transcribeVocabularyPreflightLines.some((line) => line.includes("暂无纳入热词")),
    [c.transcribeVocabularyPreflightLines],
  );

  const openGlossaryFromTranscribe = useCallback(() => {
    c.cancelTranscribeStart();
    pendingGlossaryNavRef.current = true;
    if (c.current) {
      c.closeProject();
    } else {
      setWelcomePage("glossary");
    }
  }, [c]);

  const stayAfterCloseAttempt = useCallback(() => {
    pendingGlossaryNavRef.current = false;
    c.stayAfterCloseAttempt();
  }, [c]);

  useEffect(() => {
    if (!c.busy) {
      setBusyElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setBusyElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [c.busy]);

  const tx = useTranscriptionLayer({
    projectId: c.current?.id ?? null,
    fileId: c.currentFileId,
    mediaUrl: c.audioSrc,
    segments: c.segments,
    selectedIdx: c.selectedIdx,
    setSelectedIdx: c.setSelectedIdx,
    busy: c.busy,
    undo: c.undo,
    redo: c.redo,
    updateSegmentBounds: c.updateSegmentBounds,
    insertSegmentFromTimeRange: c.insertSegmentFromTimeRange,
    splitAtSelection: c.splitAtSelection,
    splitAtPlayhead: c.splitAtPlayhead,
    mergeWithNext: c.mergeWithNext,
    mergeWithPrev: c.mergeWithPrev,
    insertSegmentAfter: c.insertSegmentAfter,
    deleteSegmentAt: c.deleteSegmentAt,
    confirmSegmentEditAndAdvance: c.confirmSegmentEditAndAdvance,
    onOpenSegmentContextMenu: setSegmentCtxMenu,
  });

  const segmentCtxMenuItems = useMemo(
    () =>
      segmentCtxMenu
        ? buildSegmentContextMenuItems({
            segmentIdx: segmentCtxMenu.segmentIdx,
            segments,
            busy,
            pointerTimeSec: segmentCtxMenu.pointerTimeSec,
            origin: segmentCtxMenu.origin,
          })
        : [],
    [segmentCtxMenu, segments, busy],
  );

  const segmentTextCtxMenuItems = useMemo(
    () =>
      segmentTextCtxMenu
        ? buildSegmentTextContextMenuItems({
            selectionText: segmentTextCtxMenu.wrong,
            busy,
          })
        : [],
    [segmentTextCtxMenu, busy],
  );

  const onSegmentCtxMenuSelect = (key: SegmentContextMenuKey) => {
    if (!segmentCtxMenu) return;
    const i = segmentCtxMenu.segmentIdx;
    switch (key) {
      case "delete":
        tx.deleteSegmentAt(i);
        break;
      case "mergePrev":
        c.mergeWithPrevAt(i);
        break;
      case "mergeNext":
        c.mergeWithNextAt(i);
        break;
      case "splitAtPointer":
        tx.splitAtPlayhead(segmentCtxMenu.pointerTimeSec);
        break;
      default:
        break;
    }
  };

  const onExportSelect = (key: string) => {
    setExportKey("");
    switch (key) {
      case "txt":
        void c.exportTxt();
        break;
      case "srt":
        void c.exportSrt();
        break;
      case "docx_delivery":
        setDeliveryExportOpen(true);
        break;
      case "docx_verbatim":
        void c.exportDocx("verbatim");
        break;
      case "docx_lecture":
        void c.exportDocx("lecture");
        break;
      case "docx_clean":
        void c.exportDocx("clean");
        break;
      default:
        break;
    }
  };

  return (
    <section
      className={[
        "workspace relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden select-none",
        workspacePhase === "A"
          ? "rounded-none border-0 bg-notion-sidebar font-sans antialiased text-notion-text"
          : "rounded-none border-0 bg-notion-bg font-sans antialiased text-notion-text",
      ].join(" ")}
    >
      {c.error ? (
        <p className="mx-4 mt-3 shrink-0 rounded border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          {c.error}
        </p>
      ) : null}

      {envOpen ? (
        <FloatingPanelTemplate id="environment-v3" title="环境与 LLM" preset="environment" onClose={() => setEnvOpen(false)}>
            <EnvironmentPanel
              asrPresentation={c.asrPresentation}
              asrHealth={c.asrHealth}
              asrHealthDetail={c.asrHealthDetail}
              bundledAsrDiag={c.bundledAsrDiag}
              asrCaps={c.asrCaps}
              asrModelCacheInfo={c.asrModelCacheInfo}
              waveformPeaksCacheInfo={c.waveformPeaksCacheInfo}
              asrModelCacheBusy={c.asrModelCacheBusy}
              asrCacheMessage={c.asrCacheMessage}
              funasrInstallMessage={c.funasrInstallMessage}
              prepareModelBusy={c.prepareModelBusy}
              prepareModelProgress={c.prepareModelProgress}
              prepareModelFailure={c.prepareModelFailure}
              busy={c.busy}
              refreshAsrHealth={c.refreshAsrHealth}
              copyFunasrManualCommands={c.copyFunasrManualCommands}
              prepareDefaultFunasrModel={c.prepareDefaultFunasrModel}
              cancelPrepareModel={c.cancelPrepareModel}
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
              focusLlmSeq={focusLlmSeq}
              llmStatusRefreshSeq={llmUiEpoch}
            />
        </FloatingPanelTemplate>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {workspacePhase === "A" ? (
          <WelcomeView
            controller={c}
            onOpenSettings={openEnvironment}
            onOpenLlmSettings={openLlmSettings}
            llmStatusRefreshSeq={llmUiEpoch}
            page={welcomePage}
            onPageChange={setWelcomePage}
          />
        ) : (
          <main className="relative flex min-h-[12rem] min-w-0 flex-1 flex-col bg-notion-bg lg:min-h-0">
            {c.busy && c.busyReason === "transcribe" ? (
              <TranscribePreviewBanner
                elapsedSec={busyElapsedSec}
                transcribeProgress={c.transcribeProgress}
                cancelling={c.transcribeCancelling}
                onCancel={() => {
                  void c.cancelTranscribe();
                }}
              />
            ) : null}
            <EditorView
              controller={c}
              tx={tx}
              exportKey={exportKey}
              onExportSelect={onExportSelect}
              onOpenEnvironment={openEnvironment}
              onOpenLlmSettings={openLlmSettings}
              llmStatusRefreshSeq={llmUiEpoch}
              segmentCtxMenu={segmentCtxMenu}
              setSegmentCtxMenu={setSegmentCtxMenu}
              segmentCtxMenuItems={segmentCtxMenuItems}
              onSegmentCtxMenuSelect={onSegmentCtxMenuSelect}
              segmentTextCtxMenu={segmentTextCtxMenu}
              setSegmentTextCtxMenu={setSegmentTextCtxMenu}
              segmentTextCtxMenuItems={segmentTextCtxMenuItems}
              onSegmentTextCtxMenuSelect={(key) => {
                if (!segmentTextCtxMenu) return;
                if (key === "addCorrectionMemory") {
                  c.openManualCorrectionMemoryDialog(segmentTextCtxMenu.wrong);
                }
              }}
            />
          </main>
        )}
      </div>

      {c.busy && c.busyReason !== "transcribe" ? (
        <ProjectBusyOverlay
          reason={c.busyReason}
          elapsedSec={busyElapsedSec}
          transcribeProgress={c.transcribeProgress}
        />
      ) : null}

      <FindReplaceDialog
        state={c.findReplaceDialog}
        busy={c.busy}
        onClose={c.closeFindReplace}
        onFindChange={c.setFindReplaceFindText}
        onReplaceChange={c.setFindReplaceReplaceText}
        onRunSearch={c.findReplaceRunSearch}
        onSelectMatch={c.findReplaceSelectMatch}
        onPrev={c.findReplaceGoPrev}
        onNext={c.findReplaceGoNext}
        onReplaceCurrent={c.findReplaceCurrent}
        onReplaceAndNext={c.findReplaceReplaceAndNext}
        onRequestReplaceAll={() => void c.findReplaceRequestReplaceAll()}
        onConfirmReplaceAll={() => void c.findReplaceConfirmReplaceAll()}
        onCancelReplaceAllPreview={c.findReplaceCancelReplaceAllPreview}
      />

      <CorrectionRulesPreviewDialog
        state={c.correctionRulesDialog}
        busy={c.busy}
        stableConflictMessage={c.correctionRulesStableConflictMessage ?? null}
        onCancel={c.cancelCorrectionRules}
        onCloseEmpty={c.closeCorrectionRulesEmpty}
        onConfirm={() => void c.confirmCorrectionRulesWriteback()}
        onToggleSegment={c.toggleCorrectionRulesSegment}
        onFocusSegment={c.focusCorrectionRulesPreviewSegment}
        previewFocusSegmentIdx={
          c.correctionRulesEditorHighlight?.segmentIdx ?? null
        }
      />

      <PostTranscribeStageBDialog
        state={c.postTranscribeStageBDialog}
        busy={c.busy}
        onCancel={c.cancelPostTranscribeStageB}
        onDismissBlocked={c.dismissPostTranscribeStageBBlocked}
        onConfirmConsent={c.confirmPostTranscribeStageBConsent}
        onConfirmWriteback={() => void c.confirmPostTranscribeStageBWriteback()}
        onToggleSegment={c.togglePostTranscribeStageBSegment}
      />

      <CorrectSuggestionsDialog
        state={c.correctSuggestionsDialog}
        onCancel={c.cancelCorrectSuggestions}
        onApply={c.applyCorrectSuggestion}
        onOpenFindReplace={c.openFindReplaceForCorrectSelection}
      />

      <GlossaryLearnPromptDialog
        state={c.glossaryLearnDialog}
        busy={c.busy}
        onClose={c.closeGlossaryLearnPrompt}
        onDismiss={c.dismissGlossaryLearnPrompt}
        onConfirm={(row) => void c.confirmAddToGlossary(row)}
      />

      <ManualCorrectionMemoryDialog
        state={c.manualCorrectionMemoryDialog}
        busy={c.busy}
        onClose={c.closeManualCorrectionMemoryDialog}
        onRightChange={c.setManualCorrectionRight}
        onAlsoAddToGlossaryChange={c.setManualCorrectionAlsoGlossary}
        onConfirm={() => c.confirmManualCorrectionMemory()}
      />

      <AutoTranscribeStartDialog
        open={c.transcribeStartDialogOpen && !c.busy}
        busy={c.busy}
        source={c.transcribeSource}
        onlineReady={c.onlineTranscribeReady}
        onSelectLocal={() => c.setTranscribeSource("local")}
        onSelectOnline={() => c.setTranscribeSource("online")}
        hasExistingSegmentText={c.transcribeStartHasExistingText}
        segmentCount={c.transcribeOverwriteSegmentCount}
        vocabularyLines={c.transcribeVocabularyPreflightLines}
        showOpenGlossaryLink={showTranscribeGlossaryLink}
        onOpenGlossary={openGlossaryFromTranscribe}
        onCancel={c.cancelTranscribeStart}
        onConfirm={() => void c.confirmTranscribeStart()}
      />

      <DeliveryExportDialog
        open={deliveryExportOpen}
        busy={c.busy}
        segments={c.segments}
        llmStatusRefreshSeq={llmUiEpoch}
        onOpenLlmSettings={openLlmSettings}
        onClose={() => setDeliveryExportOpen(false)}
        onExport={(mode, includeRevisionAppendix, llmPolish, polishPreview) => {
          setDeliveryExportOpen(false);
          void c.exportDeliveryDocx({
            mode,
            includeRevisionAppendix,
            llmPolish,
            polishPreview,
          });
        }}
      />

      <UnsavedCloseDialog
        open={c.closeGateOpen}
        intent={c.closeGateIntent}
        busy={c.busy}
        onStay={stayAfterCloseAttempt}
        onDiscardAndClose={() => void c.discardUnsavedAndClose()}
        onSaveAndClose={() => void c.saveAndClose()}
      />
    </section>
  );
}
