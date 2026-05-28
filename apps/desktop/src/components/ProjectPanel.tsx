import { useEffect, useMemo, useState } from "react";
import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import { buildSegmentContextMenuItems, type SegmentContextMenuKey } from "../utils/segmentContextMenuModel";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { AutoPunctuatePreviewDialog } from "./AutoPunctuatePreviewDialog";
import { EditorView } from "./EditorView";

import { WelcomeView, type WelcomePageId } from "./WelcomeView";
import { ProjectBusyOverlay } from "./ProjectStatusFeedback";
import { TranscribeHintsBanner } from "./TranscribeHintsBanner";
import { UnsavedCloseDialog } from "./UnsavedCloseDialog";
import { useProjectController } from "../pages/useProjectController";

export function ProjectPanel() {
  const c = useProjectController();
  const [envOpen, setEnvOpen] = useState(false);
  const [welcomePage, setWelcomePage] = useState<WelcomePageId>("home");
  const [exportKey, setExportKey] = useState("");
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [segmentCtxMenu, setSegmentCtxMenu] = useState<{
    x: number;
    y: number;
    segmentIdx: number;
    pointerTimeSec: number;
  } | null>(null);

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
  });

  const segmentCtxMenuItems = useMemo(
    () =>
      segmentCtxMenu
        ? buildSegmentContextMenuItems({
            segmentIdx: segmentCtxMenu.segmentIdx,
            segments,
            busy,
            pointerTimeSec: segmentCtxMenu.pointerTimeSec,
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

      <TranscribeHintsBanner hints={c.transcribeHints} />

      {envOpen ? (
        <FloatingPanelTemplate id="environment-v3" title="环境与 ASR" preset="environment" onClose={() => setEnvOpen(false)}>
            <EnvironmentPanel
              asrHealth={c.asrHealth}
              asrHealthDetail={c.asrHealthDetail}
              bundledAsrDiag={c.bundledAsrDiag}
              asrCaps={c.asrCaps}
              asrModelCacheInfo={c.asrModelCacheInfo}
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
              retryBundledAsrSidecar={c.retryBundledAsrSidecar}
              openAppDataFolder={c.openAppDataFolder}
              exportDiagnosticBundle={c.exportDiagnosticBundle}
              asrSetup={c.asrSetup}
              localAsrModelCatalog={c.localAsrModelCatalog}
              onSttOnlineRuntimeChanged={c.bumpSttOnlineRuntimeChanged}
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

      {c.busy ? <ProjectBusyOverlay reason={c.busyReason} elapsedSec={busyElapsedSec} /> : null}

      <AutoPunctuatePreviewDialog
        state={c.autoPunctuateDialog}
        onCancel={c.cancelAutoPunctuate}
        onConfirmConsent={c.confirmAutoPunctuateConsent}
        onConfirmWriteback={c.confirmAutoPunctuateWriteback}
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
