import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useP1TranscriptionLayer } from "../pages/useP1TranscriptionLayer";
import { buildP1SegmentContextMenuItems, type P1SegmentContextMenuKey } from "../utils/p1SegmentContextMenuModel";
import { P1EnvironmentPanel } from "./P1EnvironmentPanel";
import { P1ConfirmCreateView } from "./P1ConfirmCreateView";
import { P1EditorView } from "./P1EditorView";
import { P1ProjectSidebar } from "./P1ProjectSidebar";
import { P1WelcomeView } from "./P1WelcomeView";
import { P1ProjectHeader } from "./P1ProjectHeader";
import { useGlossaryP2Controller } from "../pages/useGlossaryP2Controller";
import type { P1BusyReason } from "../pages/useProjectP1Controller";
import { useProjectP1Controller } from "../pages/useProjectP1Controller";
import { P1_CLAY_BTN_SECONDARY } from "../config/p1ControlStyles";

const btnSecondary = P1_CLAY_BTN_SECONDARY;

function busyOverlayCopy(reason: P1BusyReason | null): { title: string; hint: string } {
  switch (reason) {
    case "transcribe":
      return { title: "正在从 ASR 拉取语段", hint: "完整识别可能需数分钟，请稍候" };
    case "save":
      return { title: "正在保存到 SQLite", hint: "请勿关闭应用" };
    case "create":
      return { title: "正在创建项目", hint: "正在复制音频并写入数据库…" };
    case "load":
      return { title: "正在加载项目", hint: "请稍候" };
    case "delete":
      return { title: "正在删除项目", hint: "请稍候" };
    case "install_funasr":
      return { title: "正在执行安装脚本", hint: "终端输出可在「环境与 ASR」中查看" };
    default:
      return { title: "处理中", hint: "请稍候" };
  }
}

export function ProjectP1Panel() {
  const c = useProjectP1Controller();
  const gl = useGlossaryP2Controller();
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

  const workspacePhase = useMemo<"A" | "B" | "C">(() => {
    if (!c.current && c.pickedPath) return "B";
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

  const tx = useP1TranscriptionLayer({
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
    const attach = c.attachP1SegmentListDomRoot;
    attach(() => txRef.current.tierScrollRef.current);
    return () => attach(null);
  }, [c.attachP1SegmentListDomRoot]);

  const segmentCtxMenuItems = useMemo(
    () =>
      segmentCtxMenu
        ? buildP1SegmentContextMenuItems({
            segmentIdx: segmentCtxMenu.segmentIdx,
            segments,
            busy,
            pointerTimeSec: segmentCtxMenu.pointerTimeSec,
          })
        : [],
    [segmentCtxMenu, segments, busy],
  );

  const onSegmentCtxMenuSelect = (key: P1SegmentContextMenuKey) => {
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

  const busyCopy = busyOverlayCopy(c.busyReason);
  const showAsrBanner = workspacePhase === "A" && c.asrHealth === "error" && !c.sttOnlineBridgeReady;

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

  const pickedBasename =
    c.pickedPath != null && c.pickedPath.length > 0 ? c.pickedPath.replace(/^.*[/\\]/, "") || c.pickedPath : "";

  return (
    <section
      className={[
        "p1-workspace flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg select-none",
        workspacePhase === "A"
          ? "border border-zen-gray-300 bg-zen-paper font-sans antialiased text-app-text-main"
          : workspacePhase === "B"
            ? "border border-zen-gray-300 bg-zen-paper font-sans antialiased text-app-text-main"
            : "border border-zen-gray-300 bg-zen-paper text-zen-ink",
      ].join(" ")}
    >
      <P1ProjectHeader
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

      {showAsrBanner ? (
        <div className="mx-4 mt-3 flex shrink-0 flex-wrap items-center justify-between gap-2 rounded border border-zen-cinnabar/20 bg-zen-cinnabar/10 px-3 py-2 text-[12px] text-zen-cinnabar">
          <span>无法连接本机 ASR；未配置可用的在线 STT 时无法从 ASR 拉取语段。</span>
          <button type="button" className={btnSecondary} onClick={() => setEnvOpen(true)}>
            打开环境与 ASR
          </button>
        </div>
      ) : null}

      {envOpen ? (
        <div className="max-h-[min(28rem,42vh)] shrink-0 overflow-y-auto border-b border-black/[0.06]">
          <P1EnvironmentPanel
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
          workspacePhase === "A" || workspacePhase === "B" ? "border-black/5" : "border-black/[0.06]"
        }`}
      >
        <P1ProjectSidebar
          controller={c}
          glossary={gl}
          workspacePhase={workspacePhase}
          onOpenOnlineStt={openOnlineSttProvider}
        />

        <main
          className={`relative flex min-h-[12rem] min-w-0 flex-1 flex-col lg:min-h-0 ${
            workspacePhase === "A" || workspacePhase === "B" ? "bg-transparent" : "bg-zen-ochre"
          }`}
        >
          {c.busy ? (
            <div
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-zen-paper/95 px-6 text-center"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="text-sm font-medium text-zen-ink">{busyCopy.title}</p>
              <p className="max-w-sm text-[12px] text-zen-stone">{busyCopy.hint}</p>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-black/[0.08]">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-zen-gray-300" />
              </div>
              <p className="font-mono text-[11px] tabular-nums text-zen-stone">已等待 {busyElapsedSec}s</p>
            </div>
          ) : null}

          {workspacePhase === "A" ? <P1WelcomeView controller={c} onOpenOnlineStt={openOnlineSttProvider} /> : null}

          {workspacePhase === "B" ? <P1ConfirmCreateView controller={c} pickedBasename={pickedBasename} /> : null}

          {workspacePhase === "C" ? (
            <P1EditorView
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
    </section>
  );
}
