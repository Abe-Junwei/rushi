import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranscriptionLayer } from "../pages/useTranscriptionLayer";
import { buildSegmentContextMenuItems, type SegmentContextMenuKey } from "../utils/segmentContextMenuModel";
import { EnvironmentPanel } from "./EnvironmentPanel";
import { EditorView } from "./EditorView";

import { ProjectSidebar } from "./ProjectSidebar";
import { WelcomeView } from "./WelcomeView";
import { ProjectHeader } from "./ProjectHeader";
import { AsrErrorBanner, ProjectBusyOverlay } from "./ProjectStatusFeedback";
import { useGlossaryController } from "../pages/useGlossaryController";
import { useProjectController } from "../pages/useProjectController";

export function ProjectPanel() {
  const c = useProjectController();
  const gl = useGlossaryController();
  const [envOpen, setEnvOpen] = useState(false);
  const [onlineSttFocusSeq, setOnlineSttFocusSeq] = useState(0);
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

  const txRef = useRef(tx);
  txRef.current = tx;

  useLayoutEffect(() => {
    const attach = c.attachSegmentListDomRoot;
    attach(() => txRef.current.tierScrollRef.current);
    return () => attach(null);
  }, [c.attachSegmentListDomRoot]);

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

  const showAsrBanner = workspacePhase === "A" && c.asrHealth === "error";

  const openOnlineSttProvider = () => {
    setEnvOpen(true);
    setOnlineSttFocusSeq((n) => n + 1);
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
        "workspace relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg select-none",
        workspacePhase === "A"
          ? "border border-zen-gray-300 bg-zen-paper font-sans antialiased text-app-text-main"
          : "border border-zen-gray-300 bg-zen-paper text-zen-ink",
      ].join(" ")}
    >
      <ProjectHeader
        workspacePhase={workspacePhase}
        asrHealth={c.asrHealth}
        asrCaps={c.asrCaps}
        asrHealthDetail={c.asrHealthDetail}
        sttOnlineBridgeReady={c.sttOnlineBridgeReady}
        busy={c.busy}
        envOpen={envOpen}
        setEnvOpen={setEnvOpen}
        onOpenOnlineStt={openOnlineSttProvider}
      />

      {c.error ? (
        <p className="mx-4 mt-3 shrink-0 rounded border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">
          {c.error}
        </p>
      ) : null}

      {envOpen ? (
        <div className="max-h-[min(28rem,42vh)] shrink-0 overflow-y-auto border-b border-black/[0.06]">
          <EnvironmentPanel
            asrHealth={c.asrHealth}
            asrHealthDetail={c.asrHealthDetail}
            bundledAsrDiag={c.bundledAsrDiag}
            asrCaps={c.asrCaps}
            funasrInstallMessage={c.funasrInstallMessage}
            prepareModelBusy={c.prepareModelBusy}
            prepareModelProgress={c.prepareModelProgress}
            prepareModelFailure={c.prepareModelFailure}
            busy={c.busy}
            refreshAsrHealth={c.refreshAsrHealth}
            installFunasrDepsInteractive={c.installFunasrDepsInteractive}
            copyFunasrManualCommands={c.copyFunasrManualCommands}
            prepareDefaultFunasrModel={c.prepareDefaultFunasrModel}
            retryBundledAsrSidecar={c.retryBundledAsrSidecar}
            openAppDataFolder={c.openAppDataFolder}
            onSttOnlineRuntimeChanged={c.bumpSttOnlineRuntimeChanged}
            focusOnlineSttSeq={onlineSttFocusSeq}
          />
        </div>
      ) : null}

      <div
        className={`flex min-h-0 min-w-0 flex-1 flex-col border-t lg:flex-row lg:items-stretch ${
          workspacePhase === "A" ? "border-black/5" : "border-black/[0.06]"
        }`}
      >
        {workspacePhase === "C" ? (
          <ProjectSidebar
            controller={c}
            glossary={gl}
            workspacePhase={workspacePhase}
            onOpenOnlineStt={openOnlineSttProvider}
          />
        ) : null}

        <main
          className={`relative flex min-h-[12rem] min-w-0 flex-1 flex-col lg:min-h-0 ${
            workspacePhase === "A" ? "bg-transparent" : "bg-zen-ochre"
          }`}
        >
          {workspacePhase === "A" ? <WelcomeView controller={c} onOpenOnlineStt={openOnlineSttProvider} reserveTopSpace={showAsrBanner} /> : null}

          {workspacePhase === "C" ? (
            <EditorView
              controller={c}
              tx={tx}
              exportKey={exportKey}
              onExportSelect={onExportSelect}
              segmentCtxMenu={segmentCtxMenu}
              setSegmentCtxMenu={setSegmentCtxMenu}
              segmentCtxMenuItems={segmentCtxMenuItems}
              onSegmentCtxMenuSelect={onSegmentCtxMenuSelect}
            />
          ) : null}
        </main>
      </div>

      {showAsrBanner ? (
        <div className="pointer-events-none absolute left-4 right-4 top-20 z-40">
          <div className="pointer-events-auto">
            <AsrErrorBanner onOpenEnvironment={() => setEnvOpen(true)} />
          </div>
        </div>
      ) : null}

      {c.busy ? <ProjectBusyOverlay reason={c.busyReason} elapsedSec={busyElapsedSec} /> : null}
    </section>
  );
}
