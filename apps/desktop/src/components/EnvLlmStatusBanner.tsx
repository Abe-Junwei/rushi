import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { LLM_STATUS_DOT_CLASS, LLM_STATUS_PANEL_CLASS, type LlmEnvPresentation } from "../services/llm/llmEnvStatus";

type Props = {
  presentation: Pick<LlmEnvPresentation, "mode" | "tone" | "bannerTitle" | "bannerDetail">;
  disabled?: boolean;
  busy?: boolean;
  onRefresh?: () => void;
};

/** 设置页 LLM 状态条（本机 / 云端共用，文案来自 buildLlmEnvPresentation）。 */
export function EnvLlmStatusBanner({ presentation, disabled, busy, onRefresh }: Props) {
  return (
    <div
      className={[
        "rounded-lg px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        LLM_STATUS_PANEL_CLASS[presentation.tone],
      ].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex min-w-0 items-start gap-2">
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LLM_STATUS_DOT_CLASS[presentation.tone]}`}
          aria-hidden
        />
        <div className="min-w-0 space-y-0.5">
          <p className={PANEL_TYPOGRAPHY.fieldLabel}>{presentation.bannerTitle}</p>
          <p className={PANEL_TYPOGRAPHY.meta}>{presentation.bannerDetail}</p>
        </div>
      </div>
      {presentation.mode === "local" && onRefresh ? (
        <button
          type="button"
          className={CONTROL_BTN_SECONDARY}
          disabled={disabled || busy}
          onClick={onRefresh}
        >
          {busy ? "检测中…" : "刷新检测"}
        </button>
      ) : null}
    </div>
  );
}
