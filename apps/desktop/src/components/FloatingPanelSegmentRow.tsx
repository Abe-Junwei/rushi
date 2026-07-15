import type { ReactNode } from "react";
import { PANEL_TYPOGRAPHY } from "../config/typography";

/** 浮窗匹配列表：左侧固定精简元信息，右侧单行正文（由调用方提供 truncate 内容）。 */
const META_COL_CLASS =
  "w-[7.5rem] shrink-0 truncate text-left text-xs leading-4 tabular-nums text-notion-text-muted";

function FloatingPanelSegmentMeta({
  segmentNumber,
  timeLabel,
  suffix,
}: {
  segmentNumber: number;
  timeLabel: string;
  /** 如「3处」「#2」 */
  suffix?: string;
}) {
  const hasTime = timeLabel.length > 0;
  const title = `语段 ${segmentNumber}${hasTime ? ` · ${timeLabel}` : ""}${suffix ? ` · ${suffix}` : ""}`;
  return (
    <span className={META_COL_CLASS} title={title}>
      <span className="font-semibold text-notion-text">语段{segmentNumber}</span>
      {hasTime ? (
        <>
          <span className="px-1 text-notion-text-light" aria-hidden>
            ·
          </span>
          <span>{timeLabel}</span>
        </>
      ) : null}
      {suffix ? (
        <>
          <span className="px-1 text-notion-text-light" aria-hidden>
            ·
          </span>
          <span>{suffix}</span>
        </>
      ) : null}
    </span>
  );
}

type RowProps = {
  segmentNumber: number;
  timeLabel: string;
  suffix?: string;
  active?: boolean;
  disabled?: boolean;
  /** truncate：单行省略；wrap：允许多行换行展示正文 */
  bodyLayout?: "truncate" | "wrap";
  onClick?: () => void;
  trailing?: ReactNode;
  children: ReactNode;
};

const ROW_BUTTON_CLASS =
  "flex w-full min-w-0 gap-2 border-0 px-2 py-1.5 text-left transition-colors";

export function FloatingPanelSegmentRow({
  segmentNumber,
  timeLabel,
  suffix,
  active,
  disabled,
  bodyLayout = "truncate",
  onClick,
  trailing,
  children,
}: RowProps) {
  const interactive = typeof onClick === "function";
  const wrapBody = bodyLayout === "wrap";
  const rowClass = [
    ROW_BUTTON_CLASS,
    wrapBody ? "items-start" : "items-center",
    active ? "bg-notion-sidebar-active" : interactive ? "bg-transparent hover:bg-notion-sidebar-hover" : "",
  ].join(" ");

  const body = (
    <>
      <FloatingPanelSegmentMeta segmentNumber={segmentNumber} timeLabel={timeLabel} suffix={suffix} />
      <div
        className={`min-w-0 flex-1 ${wrapBody ? "" : "truncate"} ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
      >
        {children}
      </div>
      {trailing}
    </>
  );

  if (!interactive) {
    return <div className={rowClass}>{body}</div>;
  }

  return (
    <button type="button" className={rowClass} disabled={disabled} onClick={onClick}>
      {body}
    </button>
  );
}

