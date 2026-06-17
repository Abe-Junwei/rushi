import { RefreshCw } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { ENV_STATUS_BANNER_SHELL_CLASS } from "../utils/environmentPanelNav";
import {
  ENV_STATUS_BANNER_TITLE_CLASS,
  ENV_STATUS_DOT_CLASS,
  ENV_STATUS_PANEL_CLASS,
  ENV_STATUS_REFRESH_BTN_BASE,
  ENV_STATUS_REFRESH_BTN_CLASS,
  type LlmEnvPresentation,
} from "../services/llm/llmEnvStatus";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

type Props = {
  presentation: Pick<LlmEnvPresentation, "mode" | "tone" | "bannerTitle" | "bannerDetail">;
  disabled?: boolean;
  busy?: boolean;
  onRefresh?: () => void;
  /** 默认：检测中… / 重试检测 / 刷新检测 */
  refreshLabel?: string;
};

function resolveBusyBannerCopy(
  presentation: Pick<LlmEnvPresentation, "mode" | "bannerTitle" | "bannerDetail">,
  busy: boolean,
): { title: string; detail: string } {
  if (!busy) {
    return { title: presentation.bannerTitle, detail: presentation.bannerDetail };
  }
  const title = /(?:检测中|探测中)/.test(presentation.bannerTitle)
    ? presentation.bannerTitle
    : `${presentation.bannerTitle} · ${presentation.mode === "local" ? "检测中" : "探测中"}`;
  if (presentation.mode === "local") {
    const detail = presentation.bannerDetail.includes("正在检测")
      ? presentation.bannerDetail
      : "正在检测 127.0.0.1:11434…";
    return { title, detail };
  }
  return { title, detail: "正在探测连接…" };
}

function inProgressButtonLabel(refreshLabel?: string): string {
  return refreshLabel?.includes("探测") ? "探测中…" : "检测中…";
}

/** 设置页 LLM 状态条（本机 / 云端共用，文案来自 buildLlmEnvPresentation）。 */
export function EnvLlmStatusBanner({ presentation, disabled, busy, onRefresh, refreshLabel }: Props) {
  const displayTone = busy ? "warn" : presentation.tone;
  const bannerCopy = resolveBusyBannerCopy(presentation, busy === true);

  return (
    <div
      className={[
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between",
        ENV_STATUS_BANNER_SHELL_CLASS,
        ENV_STATUS_PANEL_CLASS[displayTone],
      ].join(" ")}
      role="status"
      aria-live="polite"
      aria-busy={busy || undefined}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${ENV_STATUS_DOT_CLASS[displayTone]}`}
            aria-hidden
          />
          <p
            className={[
              PANEL_TYPOGRAPHY.envStatusBannerTitle,
              ENV_STATUS_BANNER_TITLE_CLASS[displayTone],
            ].join(" ")}
          >
            {bannerCopy.title}
          </p>
        </div>
        <p className={`${PANEL_TYPOGRAPHY.meta} pl-4`}>{bannerCopy.detail}</p>
      </div>
      {onRefresh ? (
        <button
          type="button"
          className={[ENV_STATUS_REFRESH_BTN_BASE, ENV_STATUS_REFRESH_BTN_CLASS[displayTone]].join(" ")}
          disabled={disabled || busy}
          aria-busy={busy || undefined}
          onClick={onRefresh}
        >
          <RefreshCw
            className={[
              LUCIDE_ICON_SIZE_SM,
              busy ? "animate-spin" : "",
            ].join(" ")}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
          {busy ? inProgressButtonLabel(refreshLabel) : refreshLabel ?? (presentation.tone === "error" ? "重试检测" : "刷新检测")}
        </button>
      ) : null}
    </div>
  );
}
