import { useEffect, useMemo, useState } from "react";
import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import {
  buildSegmentContextMenuItems,
  type SegmentContextMenuKey,
  type SegmentContextMenuOpen,
} from "../utils/segmentContextMenuModel";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { AutoPunctuatePreviewDialog } from "./AutoPunctuatePreviewDialog";
import { SegmentRefinePreviewDialog } from "./SegmentRefinePreviewDialog";
import { LexiconProofreadPreviewDialog } from "./LexiconProofreadPreviewDialog";
import { FindReplaceDialog } from "./FindReplaceDialog";
import { CorrectionRulesPreviewDialog } from "./CorrectionRulesPreviewDialog";
import { CorrectSuggestionsDialog } from "./CorrectSuggestionsDialog";
import { GlossaryLearnPromptDialog } from "./GlossaryLearnPromptDialog";
import { TranscribeOverwriteConfirmDialog } from "./TranscribeOverwriteConfirmDialog";
import { EditorView } from "./EditorView";

import { WelcomeView, type WelcomePageId } from "./WelcomeView";
import { ProjectBusyOverlay, TranscribePreviewBanner } from "./ProjectStatusFeedback";
import { UnsavedCloseDialog } from "./UnsavedCloseDialog";
import { useProjectController } from "../pages/useProjectController";

export function ProjectPanel() {
  const c = useProjectController();
  const [envOpen, setEnvOpen] = useState(false);
  const [welcomePage, setWelcomePage] = useState<WelcomePageId>("home");
  const [exportKey, setExportKey] = useState("");
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [segmentCtxMenu, setSegmentCtxMenu] = useState<SegmentContextMenuOpen | null>(null);

  const { segments, busy } = c;

  const workspacePhase = useMemo<"A" | "C">(() => {
    if (c.current) return "C";
    return "A";
  }, [c]);

  useEffect(() => {
    if (workspacePhase !== "A") setWelcomePage("home");
  }, [workspacePhase]);

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
      case "docx_verbatim":
        void c.exportDocx("verbatim");
        break;
      case "docx_lecture":
        void c.exportDocx("lecture");
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
        <FloatingPanelTemplate id="environment-v3" title="环境与 ASR" preset="environment" onClose={() => setEnvOpen(false)}>
            <EnvironmentPanel
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
              installFunasrDepsInteractive={c.installFunasrDepsInteractive}
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
              onLlmRuntimeChanged={c.bumpLlmRuntimeChanged}
            />
        </FloatingPanelTemplate>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {workspacePhase === "A" ? (
          <WelcomeView
            controller={c}
            onOpenSettings={() => setEnvOpen(true)}
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
              onOpenEnvironment={() => setEnvOpen(true)}
              segmentCtxMenu={segmentCtxMenu}
              setSegmentCtxMenu={setSegmentCtxMenu}
              segmentCtxMenuItems={segmentCtxMenuItems}
              onSegmentCtxMenuSelect={onSegmentCtxMenuSelect}
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

      <AutoPunctuatePreviewDialog
        state={c.autoPunctuateDialog}
        onCancel={c.cancelAutoPunctuate}
        onConfirmConsent={c.confirmAutoPunctuateConsent}
        onConfirmWriteback={c.confirmAutoPunctuateWriteback}
      />

      <SegmentRefinePreviewDialog
        state={c.segmentRefineDialog}
        onCancel={c.cancelSegmentRefine}
        onConfirmConsent={c.confirmSegmentRefineConsent}
        onConfirmWriteback={c.confirmSegmentRefineWriteback}
      />

      <LexiconProofreadPreviewDialog
        state={c.lexiconProofreadDialog}
        onCancel={c.cancelLexiconProofread}
        onConfirmConsent={c.confirmLexiconProofreadConsent}
        onConfirmWriteback={c.confirmLexiconProofreadWriteback}
        onAcceptRulesChange={c.setLexiconAcceptRulesOnWriteback}
        onToggleOp={c.toggleLexiconProofreadOp}
        onSelectAllOps={c.setAllLexiconProofreadOps}
      />

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
        onRequestReplaceAll={c.findReplaceRequestReplaceAll}
        onConfirmReplaceAll={c.findReplaceConfirmReplaceAll}
        onCancelReplaceAllPreview={c.findReplaceCancelReplaceAllPreview}
      />

      <CorrectionRulesPreviewDialog
        state={c.correctionRulesDialog}
        busy={c.busy}
        onCancel={c.cancelCorrectionRules}
        onConfirm={c.confirmCorrectionRulesWriteback}
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
        onConfirm={c.confirmAddToGlossary}
      />

      <TranscribeOverwriteConfirmDialog
        open={c.transcribeOverwriteDialogOpen && !c.busy}
        busy={c.busy}
        segmentCount={c.transcribeOverwriteSegmentCount}
        vocabularyLines={c.transcribeVocabularyPreflightLines}
        onCancel={c.cancelTranscribeOverwrite}
        onConfirm={c.confirmTranscribeOverwrite}
      />

      <UnsavedCloseDialog
        open={c.closeGateOpen}
        intent={c.closeGateIntent}
        busy={c.busy}
        onStay={c.stayAfterCloseAttempt}
        onDiscardAndClose={() => void c.discardUnsavedAndClose()}
        onSaveAndClose={() => void c.saveAndClose()}
      />
    </section>
  );
}
