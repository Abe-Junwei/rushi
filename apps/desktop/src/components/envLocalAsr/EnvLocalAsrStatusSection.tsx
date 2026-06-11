import { RefreshCw } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import {
  LLM_STATUS_BANNER_TITLE_CLASS,
  LLM_STATUS_DOT_CLASS,
  LLM_STATUS_PANEL_CLASS,
  LLM_STATUS_REFRESH_BTN_BASE,
  LLM_STATUS_REFRESH_BTN_CLASS,
} from "../../services/llm/llmEnvStatus";
import type { AsrEnvPresentation } from "../../services/asr/asrEnvStatus";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import {
  EnvCollapsibleMetaSummary,
  ENV_COLLAPSIBLE_DETAILS,
  EnvLocalAsrStatusRow,
} from "./envLocalAsrPanelUi";
import { resolveAsrStatusRowAction } from "./asrStatusRowActions";

type Props = {
  presentation: AsrEnvPresentation;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
};

function countReadyRows(rows: AsrEnvPresentation["statusRows"]): number {
  return rows.filter((row) => row.ok && !row.warn).length;
}

function StatusRowList({
  rows,
  health,
}: {
  rows: AsrEnvPresentation["statusRows"];
  health: AsrEnvPresentation["health"];
}) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => {
        const actionSpec = resolveAsrStatusRowAction(row, health);
        return (
          <EnvLocalAsrStatusRow
            key={row.id}
            label={row.label}
            ok={row.ok}
            warn={row.warn}
            text={row.text}
            action={
              actionSpec
                ? {
                    label: actionSpec.label,
                    onClick: actionSpec.navigate,
                  }
                : undefined
            }
            last={index === rows.length - 1}
          />
        );
      })}
    </div>
  );
}

export function EnvLocalAsrStatusSection({ presentation, busy, refreshAsrHealth }: Props) {
  const readyCount = countReadyRows(presentation.statusRows);
  const totalCount = presentation.statusRows.length;
  const allRowsReady = readyCount === totalCount;
  const displayTone = busy ? "warn" : presentation.tone;

  return (
    <section className="flex flex-col gap-4">
      <div
        className={["flex flex-col gap-1 px-4 py-3", LLM_STATUS_PANEL_CLASS[displayTone]].join(" ")}
        role="status"
        aria-live="polite"
        aria-busy={busy || undefined}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${LLM_STATUS_DOT_CLASS[displayTone]}`}
                aria-hidden
              />
              <p
                className={[
                  PANEL_TYPOGRAPHY.envStatusBannerTitle,
                  LLM_STATUS_BANNER_TITLE_CLASS[displayTone],
                ].join(" ")}
              >
                {presentation.bannerTitle}
              </p>
            </div>
            <p className={`${PANEL_TYPOGRAPHY.meta} pl-4`}>{presentation.bannerDetail}</p>
            {allRowsReady ? (
              <details className={`${ENV_COLLAPSIBLE_DETAILS} pl-4 pt-0.5`}>
                <EnvCollapsibleMetaSummary>
                  环境明细 · {readyCount}/{totalCount} 就绪
                </EnvCollapsibleMetaSummary>
                <StatusRowList rows={presentation.statusRows} health={presentation.health} />
              </details>
            ) : null}
          </div>
          <button
            type="button"
            className={[LLM_STATUS_REFRESH_BTN_BASE, LLM_STATUS_REFRESH_BTN_CLASS[displayTone]].join(" ")}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={() => void refreshAsrHealth()}
          >
            <RefreshCw
              className={[LUCIDE_ICON_SIZE_SM, busy ? "animate-spin" : ""].join(" ")}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
            {busy ? "检测中…" : presentation.tone === "error" ? "重试检测" : "刷新状态"}
          </button>
        </div>

        {!allRowsReady ? <StatusRowList rows={presentation.statusRows} health={presentation.health} /> : null}
      </div>
    </section>
  );
}
