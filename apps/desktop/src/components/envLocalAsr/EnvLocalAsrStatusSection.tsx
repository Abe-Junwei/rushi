import {
  IconRefresh as RefreshCw,
} from "@tabler/icons-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { ENV_STATUS_BANNER_SHELL_CLASS } from "../../utils/environmentPanelNav";
import {
  ENV_STATUS_BANNER_TITLE_CLASS,
  ENV_STATUS_DOT_CLASS,
  ENV_STATUS_PANEL_CLASS,
  ENV_STATUS_REFRESH_BTN_BASE,
  ENV_STATUS_REFRESH_BTN_CLASS,
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
  /** Soft-wake idle sidecar then refresh (重试检测 / 恢复侧车). */
  recoverSidecar?: () => Promise<void>;
};

function countReadyRows(rows: AsrEnvPresentation["statusRows"]): number {
  return rows.filter((row) => row.ok && !row.warn).length;
}

function StatusRowList({
  rows,
  health,
  sidecarIdleSleeping,
  onRecoverSidecar,
}: {
  rows: AsrEnvPresentation["statusRows"];
  health: AsrEnvPresentation["health"];
  sidecarIdleSleeping: boolean;
  onRecoverSidecar?: () => void;
}) {
  return (
    <div className="flex flex-col">
      {rows.map((row, index) => {
        const actionSpec = resolveAsrStatusRowAction(row, {
          health,
          sidecarIdleSleeping,
          onRecoverSidecar,
        });
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

export function EnvLocalAsrStatusSection({
  presentation,
  busy,
  refreshAsrHealth,
  recoverSidecar,
}: Props) {
  const readyCount = countReadyRows(presentation.statusRows);
  const totalCount = presentation.statusRows.length;
  const allRowsReady = readyCount === totalCount;
  const displayTone = busy ? "warn" : presentation.tone;
  const sleeping = presentation.sidecarIdleSleeping === true;
  const onRetryClick = () => {
    if (sleeping && recoverSidecar) {
      void recoverSidecar();
      return;
    }
    void refreshAsrHealth();
  };
  const retryLabel = busy
    ? "检测中…"
    : sleeping || presentation.tone === "error"
      ? "重试检测"
      : "刷新状态";

  return (
    <section className="flex flex-col gap-4">
      <div
        className={["flex flex-col gap-1", ENV_STATUS_BANNER_SHELL_CLASS, ENV_STATUS_PANEL_CLASS[displayTone]].join(" ")}
        role="status"
        aria-live="polite"
        aria-busy={busy || undefined}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
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
                {presentation.bannerTitle}
              </p>
            </div>
            <p className={`${PANEL_TYPOGRAPHY.meta} pl-4`}>{presentation.bannerDetail}</p>
            {allRowsReady ? (
              <details className={`${ENV_COLLAPSIBLE_DETAILS} pl-4 pt-0.5`}>
                <EnvCollapsibleMetaSummary>
                  环境明细 · {readyCount}/{totalCount} 就绪
                </EnvCollapsibleMetaSummary>
                <StatusRowList
                  rows={presentation.statusRows}
                  health={presentation.health}
                  sidecarIdleSleeping={sleeping}
                  onRecoverSidecar={recoverSidecar ? () => void recoverSidecar() : undefined}
                />
              </details>
            ) : null}
          </div>
          <button
            type="button"
            className={[ENV_STATUS_REFRESH_BTN_BASE, ENV_STATUS_REFRESH_BTN_CLASS[displayTone]].join(" ")}
            disabled={busy}
            aria-busy={busy || undefined}
            onClick={onRetryClick}
          >
            <RefreshCw
              className={[LUCIDE_ICON_SIZE_SM, busy ? "animate-spin" : ""].join(" ")}
              strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
              aria-hidden
            />
            {retryLabel}
          </button>
        </div>

        {!allRowsReady ? (
          <StatusRowList
            rows={presentation.statusRows}
            health={presentation.health}
            sidecarIdleSleeping={sleeping}
            onRecoverSidecar={recoverSidecar ? () => void recoverSidecar() : undefined}
          />
        ) : null}
      </div>
    </section>
  );
}
