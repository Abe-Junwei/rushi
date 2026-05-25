import type { Dispatch, SetStateAction } from "react";
import { Settings } from "lucide-react";
import { asrBaseUrl } from "../config/env";
import type { AsrHealthCapabilities } from "../tauri/projectApi";
import type { AsrHealthState } from "../pages/useAsrBridgeController";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const btnSecondary =
  "inline-flex h-8 items-center justify-center rounded-md border border-notion-border bg-notion-bg px-3 text-[11px] font-medium text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:opacity-40";
const btnOnlineSttEntry =
  "inline-flex h-8 items-center justify-center rounded-md border border-zen-saffron/35 bg-notion-bg px-3 text-[11px] font-medium text-notion-text transition-colors hover:bg-zen-saffron/10 disabled:cursor-not-allowed disabled:opacity-40";

/** 欢迎顶栏：亮绿 / 红（与 Stitch 稿一致） */
function WelcomeStatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ok ? "bg-zen-success ring-2 ring-zen-success/35" : "bg-zen-cinnabar ring-2 ring-zen-cinnabar/35"}`}
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
          className="flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-notion-divider bg-notion-bg px-6"
        data-purpose="navigation-bar"
      >
        <div className="font-serif text-[32px] font-medium leading-[1.3] tracking-[-0.01em] text-zen-ink" data-purpose="site-logo">
          如是我闻
        </div>
        <div className="flex items-center justify-end gap-3" data-purpose="status-controls">
            <div className="hidden h-8 min-w-0 items-center gap-3 border-l border-notion-divider pl-6 md:flex">
              <span className="flex items-center gap-2 font-mono text-[12px] text-notion-text-muted">
              <WelcomeStatusDot ok={asrCaps?.ffmpeg_ok === true} />
              FFmpeg
            </span>
              <span className="flex items-center gap-2 font-mono text-[12px] text-notion-text-muted">
              <WelcomeStatusDot ok={asrHealth === "ok" && asrCaps?.funasr_ready === true} />
              ASR
            </span>
            <button
              type="button"
                className="appearance-none rounded border-0 bg-transparent px-2 py-1 font-sans text-[12px] text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={() => setEnvOpen(true)}
            >
              环境与 ASR 设置
            </button>
          </div>
          <button
            type="button"
              className="appearance-none rounded-full border-0 bg-transparent p-2 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
            disabled={busy}
            onClick={() => setEnvOpen((v) => !v)}
            aria-expanded={envOpen}
            aria-label={envOpen ? "收起环境与 ASR" : "环境与 ASR"}
          >
            <Settings className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
          <code className="hidden max-w-[12rem] truncate font-mono text-[12px] text-zen-indigo xl:inline">{asrBaseUrl()}</code>
        </div>
      </header>
    );
  }

    return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-notion-divider bg-notion-bg px-4 py-2">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <span className="text-[11px] font-medium tracking-[0.1em] text-notion-text-muted">如是我闻 · 本地校对</span>
        {asrHealth === "ok" && asrCaps ? (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-notion-text-muted">
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
          <span className="text-[11px] text-notion-text-muted">正在检测 ASR…</span>
        ) : asrHealth === "error" && sttOnlineBridgeReady ? (
          <span className="text-[11px] text-notion-text-muted">本机 ASR 未连接 · 在线 STT 已就绪</span>
        ) : asrHealth === "error" ? (
          <span className="text-[11px] text-zen-cinnabar">ASR 不可达</span>
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
        <code className="hidden max-w-[12rem] truncate font-mono text-[12px] text-zen-indigo lg:inline">{asrBaseUrl()}</code>
      </div>
    </header>
  );
}
