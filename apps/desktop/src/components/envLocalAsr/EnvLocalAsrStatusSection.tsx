import { RefreshCw } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LLM_STATUS_DOT_CLASS, LLM_STATUS_PANEL_CLASS } from "../../services/llm/llmEnvStatus";
import type { AsrEnvPresentation } from "../../services/asr/asrEnvStatus";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { EnvLocalAsrSmallButton, EnvLocalAsrStatusRow } from "./envLocalAsrPanelUi";

type Props = {
  presentation: AsrEnvPresentation;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
};

export function EnvLocalAsrStatusSection({ presentation, busy, refreshAsrHealth }: Props) {
  return (
    <section className="flex flex-col gap-4">
      <div className="pb-1">
        <h3 className={PANEL_TYPOGRAPHY.sectionTitle}>ASR 状态</h3>
        <p className={PANEL_TYPOGRAPHY.sectionDescription}>当前系统的 ASR 环境检测结果</p>
      </div>

      <div
        className={["rounded-lg px-3 py-2.5", LLM_STATUS_PANEL_CLASS[presentation.tone]].join(" ")}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-2">
          <span
            className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${LLM_STATUS_DOT_CLASS[presentation.tone]}`}
            aria-hidden
          />
          <div className="min-w-0 space-y-0.5">
            <p className={PANEL_TYPOGRAPHY.fieldLabel}>{presentation.bannerTitle}</p>
            <p className={PANEL_TYPOGRAPHY.meta}>{presentation.bannerDetail}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        {presentation.statusRows.map((row, index) => (
          <EnvLocalAsrStatusRow
            key={row.id}
            label={row.label}
            ok={row.ok}
            text={row.text}
            last={index === presentation.statusRows.length - 1}
          />
        ))}
      </div>

      <div className="flex justify-start gap-3">
        <EnvLocalAsrSmallButton
          disabled={busy}
          onClick={() => void refreshAsrHealth()}
          icon={<RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />}
        >
          刷新状态
        </EnvLocalAsrSmallButton>
      </div>
    </section>
  );
}
