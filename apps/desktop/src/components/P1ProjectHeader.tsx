import type { Dispatch, SetStateAction } from "react";
import { asrBaseUrl } from "../config/env";
import { P1_CLAY_BTN_ONLINE_STT, P1_CLAY_BTN_SECONDARY } from "../config/p1ControlStyles";
import type { AsrHealthCapabilities } from "../tauri/p1Api";
import type { AsrHealthState } from "../pages/useAsrBridgeController";

const btnSecondary = P1_CLAY_BTN_SECONDARY;
const btnOnlineSttEntry = P1_CLAY_BTN_ONLINE_STT;

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
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-zen-success" : "bg-zen-cinnabar"}`}
      aria-hidden
    />
  );
}

export interface P1ProjectHeaderProps {
  workspacePhase: "A" | "B" | "C";
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
  asrHealthDetail: string;
  sttOnlineBridgeReady: boolean;
  busy: boolean;
  envOpen: boolean;
  setEnvOpen: Dispatch<SetStateAction<boolean>>;
  onOpenOnlineStt: () => void;
}

export function P1ProjectHeader({
  workspacePhase,
  asrHealth,
  asrCaps,
  sttOnlineBridgeReady,
  busy,
  envOpen,
  setEnvOpen,
  onOpenOnlineStt,
}: P1ProjectHeaderProps) {
  if (workspacePhase === "A") {
    return (
      <header
        className="flex shrink-0 flex-wrap items-center justify-between gap-4 px-8 py-8 sm:px-12"
        data-purpose="navigation-bar"
      >
        <div className="text-2xl font-semibold tracking-tight text-app-text-main" data-purpose="site-logo">
          如是我闻
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 sm:gap-4" data-purpose="status-controls">
          <div className="flex flex-wrap items-center gap-2 rounded-full border border-zen-gray-300 bg-app-highlight p-1 px-3">
            {asrHealth === "ok" && asrCaps ? (
              <>
                <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-zen-gray-500">
                  <WelcomeStatusDot ok={asrCaps.ffmpeg_ok} />
                  FFmpeg
                </span>
                <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-zen-gray-500">
                  <WelcomeStatusDot ok={asrCaps.funasr_import_ok} />
                  FunASR
                </span>
                <span className="inline-flex items-center rounded-full bg-transparent px-1.5 py-0.5 text-xs text-zen-gray-500">
                  <WelcomeStatusDot ok={asrCaps.funasr_ready} />
                  转写就绪
                </span>
              </>
            ) : asrHealth === "checking" ? (
              <span className="text-xs text-app-text-muted">正在检测 ASR…</span>
            ) : asrHealth === "error" && sttOnlineBridgeReady ? (
              <span className="text-xs text-app-text-muted">本机 ASR 未连接 · 在线 STT 已就绪</span>
            ) : asrHealth === "error" ? (
              <span className="text-xs text-red-600">ASR 不可达</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3 rounded-full border border-zen-gray-300 bg-app-highlight px-4 py-1.5" data-purpose="toggle-container">
            <span className="text-xs font-medium text-app-text-muted">环境与 ASR</span>
            <label className="relative inline-flex cursor-pointer items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={envOpen}
                onChange={() => setEnvOpen((v) => !v)}
                aria-expanded={envOpen}
              />
              <div className="relative h-5 w-9 shrink-0 rounded-full bg-zen-gray-300 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-zen-gray-300 after:bg-zen-paper after:transition-all after:content-[''] peer-checked:bg-zen-ink peer-checked:after:translate-x-full peer-checked:after:border-zen-paper peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-zen-ink/25" />
            </label>
          </div>
          <button
            type="button"
            className={btnOnlineSttEntry}
            disabled={busy}
            onClick={onOpenOnlineStt}
            aria-controls="p1-online-stt-provider"
          >
            在线 STT Provider
          </button>
          <code className="hidden max-w-[12rem] truncate font-mono text-[10px] text-zen-indigo xl:inline">{asrBaseUrl()}</code>
        </div>
      </header>
    );
  }

  if (workspacePhase === "B") {
    return (
      <header
        className="flex shrink-0 w-full max-w-7xl items-center justify-between gap-4 self-center px-8 py-8"
        data-purpose="main-header"
      >
        <div className="text-2xl font-semibold tracking-tight text-zen-ink" data-purpose="site-logo">
          如是我闻
        </div>
        <div className="flex items-center gap-3 font-sans text-sm text-app-text-muted">
          <span>环境 ASR</span>
          <label className="relative inline-block h-[22px] w-[44px] shrink-0 cursor-pointer">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={envOpen}
              onChange={() => setEnvOpen((v) => !v)}
              aria-expanded={envOpen}
            />
            <span className="pointer-events-none absolute inset-0 rounded-[34px] bg-zen-gray-300 transition-colors peer-checked:bg-zen-ink" />
            <span className="pointer-events-none absolute bottom-[3px] left-[3px] h-4 w-4 rounded-full bg-zen-paper transition-transform peer-checked:translate-x-[22px]" />
          </label>
          <button
            type="button"
            className={`${btnOnlineSttEntry}`}
            disabled={busy}
            onClick={onOpenOnlineStt}
            aria-controls="p1-online-stt-provider"
          >
            在线 STT Provider
          </button>
        </div>
      </header>
    );
  }

    return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-zen-gray-300 bg-zen-paper px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <span className="text-[11px] font-medium tracking-[0.18em] text-zen-stone">如是我闻 · 本地校对</span>
        {asrHealth === "ok" && asrCaps ? (
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-zen-stone">
            <span className="flex items-center gap-1.5">
              <StatusDot ok={asrCaps.ffmpeg_ok} />
              FFmpeg
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot ok={asrCaps.funasr_import_ok} />
              FunASR
            </span>
            <span className="flex items-center gap-1.5">
              <StatusDot ok={asrCaps.funasr_ready} />
              转写就绪
            </span>
          </div>
        ) : asrHealth === "checking" ? (
          <span className="text-[10px] text-zen-stone">正在检测 ASR…</span>
        ) : asrHealth === "error" && sttOnlineBridgeReady ? (
          <span className="text-[10px] text-zen-stone">本机 ASR 未连接 · 在线 STT 已就绪</span>
        ) : asrHealth === "error" ? (
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
          disabled={busy}
          onClick={onOpenOnlineStt}
          aria-controls="p1-online-stt-provider"
        >
          在线 STT Provider
        </button>
        <code className="hidden max-w-[12rem] truncate text-[10px] text-zen-indigo lg:inline">{asrBaseUrl()}</code>
      </div>
    </header>
  );
}
