import { useEffect, useMemo, useState } from "react";
import { asrBaseUrl } from "../config/env";

import { useP1TranscriptionLayer } from "../pages/useP1TranscriptionLayer";
import { buildP1SegmentContextMenuItems, type P1SegmentContextMenuKey } from "../utils/p1SegmentContextMenuModel";
import { P1EnvironmentPanel } from "./P1EnvironmentPanel";
import { P1ConfirmCreateView } from "./P1ConfirmCreateView";
import { P1EditorView } from "./P1EditorView";
import { P1ProjectSidebar } from "./P1ProjectSidebar";
import { P1WelcomeView } from "./P1WelcomeView";
import { useGlossaryP2Controller } from "../pages/useGlossaryP2Controller";
import type { P1BusyReason } from "../pages/useProjectP1Controller";
import { useProjectP1Controller } from "../pages/useProjectP1Controller";

const btnSecondary =
  "rounded border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-zen-ink transition-colors hover:border-zen-saffron/35 hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40";
const btnOnlineSttEntry =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-zen-saffron/35 bg-white/80 px-3 py-1.5 text-xs font-medium text-zen-saffron shadow-sm transition-colors hover:border-zen-saffron/55 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40 disabled:cursor-not-allowed disabled:opacity-40";

/** 欢迎顶栏：亮绿 / 红（与 Stitch 稿一致） */
function WelcomeStatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-zen-success" : "bg-red-500"}`}
      aria-hidden
    />
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-zen-saffron" : "bg-zen-cinnabar"}`}
      aria-hidden
    />
  );
}

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

  const segmentCtxMenuItems = useMemo(
    () =>
      segmentCtxMenu
        ? buildP1SegmentContextMenuItems({
            segmentIdx: segmentCtxMenu.segmentIdx,
            segments: c.segments,
            busy: c.busy,
            pointerTimeSec: segmentCtxMenu.pointerTimeSec,
          })
        : [],
    [segmentCtxMenu, c.segments, c.busy],
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
        "flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg shadow-sm select-none",
        workspacePhase === "A"
          ? "border border-black/[0.06] bg-[radial-gradient(circle_at_top_center,#fbfaf6_0%,#f3f1e8_100%)] font-sans antialiased text-app-text-main"
          : workspacePhase === "B"
            ? "border border-black/[0.06] bg-[radial-gradient(circle,rgba(255,255,255,0.4)_0%,rgba(247,244,240,1)_100%)] font-sans antialiased text-gray-800"
            : "border border-black/[0.08] bg-zen-paper text-zen-ink",
      ].join(" ")}
    >
      {workspacePhase === "A" ? (
        <header
          className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-8 py-8 sm:px-12"
          data-purpose="navigation-bar"
        >
          <div className="text-2xl font-serif font-bold tracking-wider text-app-text-main" data-purpose="site-logo">
            如是我闻
          </div>
          <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4" data-purpose="status-controls">
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-black/5 p-1 px-3">
              {c.asrHealth === "ok" && c.asrCaps ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-zen-gray-500">
                    <WelcomeStatusDot ok={c.asrCaps.ffmpeg_ok} />
                    FFmpeg
                  </span>
                  <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-zen-gray-500">
                    <WelcomeStatusDot ok={c.asrCaps.funasr_import_ok} />
                    FunASR
                  </span>
                  <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-zen-gray-500">
                    <WelcomeStatusDot ok={c.asrCaps.funasr_ready} />
                    转写就绪
                  </span>
                </>
              ) : c.asrHealth === "checking" ? (
                <span className="text-xs text-app-text-muted">正在检测 ASR…</span>
              ) : c.asrHealth === "error" && c.sttOnlineBridgeReady ? (
                <span className="text-xs text-app-text-muted">本机 ASR 未连接 · 在线 STT 已就绪</span>
              ) : c.asrHealth === "error" ? (
                <span className="text-xs text-red-600">ASR 不可达</span>
              ) : null}
            </div>
            <div className="flex items-center gap-3 rounded-full bg-black/5 px-4 py-1.5" data-purpose="toggle-container">
              <span className="text-xs font-medium text-app-text-muted">环境与 ASR</span>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={envOpen}
                  onChange={() => setEnvOpen((v) => !v)}
                  aria-expanded={envOpen}
                />
                <div className="relative h-5 w-9 shrink-0 rounded-full bg-gray-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-app-accent peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-app-accent/50" />
              </label>
            </div>
            <button
              type="button"
              className={btnOnlineSttEntry}
              disabled={c.busy}
              onClick={openOnlineSttProvider}
              aria-controls="p1-online-stt-provider"
            >
              在线 STT Provider
            </button>
            <code className="hidden max-w-[12rem] truncate font-mono text-[10px] text-zen-indigo xl:inline">{asrBaseUrl()}</code>
          </div>
        </header>
      ) : workspacePhase === "B" ? (
        <header
          className="flex shrink-0 w-full max-w-7xl items-center justify-between gap-4 self-center px-8 py-8"
          data-purpose="main-header"
        >
          <div className="text-2xl font-bold tracking-wider text-gray-800 font-serif" data-purpose="site-logo">
            如是我闻
          </div>
          <div className="flex items-center gap-3 font-sans text-sm text-gray-500">
            <span>环境 ASR</span>
            <label className="relative inline-block h-[22px] w-[44px] shrink-0 cursor-pointer">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={envOpen}
                onChange={() => setEnvOpen((v) => !v)}
                aria-expanded={envOpen}
              />
              <span className="pointer-events-none absolute inset-0 rounded-[34px] bg-zen-ochre transition-colors peer-checked:bg-brand-orange" />
              <span className="pointer-events-none absolute bottom-[3px] left-[3px] h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-[22px]" />
            </label>
            <button
              type="button"
              className={`${btnOnlineSttEntry} border-brand-orange/40 text-gray-700 hover:text-brand-orange`}
              disabled={c.busy}
              onClick={openOnlineSttProvider}
              aria-controls="p1-online-stt-provider"
            >
              在线 STT Provider
            </button>
          </div>
        </header>
      ) : (
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] bg-white/40 px-4 py-2 backdrop-blur-sm">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <span className="text-[11px] font-medium tracking-[0.18em] text-zen-stone">如是我闻 · 本地校对</span>
            {c.asrHealth === "ok" && c.asrCaps ? (
              <div className="flex flex-wrap items-center gap-3 text-[10px] text-zen-stone">
                <span className="flex items-center gap-1.5">
                  <StatusDot ok={c.asrCaps.ffmpeg_ok} />
                  FFmpeg
                </span>
                <span className="flex items-center gap-1.5">
                  <StatusDot ok={c.asrCaps.funasr_import_ok} />
                  FunASR
                </span>
                <span className="flex items-center gap-1.5">
                  <StatusDot ok={c.asrCaps.funasr_ready} />
                  转写就绪
                </span>
              </div>
            ) : c.asrHealth === "checking" ? (
              <span className="text-[10px] text-zen-stone">正在检测 ASR…</span>
            ) : c.asrHealth === "error" && c.sttOnlineBridgeReady ? (
              <span className="text-[10px] text-zen-stone">本机 ASR 未连接 · 在线 STT 已就绪</span>
            ) : c.asrHealth === "error" ? (
              <span className="text-[10px] text-zen-cinnabar">ASR 不可达</span>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              className={`${btnSecondary} text-[11px]`}
              onClick={() => setEnvOpen((v) => !v)}
              aria-expanded={envOpen}
            >
              {envOpen ? "收起环境与 ASR" : "环境与 ASR"}
            </button>
            <button
              type="button"
              className={btnOnlineSttEntry}
              disabled={c.busy}
              onClick={openOnlineSttProvider}
              aria-controls="p1-online-stt-provider"
            >
              在线 STT Provider
            </button>
            <code className="hidden max-w-[12rem] truncate text-[10px] text-zen-indigo lg:inline">{asrBaseUrl()}</code>
          </div>
        </header>
      )}

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
            workspacePhase === "A" || workspacePhase === "B" ? "bg-transparent" : "bg-zen-paper/80"
          }`}
        >
          {c.busy ? (
            <div
              className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-zen-paper/85 px-6 text-center backdrop-blur-sm"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="text-sm font-medium text-zen-ink">{busyCopy.title}</p>
              <p className="max-w-sm text-[12px] text-zen-stone">{busyCopy.hint}</p>
              <div className="h-1.5 w-48 overflow-hidden rounded-full bg-black/[0.08]">
                <div className="h-full w-1/3 animate-pulse rounded-full bg-zen-saffron/80" />
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
