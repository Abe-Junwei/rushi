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
import { resolveAsrStatusRowAction, scrollToEnvSection } from "./asrStatusRowActions";

type Props = {
  presentation: AsrEnvPresentation;
  prepareModelBusy?: boolean;
  busy: boolean;
  refreshAsrHealth: () => Promise<void>;
};

function resolveDisplayPresentation(
  presentation: AsrEnvPresentation,
  prepareModelBusy: boolean,
): AsrEnvPresentation {
  if (!prepareModelBusy) return presentation;
  return {
    ...presentation,
    tone: "warn",
    bannerTitle: "本机 ASR · 正在准备模型",
    bannerDetail: "环境已就绪，正在下载所选转写模型，请稍候…",
    statusRows: presentation.statusRows.map((row) =>
      row.id === "runtime" ? { ...row, ok: false, text: "初始化中", warn: true } : row,
    ),
  };
}

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
                    onClick: () => scrollToEnvSection(actionSpec.targetId),
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
  prepareModelBusy = false,
  busy,
  refreshAsrHealth,
}: Props) {
  const display = resolveDisplayPresentation(presentation, prepareModelBusy);
  const readyCount = countReadyRows(display.statusRows);
  const totalCount = display.statusRows.length;
  const allRowsReady = readyCount === totalCount;

  return (
    <section className="flex flex-col gap-4">
      <div
        className={["flex flex-col gap-1 px-4 py-3", LLM_STATUS_PANEL_CLASS[display.tone]].join(" ")}
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${LLM_STATUS_DOT_CLASS[display.tone]}`}
                aria-hidden
              />
              <p
                className={[
                  PANEL_TYPOGRAPHY.envStatusBannerTitle,
                  LLM_STATUS_BANNER_TITLE_CLASS[display.tone],
                ].join(" ")}
              >
                {display.bannerTitle}
              </p>
            </div>
            <p className={`${PANEL_TYPOGRAPHY.meta} pl-4`}>{display.bannerDetail}</p>
            {allRowsReady ? (
              <details className={`${ENV_COLLAPSIBLE_DETAILS} pl-4 pt-0.5`}>
                <EnvCollapsibleMetaSummary>
                  环境明细 · {readyCount}/{totalCount} 就绪
                </EnvCollapsibleMetaSummary>
                <StatusRowList rows={display.statusRows} health={display.health} />
              </details>
            ) : null}
          </div>
          <button
            type="button"
            className={[LLM_STATUS_REFRESH_BTN_BASE, LLM_STATUS_REFRESH_BTN_CLASS[display.tone]].join(" ")}
            disabled={busy}
            onClick={() => void refreshAsrHealth()}
          >
            <RefreshCw className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            {busy ? "检测中…" : display.tone === "error" ? "重试检测" : "刷新状态"}
          </button>
        </div>

        {!allRowsReady ? <StatusRowList rows={display.statusRows} health={display.health} /> : null}
      </div>
    </section>
  );
}
