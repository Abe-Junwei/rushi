import { ChevronRight } from "lucide-react";
import { CONTROL_BTN_LINK, ENV_COMPACT_BTN } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

/** 折叠区块 `<details>`：配合 summary 内 chevron 的 open 旋转。 */
export const ENV_COLLAPSIBLE_DETAILS = "group";

const ENV_COLLAPSIBLE_SUMMARY_BASE =
  "flex cursor-pointer select-none list-none items-center gap-1.5 [&::-webkit-details-marker]:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/30";

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

/** 环境与维护：折叠正文与 chevron 后标题左缘对齐（≈ pl-5）。 */
export const ENV_UTILITIES_BODY = "mt-2.5 flex flex-col gap-3 pl-5 pb-2";

/** 嵌套折叠（侧车组件 / 维护与诊断）正文：再缩进一级。 */
export const ENV_UTILITIES_NESTED_BODY = "mt-2 flex flex-col gap-2.5 pl-5 pb-0.5";

/** 二级分组 — 小标题与间距区分层级，不用左侧竖线。 */
export function EnvUtilitiesSubsection({
  title,
  description,
  children,
}: {
  title?: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {title ? <span className={PANEL_TYPOGRAPHY.fieldLabel}>{title}</span> : null}
      {description ? <div className={PANEL_TYPOGRAPHY.meta}>{description}</div> : null}
      {children}
    </div>
  );
}

/** 元信息 / 说明段落组 — 统一行距。 */
export function EnvUtilitiesMetaGroup({ children }: { children: React.ReactNode }) {
  return <div className={`flex flex-col gap-1.5 ${PANEL_TYPOGRAPHY.meta}`}>{children}</div>;
}

/** 操作按钮行 — 与正文区保持相同上间距节奏。 */
export function EnvUtilitiesActionRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

/** 本机 ASR 折叠区块 — 与 LocalAsrAdvancedSection 同款 details 外观。 */
export function EnvLocalAsrCollapsibleSection({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <details
      id={id}
      className={`${ENV_COLLAPSIBLE_DETAILS} border-b border-notion-divider/60 py-2.5 last:border-b-0`}
    >
      <EnvCollapsibleSectionSummary title={title} />
      <div className={ENV_UTILITIES_BODY}>{children}</div>
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
  const dotClass = ok ? "bg-zen-success" : warn ? "bg-accent-action" : "bg-zen-cinnabar";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 py-3 ${last ? "" : "border-b border-notion-divider/60"}`}
    >
      <span className={`${PANEL_TYPOGRAPHY.controlText} font-medium text-notion-text`}>{label}</span>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {action ? (
          <button
            type="button"
            className={`${CONTROL_BTN_LINK} ${PANEL_TYPOGRAPHY.meta} text-accent-action-strong hover:text-accent-action`}
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
