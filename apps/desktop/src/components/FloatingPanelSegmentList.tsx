import type { ReactNode } from "react";
import {
  FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
  resolveFloatingPanelSegmentListHeight,
} from "./floatingPanelSegmentListLayout";

const LIST_BASE_CLASS =
  "shrink-0 list-none overflow-y-auto rounded-md border border-notion-divider bg-notion-bg p-0 m-0 divide-y divide-notion-divider";

type Props = {
  rowCount: number;
  className?: string;
  children: ReactNode;
};

/** 浮窗语段列表：按条数自动增高，达到上限后内部滚动。 */
export function FloatingPanelSegmentList({ rowCount, className, children }: Props) {
  if (rowCount <= 0) return null;

  const height = resolveFloatingPanelSegmentListHeight(rowCount);

  return (
    <ul
      className={[LIST_BASE_CLASS, className].filter(Boolean).join(" ")}
      style={{
        height,
        maxHeight: FLOATING_PANEL_SEGMENT_LIST_MAX_HEIGHT_PX,
      }}
    >
      {children}
    </ul>
  );
}
