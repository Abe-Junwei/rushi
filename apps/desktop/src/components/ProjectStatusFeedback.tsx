import type { BusyReason } from "../pages/useProjectController";
import type { TranscribeProgress } from "../pages/transcribePreviewState";
import { createPortal } from "react-dom";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { CONTROL_BTN_DANGER } from "../config/controlStyles";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function busyOverlayCopy(
  reason: BusyReason | null,
  transcribeProgress: TranscribeProgress | null,
): { title: string; hint: string } {
  switch (reason) {
    case "transcribe":
      if (transcribeProgress && transcribeProgress.windowCount > 1) {
        return {
          title: "转写预览中…",
          hint: `第 ${transcribeProgress.windowIndex}/${transcribeProgress.windowCount} 段 · 已出 ${transcribeProgress.segmentsTotal} 条语段`,
        };
      }
      if (transcribeProgress && transcribeProgress.segmentsTotal > 0) {
        return {
          title: "转写预览中…",
          hint: `已出 ${transcribeProgress.segmentsTotal} 条语段`,
        };
      }
      return {
        title: "正在从 ASR 拉取语段...",
        hint: "转写预览中；长音频将在侧车内分段处理，语段将逐步出现",
      };
    case "save":
      return { title: "正在保存到 SQLite...", hint: "请勿关闭应用" };
    case "create":
      return { title: "正在创建项目...", hint: "正在复制音频并写入数据库" };
    case "load":
      return { title: "正在加载项目...", hint: "完整识别可能需数分钟" };
    case "delete":
      return { title: "正在删除项目...", hint: "请稍候" };
    case "install_funasr":
      return { title: "正在执行安装脚本...", hint: "终端输出可在「环境与 ASR」中查看" };
    case "export":
      return { title: "正在导出 Word…", hint: "大模型润色与写入文档可能需要数十秒" };
    default:
      return { title: "处理中...", hint: "请稍候" };
  }
}

export function ProjectBusyOverlay({
  reason,
  elapsedSec,
  transcribeProgress = null,
}: {
  reason: BusyReason | null;
  elapsedSec: number;
  transcribeProgress?: TranscribeProgress | null;
}) {
  const busyCopy = busyOverlayCopy(reason, transcribeProgress);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-notion-bg/70 px-6 backdrop-blur-[2px]"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-[24px] border border-notion-divider bg-notion-bg p-8 text-center shadow-sm">
          <div className="relative mb-1 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-zen-saffron/20 [animation-duration:2s]" />
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-zen-saffron/30 bg-notion-bg shadow-sm">
              <LoaderCircle className={`${LUCIDE_ICON_SIZE_LG} animate-rushi-spin-slow text-zen-saffron`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            </div>
          </div>
          <div className="flex w-full flex-col gap-1">
            <h2 className="font-sans text-lg font-semibold leading-snug text-zen-ink">{busyCopy.title}</h2>
            <p className="font-sans text-[12px] leading-normal text-zen-stone">{busyCopy.hint}</p>
          </div>
          <div className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-notion-divider">
            <div className="absolute inset-y-0 w-1/3 animate-rushi-indeterminate rounded-full bg-zen-saffron" />
          </div>
          <p className="mt-1 font-mono text-[12px] tabular-nums text-zen-stone">已等待 {elapsedSec}s</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** R3e-C: centered status card; segment preview stays visible (no full-screen block). */
export function TranscribePreviewBanner({
  elapsedSec,
  transcribeProgress = null,
  cancelling = false,
  onCancel,
}: {
  elapsedSec: number;
  transcribeProgress?: TranscribeProgress | null;
  cancelling?: boolean;
  onCancel?: () => void;
}) {
  const busyCopy = busyOverlayCopy("transcribe", transcribeProgress);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="workspace">
      <div
        className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center px-6"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-[24px] border border-zen-saffron/25 bg-notion-bg/95 p-8 text-center shadow-lg backdrop-blur-sm">
          <div className="relative mb-1 flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-zen-saffron/20 [animation-duration:2s]" />
            <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-zen-saffron/30 bg-notion-bg shadow-sm">
              <LoaderCircle
                className={`${LUCIDE_ICON_SIZE_LG} animate-rushi-spin-slow text-zen-saffron`}
                strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                aria-hidden
              />
            </div>
          </div>
          <div className="flex w-full flex-col gap-1">
            <h2 className="font-sans text-lg font-semibold leading-snug text-zen-ink">{busyCopy.title}</h2>
            <p className="font-sans text-[12px] leading-normal text-zen-stone">{busyCopy.hint}</p>
          </div>
          <div className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-notion-divider">
            <div className="absolute inset-y-0 w-1/3 animate-rushi-indeterminate rounded-full bg-zen-saffron" />
          </div>
          <p className="mt-1 font-mono text-[12px] tabular-nums text-zen-stone">已等待 {elapsedSec}s</p>
          {onCancel ? (
            <div className="pointer-events-auto mt-1 w-full">
              <button
                type="button"
                className={`${CONTROL_BTN_DANGER} w-full`}
                disabled={cancelling}
                onClick={() => void onCancel()}
              >
                {cancelling ? "正在停止…（当前窗完成后结束）" : "停止转写"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AsrErrorBanner({
  message = "无法连接本机 ASR，请检查服务是否在运行。",
  detail,
  onOpenEnvironment,
}: {
  message?: string;
  detail?: string | null;
  onOpenEnvironment: () => void;
}) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-zen-cinnabar/20 bg-zen-cinnabar/10 px-4 py-4 text-zen-cinnabar shadow-sm sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 sm:items-center">
        <TriangleAlert className={`${LUCIDE_ICON_SIZE_LG} shrink-0 text-zen-cinnabar`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        <div className="space-y-1">
          <p className="font-sans text-sm font-semibold leading-relaxed">{message}</p>
          {detail ? <p className="font-sans text-xs leading-relaxed opacity-90">{detail}</p> : null}
        </div>
      </div>
      <button
        type="button"
        className={CONTROL_BTN_DANGER}
        onClick={onOpenEnvironment}
      >
        打开环境与 ASR
      </button>
    </div>
  );
}