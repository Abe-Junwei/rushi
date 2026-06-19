import type { ReactNode } from "react";

const LIST_BASE_CLASS =
  "list-none rounded-md border border-notion-divider bg-notion-bg p-0 m-0 divide-y divide-notion-divider";

type Props = {
  /** 仅用于空列表早退；高度由内容 intrinsic 决定，滚动交给外层 ListRegion。 */
  rowCount: number;
  className?: string;
  children: ReactNode;
};

/** 浮窗语段列表：行高随内容 intrinsic；溢出由外层单一滚动区（FloatingPanelDialogListRegion）承担。 */
export function FloatingPanelSegmentList({ rowCount, className, children }: Props) {
  if (rowCount <= 0) return null;
  return <ul className={[LIST_BASE_CLASS, className].filter(Boolean).join(" ")}>{children}</ul>;
}
