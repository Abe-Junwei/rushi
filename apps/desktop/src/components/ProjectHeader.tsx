import type { Dispatch, SetStateAction } from "react";
import { asrBaseUrl } from "../config/env";
import { CLAY_BTN_ONLINE_STT, CLAY_BTN_SECONDARY } from "../config/controlStyles";
import type { AsrHealthCapabilities } from "../tauri/projectApi";
import type { AsrHealthState } from "../pages/useAsrBridgeController";

const btnSecondary = CLAY_BTN_SECONDARY;
const btnOnlineSttEntry = CLAY_BTN_ONLINE_STT;

/** 欢迎顶栏：亮绿 / 红（与 Stitch 稿一致） */
function WelcomeStatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-zen-success shadow-[0_0_8px_rgba(34,197,94,0.35)]" : "bg-zen-cinnabar shadow-[0_0_8px_rgba(150,53,48,0.35)]"}`}
      aria-hidden
    />
  );
}

function SettingsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3h.1A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

export interface ProjectHeaderProps {
  workspacePhase: "A" | "C";
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
  asrHealthDetail: string;
  sttOnlineBridgeReady: boolean;
  busy: boolean;
  envOpen: boolean;
  setEnvOpen: Dispatch<SetStateAction<boolean>>;
  onOpenOnlineStt: () => void;
}

export function ProjectHeader({
  workspacePhase,
  asrHealth,
  asrCaps,
  sttOnlineBridgeReady,
  busy,
  envOpen,
  setEnvOpen,
  onOpenOnlineStt,
}: ProjectHeaderProps) {
  if (workspacePhase === "A") {
    return (
      <header
        className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-zen-gray-300 bg-zen-paper px-6"
        data-purpose="navigation-bar"
      >
        <div className="font-serif text-[28px] font-medium leading-none text-zen-ink" data-purpose="site-logo">
          如是我闻
        </div>
        <div className="flex items-center justify-end gap-3" data-purpose="status-controls">
          <div className="hidden h-8 min-w-0 items-center gap-3 border-l border-zen-gray-200 pl-6 md:flex">
            <span className="flex items-center gap-2 font-mono text-[12px] text-zen-stone">
              <WelcomeStatusDot ok={asrCaps?.ffmpeg_ok === true} />
              FFmpeg
            </span>
            <span className="flex items-center gap-2 font-mono text-[12px] text-zen-stone">
              <WelcomeStatusDot ok={asrHealth === "ok" && asrCaps?.funasr_ready === true} />
              ASR
            </span>
            <button
              type="button"
              className="appearance-none rounded border-0 bg-transparent px-2 py-1 font-sans text-[12px] text-zen-stone transition-colors hover:bg-serene-surface-container-low hover:text-zen-ink disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={() => setEnvOpen(true)}
            >
              环境与 ASR 设置
            </button>
          </div>
          <button
            type="button"
            className="appearance-none rounded-full border-0 bg-transparent p-2 text-zen-gray-500 transition-colors hover:bg-serene-surface-container hover:text-zen-ink"
            disabled={busy}
            onClick={() => setEnvOpen((v) => !v)}
            aria-expanded={envOpen}
            aria-label={envOpen ? "收起环境与 ASR" : "环境与 ASR"}
          >
            <SettingsIcon />
          </button>
          <code className="hidden max-w-[12rem] truncate font-mono text-[10px] text-zen-indigo xl:inline">{asrBaseUrl()}</code>
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
          aria-controls="online-stt-provider"
        >
          在线 STT 提供方
        </button>
        <code className="hidden max-w-[12rem] truncate text-[10px] text-zen-indigo lg:inline">{asrBaseUrl()}</code>
      </div>
    </header>
  );
}
