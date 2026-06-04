import { ChevronRight } from "lucide-react";
import { CONTROL_BTN_LINK, ENV_COMPACT_BTN } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

/** 折叠区块 `<details>`：配合 summary 内 chevron 的 open 旋转。 */
export const ENV_COLLAPSIBLE_DETAILS = "group";

const ENV_COLLAPSIBLE_SUMMARY_BASE =
  "flex cursor-pointer select-none list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/30";

const ENV_COLLAPSIBLE_CHEVRON = `${LUCIDE_ICON_SIZE_SM} shrink-0 text-notion-text-light transition-transform duration-200 group-open:rotate-90`;

function EnvCollapsibleChevron() {
  return (
    <ChevronRight className={ENV_COLLAPSIBLE_CHEVRON} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
  );
}

/** 12px 区块折叠摘要（安装向导 / 高级诊断 / 侧车组件等）。 */
export function EnvCollapsibleSectionSummary({
  title,
  trailing,
}: {
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <summary className={`${ENV_COLLAPSIBLE_SUMMARY_BASE} ${trailing ? "w-full justify-between gap-3" : ""}`}>
      <span className={`flex min-w-0 items-center gap-1.5 ${trailing ? "flex-1" : ""}`}>
        <EnvCollapsibleChevron />
        <span className={`${PANEL_TYPOGRAPHY.envCollapsibleSummary} group-open:text-notion-text`}>{title}</span>
      </span>
      {trailing ? <span className={`shrink-0 ${PANEL_TYPOGRAPHY.meta}`}>{trailing}</span> : null}
    </summary>
  );
}

/** 11px 次级折叠摘要（环境明细 / 维护与诊断等）。 */
export function EnvCollapsibleMetaSummary({ children }: { children: React.ReactNode }) {
  return (
    <summary
      className={`${ENV_COLLAPSIBLE_SUMMARY_BASE} ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted hover:text-notion-text`}
    >
      <EnvCollapsibleChevron />
      <span>{children}</span>
    </summary>
  );
}

/** 本机 ASR 折叠区块 — 与 LocalAsrAdvancedSection 同款 details 外观。 */
export function EnvLocalAsrCollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className={`${ENV_COLLAPSIBLE_DETAILS} border-b border-notion-divider/60 py-2`}>
      <EnvCollapsibleSectionSummary title={title} />
      <div className="mt-3 flex flex-col gap-4 pb-3">{children}</div>
    </details>
  );
}

export function EnvLocalAsrStatusRow({
  label,
  ok,
  warn = false,
  text,
  action,
  last = false,
}: {
  label: string;
  ok: boolean;
  warn?: boolean;
  text: string;
  action?: { label: string; onClick: () => void };
  last?: boolean;
}) {
  const dotClass = ok ? "bg-zen-success" : warn ? "bg-zen-saffron" : "bg-zen-cinnabar";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 py-3 ${last ? "" : "border-b border-notion-divider/60"}`}
    >
      <span className={`${PANEL_TYPOGRAPHY.controlText} font-medium text-notion-text`}>{label}</span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {action ? (
          <button
            type="button"
            className={`${CONTROL_BTN_LINK} ${PANEL_TYPOGRAPHY.meta} text-zen-saffron-mid hover:text-zen-saffron`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
        <span className={PANEL_TYPOGRAPHY.meta}>{text}</span>
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass}`} aria-hidden />
      </div>
    </div>
  );
}

export function EnvLocalAsrSmallButton({
  children,
  disabled,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={ENV_COMPACT_BTN}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
