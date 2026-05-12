import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { asrBaseUrl } from "../config/env";
import { useP1TranscriptionLayer } from "../pages/useP1TranscriptionLayer";
import { buildP1SegmentContextMenuItems, type P1SegmentContextMenuKey, p1PointerTimeFromSegmentCard } from "../utils/p1SegmentContextMenuModel";
import { P1EnvironmentPanel } from "./P1EnvironmentPanel";
import { P1ResizeBottomHit } from "./P1ResizeBottomHit";
import { P1SegmentContextMenu } from "./P1SegmentContextMenu";
import { P1SegmentTimelineCard } from "./P1SegmentTimelineCard";
import { P1WaveformTimeRuler } from "./P1WaveformTimeRuler";
import { P1WaveformZoomBar } from "./P1WaveformZoomBar";
import { useGlossaryP2Controller } from "../pages/useGlossaryP2Controller";
import type { P1BusyReason } from "../pages/useProjectP1Controller";
import { useProjectP1Controller } from "../pages/useProjectP1Controller";
import type { ProjectSummary } from "../tauri/p1Api";

const btnPrimary =
  "rounded px-3 py-1.5 text-xs font-medium bg-zen-saffron text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40";
const btnSecondary =
  "rounded border border-black/10 bg-white/60 px-3 py-1.5 text-xs text-zen-ink transition-colors hover:border-zen-saffron/35 hover:text-zen-saffron disabled:cursor-not-allowed disabled:opacity-40";
/** 顶栏 / 侧栏 / 欢迎区「在线 STT Provider」独立入口 */
const btnOnlineSttEntry =
  "inline-flex shrink-0 items-center justify-center rounded-lg border border-zen-saffron/35 bg-white/80 px-3 py-1.5 text-xs font-medium text-zen-saffron shadow-sm transition-colors hover:border-zen-saffron/55 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40 disabled:cursor-not-allowed disabled:opacity-40";
const field =
  "block w-full rounded border border-black/10 bg-white/80 px-2 py-1 text-xs text-zen-ink outline-none transition-colors focus:border-zen-saffron/45 focus:ring-1 focus:ring-zen-saffron/20 disabled:cursor-not-allowed disabled:opacity-40";

/** 欢迎页主 CTA：内联绘制渐变（WKWebView 常忽略 class 上的 background-image） */
const welcomePrimaryInlineStyle: CSSProperties = {
  WebkitAppearance: "none",
  MozAppearance: "none",
  appearance: "none",
  borderStyle: "none",
  color: "#fff",
  backgroundColor: "#d49a5b",
  backgroundImage: "linear-gradient(to bottom, #e5bc94 0%, #d49a5b 100%)",
  boxShadow:
    "0 8px 24px -4px rgba(212, 163, 115, 0.5), 0 10px 15px -3px rgba(212, 163, 115, 0.3), 0 4px 6px -2px rgba(212, 163, 115, 0.18)",
};

const welcomePrimaryBtn =
  "rounded-lg px-12 py-3.5 text-[15px] font-medium transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100";

/** 确认创建页主按钮：截图稿为实心暖棕（无渐变），内联避免 WK 吞样式 */
const confirmCreatePrimaryStyle: CSSProperties = {
  WebkitAppearance: "none",
  MozAppearance: "none",
  appearance: "none",
  borderStyle: "none",
  color: "#fff",
  backgroundColor: "#c69c6d",
  boxShadow: "0 2px 8px rgba(198, 156, 109, 0.35)",
};

const confirmProjectInput =
  "p1-confirm-project-input block w-full appearance-none rounded-xl border-2 border-solid border-brand-input-border bg-white px-4 py-3 font-sans text-base font-medium text-gray-800 outline-none transition-[border-color,box-shadow] placeholder:text-gray-400 focus:border-brand-orange focus:shadow-[0_0_0_3px_rgba(217,160,102,0.1)] disabled:cursor-not-allowed disabled:opacity-40";

const confirmSecondaryBtn =
  "inline-flex appearance-none items-center justify-center rounded-xl border-0 bg-[#ececec] px-6 py-3 font-sans text-sm font-semibold text-gray-700 transition-all active:scale-95 hover:bg-[#e0e0e0] disabled:cursor-not-allowed disabled:opacity-40";

const welcomeGhostBtn =
  "inline-flex appearance-none items-center rounded-lg border-0 bg-black/5 px-4 py-2 text-sm font-medium text-app-text-muted transition-colors hover:bg-black/10 disabled:cursor-not-allowed disabled:opacity-40";

const welcomeSelect =
  'cursor-pointer appearance-none rounded-lg border-0 bg-black/5 bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat py-2 pl-4 pr-10 text-sm font-medium text-app-text-muted transition-colors hover:bg-black/10 disabled:opacity-40 bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'%23666\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")]';

const RECENT_PROJECT_LIMIT = 8;

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-zen-saffron" : "bg-zen-cinnabar"}`}
      aria-hidden
    />
  );
}

/** 欢迎顶栏：亮绿 / 红（与 Stitch 稿一致） */
function WelcomeStatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`mr-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-[#4ade80]" : "bg-red-500"}`}
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

function sortRecentProjects(list: ProjectSummary[]): ProjectSummary[] {
  return [...list].sort((a, b) => b.updated_at_ms - a.updated_at_ms).slice(0, RECENT_PROJECT_LIMIT);
}

export function ProjectP1Panel() {
  const c = useProjectP1Controller();
  const gl = useGlossaryP2Controller();
  const [envOpen, setEnvOpen] = useState(false);
  const [onlineSttFocusSeq, setOnlineSttFocusSeq] = useState(0);
  const [exportKey, setExportKey] = useState("");
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);

  /** 主舞台内容相（不含 busy；busy 时单独叠遮罩） */
  const workspacePhase = useMemo<"A" | "B" | "C">(() => {
    if (!c.current && c.pickedPath) return "B";
    if (c.current) return "C";
    return "A";
  }, [c.current, c.pickedPath]);

  const recentProjects = useMemo(() => sortRecentProjects(c.projects), [c.projects]);

  const [segmentCtxMenu, setSegmentCtxMenu] = useState<{
    x: number;
    y: number;
    segmentIdx: number;
    pointerTimeSec: number;
  } | null>(null);

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
    c.pickedPath != null && c.pickedPath.length > 0
      ? c.pickedPath.replace(/^.*[/\\]/, "") || c.pickedPath
      : "";

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
                  <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-[#555]">
                    <WelcomeStatusDot ok={c.asrCaps.ffmpeg_ok} />
                    FFmpeg
                  </span>
                  <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-[#555]">
                    <WelcomeStatusDot ok={c.asrCaps.funasr_import_ok} />
                    FunASR
                  </span>
                  <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-[#555]">
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
              <span className="pointer-events-none absolute inset-0 rounded-[34px] bg-[#d1cbc4] transition-colors peer-checked:bg-brand-orange" />
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
        <p className="mx-4 mt-3 shrink-0 rounded border border-zen-cinnabar/25 bg-zen-cinnabar/10 px-3 py-2 text-sm text-zen-cinnabar">{c.error}</p>
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
        <aside
          className={`${
            workspacePhase === "A" || workspacePhase === "B" ? "hidden" : ""
          } min-h-0 min-w-0 space-y-4 overflow-y-auto border-black/[0.06] bg-zen-paper px-4 py-4 lg:h-auto lg:w-[min(16rem,28vw)] lg:max-w-[18rem] lg:shrink-0 lg:self-stretch lg:border-b-0 lg:border-r border-b`}
        >
          <div>
            <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">项目</h3>
            <div className="flex flex-wrap gap-2">
              <select
                className={`${field} max-w-full flex-1 min-w-[8rem]`}
                value=""
                disabled={c.busy}
                onChange={(e) => {
                  const id = e.target.value;
                  if (id) void c.loadProject(id);
                  e.target.value = "";
                }}
              >
                <option value="">打开已有项目…</option>
                {c.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({new Date(p.updated_at_ms).toLocaleString()})
                  </option>
                ))}
              </select>
              <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => void c.refreshProjects()}>
                刷新
              </button>
            </div>
          </div>

          {workspacePhase === "C" ? (
            <div className="rounded-lg border border-zen-saffron/30 bg-white/50 p-2 shadow-sm">
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zen-stone">在线转写</p>
              <button
                type="button"
                className={`${btnOnlineSttEntry} w-full`}
                disabled={c.busy}
                onClick={openOnlineSttProvider}
                aria-controls="p1-online-stt-provider"
              >
                在线 STT Provider
              </button>
            </div>
          ) : null}

          {workspacePhase === "C" ? (
            <>
              <div>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">新建另一项目</h3>
                <label className="mb-2 block text-[12px] text-zen-stone">
                  项目名称
                  <input className={`${field} mt-1`} value={c.newName} onChange={(e) => c.setNewName(e.target.value)} disabled={c.busy} />
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => void c.pickAudio()}>
                    选择音频…
                  </button>
                  <button type="button" className={btnPrimary} disabled={c.busy || !c.pickedPath} onClick={() => void c.createProject()}>
                    创建项目
                  </button>
                </div>
                {c.pickedPath ? (
                  <p className="mt-2 break-all font-mono text-[10px] text-zen-indigo">{c.pickedPath}</p>
                ) : null}
              </div>

              <div>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">术语库</h3>
                <p className="mb-2 text-[11px] leading-relaxed text-zen-stone">拉取语段时一并提交 hotwords（空格拼接）。</p>
                {gl.error ? <p className="mb-2 text-sm text-zen-cinnabar">{gl.error}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${field} min-w-0 flex-1`}
                    placeholder="输入术语…"
                    value={gl.newTerm}
                    onChange={(e) => gl.setNewTerm(e.target.value)}
                    disabled={gl.busy || c.busy}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void gl.add();
                    }}
                  />
                  <button type="button" className={btnSecondary} disabled={gl.busy || !gl.newTerm.trim() || c.busy} onClick={() => void gl.add()}>
                    添加
                  </button>
                </div>
                <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-[12px]">
                  {gl.terms.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded bg-white/50 px-2 py-1">
                      <span className="truncate text-zen-ink">{t.term}</span>
                      <button type="button" className={btnSecondary} disabled={gl.busy || c.busy} onClick={() => void gl.remove(t.id)}>
                        删除
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zen-stone">诊断</h3>
                <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => void c.exportDiagnosticBundle()}>
                  导出诊断包（zip）
                </button>
              </div>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-zen-stone">
              新建项目请使用主区「选择音频」；打开项目请使用上方下拉或最近列表。
            </p>
          )}
        </aside>

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

          {workspacePhase === "A" ? (
            <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto px-4 pb-16 pt-8 md:px-6">
              <section className="mb-12 text-center" data-purpose="hero-content">
                <h1 className="mb-6 font-serif text-4xl font-medium tracking-tight text-app-text-main sm:text-5xl">开始校对</h1>
                <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-app-text-muted">
                  选择本地音频创建项目，或打开已有 SQLite 项目。ASR 需在另一终端运行。
                </p>
                <button
                  type="button"
                  className={welcomePrimaryBtn}
                  style={welcomePrimaryInlineStyle}
                  data-purpose="main-action-button"
                  disabled={c.busy}
                  onClick={() => void c.pickAudio()}
                >
                  新建项目（选择音频）
                </button>
                <div className="mt-6 flex justify-center px-2">
                  <button
                    type="button"
                    className={`${btnOnlineSttEntry} w-full max-w-sm sm:w-auto`}
                    disabled={c.busy}
                    onClick={openOnlineSttProvider}
                    aria-controls="p1-online-stt-provider"
                  >
                    在线 STT Provider（实验）
                  </button>
                </div>
              </section>

              <section className="w-full" data-purpose="projects-list-container">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <h2 className="text-xl font-bold text-app-text-main">最近项目</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative inline-block min-w-[10rem] text-left">
                      <select
                        className={welcomeSelect}
                        value=""
                        disabled={c.busy}
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id) void c.loadProject(id);
                          e.target.value = "";
                        }}
                        aria-label="打开已有项目"
                      >
                        <option value="">打开已有项目…</option>
                        {c.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({new Date(p.updated_at_ms).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className={welcomeGhostBtn}
                      disabled={c.busy}
                      onClick={() => void c.refreshProjects()}
                    >
                      <svg className="mr-2 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                      刷新
                    </button>
                  </div>
                </div>

                {recentProjects.length > 0 ? (
                  <div className="mt-4 border-t border-black/5" data-purpose="project-items">
                    <ul className="max-h-[min(24rem,50vh)] list-none overflow-y-auto p-0">
                      {recentProjects.map((p) => (
                        <li key={p.id} className="border-b border-black/5 last:border-b-0">
                          <button
                            type="button"
                            className="flex w-full cursor-pointer appearance-none border-0 bg-transparent items-center justify-between gap-3 rounded-md px-4 py-5 text-left transition-colors hover:bg-[#e8decd] hover:shadow-sm hover:shadow-black/5 focus-visible:bg-[#e8decd] focus-visible:outline-none focus-visible:shadow-sm focus-visible:shadow-black/5 disabled:cursor-not-allowed disabled:opacity-40"
                            data-purpose="project-item"
                            disabled={c.busy}
                            onClick={() => void c.loadProject(p.id)}
                          >
                            <span className="min-w-0 truncate font-medium text-app-text-main">{p.name}</span>
                            <span className="shrink-0 font-sans text-sm text-app-text-muted">
                              {new Date(p.updated_at_ms).toLocaleDateString()}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 border-t border-black/5 pt-6 text-center text-sm text-app-text-muted">暂无项目，请先新建。</p>
                )}
              </section>
            </div>
          ) : null}

          {workspacePhase === "B" ? (
            <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-y-auto p-4" data-purpose="modal-container">
              <div
                className="w-full max-w-[600px] rounded-2xl bg-white px-6 py-12 text-center shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:px-10 sm:py-14"
                data-purpose="confirm-project-card"
              >
                <h1 className="mb-8 font-serif text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl" data-purpose="modal-title">
                  确认创建项目
                </h1>
                <div className="mb-12 space-y-1.5" data-purpose="file-info">
                  <p className="font-sans text-lg font-medium text-gray-800 sm:text-xl">{pickedBasename}</p>
                  <p className="break-all font-sans text-xs leading-relaxed text-gray-400">{c.pickedPath}</p>
                </div>
                <section className="mx-auto max-w-md text-left" data-purpose="project-form">
                  <label className="mb-2 block font-sans text-sm font-semibold text-gray-600" htmlFor="p1-confirm-project-name">
                    项目名称
                  </label>
                  <input
                    id="p1-confirm-project-name"
                    type="text"
                    className={`${confirmProjectInput} mb-10`}
                    placeholder="输入项目名称"
                    value={c.newName}
                    onChange={(e) => c.setNewName(e.target.value)}
                    disabled={c.busy}
                  />
                  <div
                    className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4"
                    data-purpose="action-buttons"
                  >
                    <button
                      type="button"
                      className="order-1 w-full rounded-xl py-3 px-6 font-sans text-sm font-bold transition-all hover:opacity-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem]"
                      style={confirmCreatePrimaryStyle}
                      disabled={c.busy}
                      onClick={() => void c.createProject()}
                    >
                      创建项目
                    </button>
                    <button
                      type="button"
                      className={`order-2 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${confirmSecondaryBtn}`}
                      disabled={c.busy}
                      onClick={() => void c.pickAudio()}
                    >
                      重新选择
                    </button>
                    <button
                      type="button"
                      className={`order-3 w-full sm:order-none sm:min-w-[8.5rem] sm:flex-1 sm:max-w-[11rem] ${confirmSecondaryBtn}`}
                      disabled={c.busy}
                      onClick={() => c.clearPickedAudio()}
                    >
                      取消
                    </button>
                  </div>
                </section>
              </div>
            </div>
          ) : null}

          {workspacePhase === "C" ? (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="shrink-0 space-y-2 border-b border-black/[0.06] px-3 py-3 sm:px-4">
                <p className="text-center text-sm text-zen-ink">
                  <span className="font-medium">{c.current?.name}</span>
                  <span className="text-zen-stone"> · </span>
                  <code className="font-mono text-[11px] text-zen-indigo">{c.current?.id.slice(0, 8)}…</code>
                </p>
                <p className="text-center text-[10px] text-zen-stone">
                  横向滚动与上方波形对齐；所有语段在同一条时间轨上按起止时间摆放，时间重叠则自动分行错开。
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className={btnPrimary}
                    disabled={c.busy || c.prepareModelBusy}
                    onClick={() => void c.runTranscribe()}
                  >
                    {c.prepareModelBusy ? "模型准备中…" : "从 ASR 拉取语段"}
                  </button>
                  <span className="self-center text-[10px] text-zen-stone">
                    {c.prepareModelBusy
                      ? "首次使用需下载模型，后台进行中，可继续编辑"
                      : "（可能需数分钟）"}
                  </span>
                  <button type="button" className={btnPrimary} disabled={c.busy} onClick={() => void c.saveSegments()}>
                    保存到 SQLite
                  </button>
                  <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => c.undo()}>
                    撤销一步
                  </button>
                  <button type="button" className={btnSecondary} disabled={c.busy} onClick={() => c.redo()}>
                    重做一步
                  </button>
                  <select
                    className={`${btnSecondary} max-w-[10rem] cursor-pointer py-1.5`}
                    value={exportKey}
                    disabled={c.busy}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v) onExportSelect(v);
                    }}
                  >
                    <option value="">导出…</option>
                    <option value="txt">TXT</option>
                    <option value="srt">SRT</option>
                    <option value="docx_verbatim">DOCX 逐字稿</option>
                    <option value="docx_lecture">DOCX 讲稿</option>
                  </select>
                  <details className="relative">
                    <summary className={`${btnSecondary} cursor-pointer list-none py-1.5 text-center marker:content-none [&::-webkit-details-marker]:hidden`}>
                      项目…
                    </summary>
                    <div className="absolute right-0 z-30 mt-1 min-w-[10rem] rounded border border-black/[0.08] bg-zen-paper py-1 shadow-md">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[12px] text-zen-cinnabar hover:bg-zen-cinnabar/10"
                        disabled={c.busy}
                        onClick={() => {
                          const id = c.current?.id;
                          if (id) void c.deleteProject(id);
                        }}
                      >
                        删除项目
                      </button>
                    </div>
                  </details>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={tx.segmentToolbar.splitDisabled}
                    onClick={() => tx.segmentToolbar.splitAtSelection()}
                  >
                    拆分当前语段
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={tx.segmentToolbar.mergePrevDisabled}
                    onClick={() => tx.segmentToolbar.mergeWithPrev()}
                  >
                    与上一条合并
                  </button>
                  <button
                    type="button"
                    className={btnSecondary}
                    disabled={tx.segmentToolbar.mergeDisabled}
                    onClick={() => tx.segmentToolbar.mergeWithNext()}
                  >
                    与下一条合并
                  </button>
                </div>
              </div>

              {c.transcribeHints.length > 0 ? (
                <ul className="shrink-0 space-y-1 border-b border-black/[0.05] bg-zen-ochre/35 px-4 py-2 text-[12px] text-zen-indigo">
                  {c.transcribeHints.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : null}

              {c.audioSrc ? (
                <div className="flex min-h-0 min-w-0 flex-1 flex-col px-1 pb-2 sm:px-2">
                  <div
                    ref={tx.tierScrollRef}
                    onScroll={tx.onTierScroll}
                    className="min-h-0 flex-1 overflow-auto rounded-md border border-black/[0.08] bg-zen-paper shadow-inner [overflow-anchor:none]"
                  >
                    <div style={{ width: tx.timelineWidthPx }} className={`inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}>
                      <div
                        className="sticky top-0 z-30 border-b border-black/20 bg-zen-ink shadow-sm"
                        onContextMenu={(e) => {
                          if (c.busy) return;
                          e.preventDefault();
                          const t = tx.clientXToTimeSec(e.clientX);
                          const hit = c.segments.findIndex((s) => t >= s.start_sec && t <= s.end_sec);
                          const segmentIdx =
                            hit >= 0 ? hit : c.segments.length > 0 ? Math.min(c.selectedIdx, c.segments.length - 1) : 0;
                          setSegmentCtxMenu({
                            x: e.clientX,
                            y: e.clientY,
                            segmentIdx,
                            pointerTimeSec: t,
                          });
                        }}
                      >
                        {tx.loadError ? (
                          <p className="px-3 py-2 text-center text-[12px] text-zen-ochre">{tx.loadError}</p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/10 px-2 py-1.5 text-white/85">
                          <button
                            type="button"
                            className="rounded-full border border-white/20 p-2 transition-colors hover:bg-white/10 disabled:opacity-40"
                            disabled={c.busy || !tx.isReady}
                            onClick={() => void tx.togglePlay()}
                            aria-label={tx.isPlaying ? "暂停" : "播放"}
                          >
                            {tx.isPlaying ? (
                              <span className="flex h-3 w-3 items-center justify-center gap-0.5" aria-hidden>
                                <span className="h-2.5 w-0.5 bg-white" />
                                <span className="h-2.5 w-0.5 bg-white" />
                              </span>
                            ) : (
                              <span className="ml-0.5 block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-white" aria-hidden />
                            )}
                          </button>
                          <span className="font-mono text-[11px] tabular-nums tracking-tight">
                            {tx.formatMediaTime(tx.currentTime)} / {tx.formatMediaTime(tx.duration || 0)}
                          </span>
                          <span className="text-[10px] text-white/45" title="拖动波形区下边缘调节高度">
                            波形
                          </span>
                          <span className="min-w-[2.25rem] text-center font-mono text-[10px] text-white/70">
                            {tx.waveformHeightPx}px
                          </span>
                          <span className="text-[10px] text-white/45" title="拖动语段轨下边缘调节字号">
                            语段
                          </span>
                          <span className="min-w-[1.75rem] text-center font-mono text-[10px] text-white/70">
                            {tx.transcriptFontPx}px
                          </span>
                        </div>
                        <div className="relative overflow-x-hidden bg-white">
                          <div
                            ref={tx.waveformShellRef}
                            tabIndex={0}
                            className="relative z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zen-saffron/35"
                            onKeyDown={tx.onWaveformMainKeyDown}
                            onClick={() => tx.focusWaveformShell()}
                          >
                            <div
                              ref={tx.containerRef}
                              style={{ height: tx.waveformHeightPx }}
                              className="w-full shrink-0 bg-white"
                              role="img"
                              aria-label="转写波形与语段时间范围"
                            />
                          </div>
                          <P1ResizeBottomHit
                            busy={c.busy}
                            ariaLabel="拖动下边缘调节波形高度"
                            onPointerDown={tx.beginWaveformHeightDrag}
                          />
                        </div>
                        <div
                          className="sticky left-0 z-[25] shrink-0 bg-white"
                          style={{ width: Math.max(1, tx.tierScrollLayout.clientWidth) }}
                        >
                          <P1WaveformTimeRuler
                            appearance="light"
                            durationSec={tx.duration || 0}
                            timelineWidthPx={tx.timelineWidthPx}
                            scrollLeftPx={tx.tierScrollLayout.scrollLeft}
                            viewportWidthPx={tx.tierScrollLayout.clientWidth}
                            pxPerSec={tx.pxPerSec}
                            currentTimeSec={tx.currentTime}
                            formatMediaTime={tx.formatMediaTime}
                            disabled={c.busy || !tx.isReady}
                            onSeekFromTierClientX={tx.seekFromTierClientX}
                            onPickAbsoluteTime={tx.onPickAbsoluteTime}
                            onSetScrollLeftPx={tx.setTierScrollPx}
                          />
                        </div>
                      </div>

                      {c.segments.length === 0 ? (
                        <div
                          className="relative mt-0 shrink-0 overflow-x-hidden border-b border-black/[0.06] bg-black/[0.02]"
                          style={{ width: tx.timelineWidthPx }}
                        >
                          <div className="relative z-0 px-3 py-4 text-center text-xs leading-relaxed text-zen-stone">
                            当前无语段。可在波形空白处拖选新建，或使用「从 ASR
                            拉取语段」。若模型只返回全文而无分句时间戳，不会自动创建整轨语段（与解语一致）。
                          </div>
                          <P1ResizeBottomHit
                            busy={c.busy}
                            ariaLabel="拖动下边缘调节语段字号"
                            onPointerDown={tx.beginTranscriptFontDrag}
                          />
                        </div>
                      ) : (
                        <div
                          className="relative mt-0 shrink-0 overflow-x-hidden border-b border-black/[0.06] bg-black/[0.02]"
                          style={{ width: tx.timelineWidthPx }}
                        >
                          <div
                            className="relative z-0"
                            role="list"
                            aria-label="语段时间轨"
                            style={{
                              width: tx.timelineWidthPx,
                              height:
                                (c.segments.length === 0 ? 1 : Math.max(tx.segmentLaneLayout.laneCount, 1)) *
                                  tx.segmentLaneRowPx +
                                12,
                            }}
                            onContextMenu={(e) => {
                              if (c.busy) return;
                              const row = (e.target as HTMLElement).closest("[data-p1-seg-row]");
                              if (!row) return;
                              const i = Number(row.getAttribute("data-p1-seg-row"));
                              if (!Number.isInteger(i) || i < 0 || i >= c.segments.length) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const seg = c.segments[i];
                              if (!seg) return;
                              const pointerTimeSec = p1PointerTimeFromSegmentCard(
                                e.clientX,
                                row.getBoundingClientRect(),
                                seg,
                              );
                              setSegmentCtxMenu({
                                x: e.clientX,
                                y: e.clientY,
                                segmentIdx: i,
                                pointerTimeSec,
                              });
                            }}
                          >
                            {c.segments.map((s, i) => (
                              <P1SegmentTimelineCard
                                key={i}
                                segment={s}
                                index={i}
                                selected={i === c.selectedIdx}
                                busy={c.busy}
                                timelineWidthPx={tx.timelineWidthPx}
                                pxPerSec={tx.pxPerSec}
                                lane={tx.segmentLaneLayout.laneByIndex[i] ?? 0}
                                rowH={tx.segmentLaneRowPx}
                                transcriptFontPx={tx.transcriptFontPx}
                                selectSegmentAt={tx.selectSegmentAt}
                                updateSegmentText={c.updateSegmentText}
                                onTextareaKeyDown={tx.onSegmentTextareaKeyDown}
                              />
                            ))}
                          </div>
                          <P1ResizeBottomHit
                            busy={c.busy}
                            ariaLabel="拖动下边缘调节语段字号"
                            onPointerDown={tx.beginTranscriptFontDrag}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <P1WaveformZoomBar
                    disabled={c.busy}
                    isReady={tx.isReady}
                    pxPerSec={tx.pxPerSec}
                    hasSelectionSegment={c.segments.length > 0}
                    onZoomToFitAll={() => tx.zoomToFitTier()}
                    onZoomToFitSelection={() => tx.zoomToFitSelection()}
                    onZoomOneToOne={() => tx.resetZoom()}
                    onZoomIn={() => tx.zoomIn()}
                    onZoomOut={() => tx.zoomOut()}
                    onPxPerSecChange={tx.setPxPerSec}
                  />
                </div>
              ) : (
                <p className="shrink-0 px-4 py-6 text-center text-sm text-zen-stone">
                  无法生成音频预览 URL（仅 Tauri 壳内可用）。
                </p>
              )}

              <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] bg-white/35 px-4 py-1.5 text-[10px] text-zen-stone">
                <span>
                  全局：⌘/Ctrl+Z 撤销 · ⌘/Ctrl+Shift+Z 重做（输入框内不触发）。波形区快捷键：Space 播/停 · ←/→ 切条 · Tab /
                  Shift+Tab 切条并播段 · ⌘/Ctrl+M 并下 · ⌘/Ctrl+Shift+M 并上 · ⌘/Ctrl+Shift+S 指针拆分 · , / . 帧移 · [ / ] 低置信 ·
                  双击波形语段仅播该段 · 底部缩放条调节横向比例（与解语同款布局） · 波形白区下边缘拖调高度 · 语段轨下边缘拖调字号 · 空白拖选新建 · 重叠语段同轨分行 · 修改后请保存
                </span>
              </footer>
              {segmentCtxMenu ? (
                <P1SegmentContextMenu
                  x={segmentCtxMenu.x}
                  y={segmentCtxMenu.y}
                  items={segmentCtxMenuItems}
                  onSelect={onSegmentCtxMenuSelect}
                  onClose={() => setSegmentCtxMenu(null)}
                />
              ) : null}
            </div>
          ) : null}
        </main>
      </div>
    </section>
  );
}
