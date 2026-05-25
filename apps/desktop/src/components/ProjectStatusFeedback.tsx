import type { BusyReason } from "../pages/useProjectController";
import { LoaderCircle, TriangleAlert } from "lucide-react";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function busyOverlayCopy(reason: BusyReason | null): { title: string; hint: string } {
  switch (reason) {
    case "transcribe":
      return { title: "正在从 ASR 拉取语段...", hint: "完整识别可能需数分钟" };
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
    default:
      return { title: "处理中...", hint: "请稍候" };
  }
}

export function ProjectBusyOverlay({ reason, elapsedSec }: { reason: BusyReason | null; elapsedSec: number }) {
  const busyCopy = busyOverlayCopy(reason);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/70 px-6 backdrop-blur-[2px]" role="status" aria-live="polite" aria-busy="true">
      <div className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-[24px] border border-notion-divider bg-notion-bg p-8 text-center shadow-sm">
        <div className="relative mb-1 flex h-16 w-16 items-center justify-center">
          <div className="absolute inset-0 animate-ping rounded-full bg-zen-saffron/20 [animation-duration:2s]" />
          <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border border-zen-saffron/30 bg-white shadow-sm">
            <LoaderCircle className={`${LUCIDE_ICON_SIZE_LG} animate-rushi-spin-slow text-zen-saffron`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </div>
        </div>
        <div className="flex w-full flex-col gap-1">
          <h2 className="font-sans text-lg font-semibold leading-snug text-zen-ink">{busyCopy.title}</h2>
          <p className="font-sans text-[12px] leading-normal text-zen-stone">{busyCopy.hint}</p>
        </div>
        <div className="relative mt-2 h-[3px] w-full overflow-hidden rounded-full bg-zen-gray-200">
          <div className="absolute inset-y-0 w-1/3 animate-rushi-indeterminate rounded-full bg-zen-saffron" />
        </div>
        <p className="mt-1 font-mono text-[12px] tabular-nums text-zen-stone">已等待 {elapsedSec}s</p>
      </div>
    </div>
  );
}

export function AsrErrorBanner({ onOpenEnvironment }: { onOpenEnvironment: () => void }) {
  return (
    <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-zen-cinnabar/20 bg-zen-cinnabar/10 px-4 py-4 text-zen-cinnabar shadow-sm sm:flex-row sm:items-center">
      <div className="flex items-start gap-3 sm:items-center">
        <TriangleAlert className={`${LUCIDE_ICON_SIZE_LG} shrink-0 text-zen-cinnabar`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        <p className="font-sans text-sm font-semibold leading-relaxed">无法连接本机 ASR，请检查服务是否在运行。</p>
      </div>
      <button
        type="button"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl border border-transparent bg-zen-cinnabar px-5 font-sans text-sm font-semibold text-white transition-colors hover:bg-zen-cinnabar/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-cinnabar/30"
        onClick={onOpenEnvironment}
      >
        打开环境与 ASR
      </button>
    </div>
  );
}