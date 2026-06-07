import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import type { SegmentContextMenuOpen } from "../utils/segmentContextMenuModel";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { EditorView } from "./EditorView";
import { ProjectHubView } from "./ProjectHubView";
import { WelcomeView, type WelcomePageId } from "./WelcomeView";
import { ProjectBusyOverlay, TranscribePreviewBanner } from "./ProjectStatusFeedback";
import { ProjectPanelDialogs } from "./ProjectPanelDialogs";
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
  const pendingWelcomePageRef = useRef<WelcomePageId | null>(null);

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

  useEffect(() => {
    if (!deliveryExportOpen) return;
    c.flushSegmentTextDrafts();
  }, [deliveryExportOpen, c.flushSegmentTextDrafts]);

  const workspaceShellVariant = useMemo<"welcome" | "hub" | "editor">(() => {
    if (!c.current) return "welcome";
    if (!c.currentFileId) return "hub";
    return "editor";
  }, [c.current, c.currentFileId]);

  useEffect(() => {
    if (workspaceShellVariant !== "welcome") setWelcomePage("home");
  }, [workspaceShellVariant]);

  useEffect(() => {
    if (workspaceShellVariant === "welcome" && pendingWelcomePageRef.current) {
      const page = pendingWelcomePageRef.current;
      pendingWelcomePageRef.current = null;
      setWelcomePage(page);
    }
  }, [workspaceShellVariant]);

  const onLeaveProjectForWelcome = useCallback(
    (page: WelcomePageId) => {
      pendingWelcomePageRef.current = page;
      c.closeProject();
    },
    [c],
  );

  const showTranscribeGlossaryLink = useMemo(
    () => c.transcribeVocabularyPreflightLines.some((line) => line.includes("暂无纳入热词")),
    [c.transcribeVocabularyPreflightLines],
  );

  const openGlossaryFromTranscribe = useCallback(() => {
    c.cancelTranscribeStart();
    pendingWelcomePageRef.current = "glossary";
    if (c.current) {
      c.closeProject();
    } else {
      setWelcomePage("glossary");
    }
  }, [c]);

  const stayAfterCloseAttempt = useCallback(() => {
    pendingWelcomePageRef.current = null;
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
        workspaceShellVariant !== "editor"
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
        {workspaceShellVariant === "welcome" ? (
          <WelcomeView
            controller={c}
            onOpenSettings={openEnvironment}
            onOpenLlmSettings={openLlmSettings}
            llmStatusRefreshSeq={llmUiEpoch}
            page={welcomePage}
            onPageChange={setWelcomePage}
          />
        ) : workspaceShellVariant === "hub" ? (
          <ProjectHubView
            controller={c}
            onOpenSettings={openEnvironment}
            onOpenLlmSettings={openLlmSettings}
            llmStatusRefreshSeq={llmUiEpoch}
            onLeaveProjectForWelcome={onLeaveProjectForWelcome}
            headerSlot={
              c.busy && c.busyReason === "transcribe" ? (
                <TranscribePreviewBanner
                  elapsedSec={busyElapsedSec}
                  transcribeProgress={c.transcribeProgress}
                  cancelling={c.transcribeCancelling}
                  onCancel={() => {
                    void c.cancelTranscribe();
                  }}
                />
              ) : null
            }
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
            />
          </main>
        )}
      </div>

      {c.busy &&
      c.busyReason !== "transcribe" &&
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
        deliveryExportOpen={deliveryExportOpen}
        llmStatusRefreshSeq={llmUiEpoch}
        segments={c.segments}
        showTranscribeGlossaryLink={showTranscribeGlossaryLink}
        onOpenLlmSettings={openLlmSettings}
        onOpenGlossaryFromTranscribe={openGlossaryFromTranscribe}
        onStayAfterCloseAttempt={stayAfterCloseAttempt}
        onDeliveryExportClose={() => setDeliveryExportOpen(false)}
        onDeliveryExport={(mode, includeRevisionAppendix, llmPolish, polishPreview) => {
          void c.exportDeliveryDocx({
            mode,
            includeRevisionAppendix,
            llmPolish,
            polishPreview,
          });
        }}
      />
    </section>
  );
}
