import type { ReactNode } from "react";
import {
  FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
  resolveFloatingPanelSegmentListHeight,
} from "./floatingPanelSegmentListLayout";

const LIST_BASE_CLASS =
  "list-none overflow-y-auto rounded-md border border-notion-divider bg-notion-bg p-0 m-0 divide-y divide-notion-divider";

const LIST_AUTO_CLASS = `${LIST_BASE_CLASS} shrink-0`;
const LIST_FILL_CLASS = `${LIST_BASE_CLASS} h-full min-h-0`;

type Props = {
  rowCount: number;
  className?: string;
  children: ReactNode;
  /** 占满父级 flex 剩余高度并在内部滚动（面板手动缩小时保留下方按钮可见） */
  fillAvailable?: boolean;
};

/** 浮窗语段列表：按条数自动增高，达到上限后内部滚动；fillAvailable 时随面板高度收缩。 */
export function FloatingPanelSegmentList({
  rowCount,
  className,
  children,
  fillAvailable = false,
}: Props) {
  if (rowCount <= 0) return null;

  if (fillAvailable) {
    return (
      <ul className={[LIST_FILL_CLASS, "floating-panel-body-scroll", className].filter(Boolean).join(" ")}>
        {children}
      </ul>
    );
  }

  const height = resolveFloatingPanelSegmentListHeight(rowCount);

  return (
    <ul
      className={[LIST_AUTO_CLASS, className].filter(Boolean).join(" ")}
      style={{
        height,
        maxHeight: FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
      }}
    >
      {children}
    </ul>
  );
}
