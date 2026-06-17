import type { HTMLAttributes, ReactNode, Ref } from "react";

/** compactDialog 正文区水平与顶边距；底边由页脚或 solo 根节点承担。 */
export const FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS = "px-5 pt-3";

/** 无独立页脚时，正文区底边与左右同为 20px（Tailwind pb-5 / px-5）。 */
export const FLOATING_PANEL_DIALOG_BODY_SOLO_BOTTOM_CLASS = "pb-5";

/** 可拖拽 compactDialog 页脚：分隔线 + 与左右对齐的底边距（按钮用 CONTROL_BTN_* h-8）。 */
export const FLOATING_PANEL_DIALOG_FOOTER_CLASS =
  "mt-3 flex shrink-0 flex-wrap items-center gap-2 border-t border-notion-divider pt-3 pb-5";

const SCROLL_CLASS = "floating-panel-body-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden";
const FOOTER_BASE = FLOATING_PANEL_DIALOG_FOOTER_CLASS;

type RootProps = HTMLAttributes<HTMLDivElement> & {
  measureRef?: Ref<HTMLDivElement>;
  /** 为 true 时底边距由 FloatingPanelDialogFooter 承担，避免与 root pb 叠加。 */
  hasFooter?: boolean;
  /** 含 flex-1 列表/滚动区时撑满面板正文；静态表单应 false，避免页脚下方留白。 */
  fillHeight?: boolean;
};

/** 占满面板正文区；配合 DraggableResizablePanel 的 flex 列与 overflow-hidden。 */
export function FloatingPanelDialogRoot({
  children,
  className,
  measureRef,
  hasFooter = false,
  fillHeight = false,
  ...rest
}: RootProps) {
  const paddingClass = hasFooter
    ? FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS
    : `${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS} ${FLOATING_PANEL_DIALOG_BODY_SOLO_BOTTOM_CLASS}`;
  const heightClass = fillHeight ? "h-full min-h-0" : "min-h-0";
  return (
    <div
      ref={measureRef}
      className={["flex flex-col", heightClass, paddingClass, className].filter(Boolean).join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

type RegionProps = {
  children: ReactNode;
  className?: string;
};

/** 固定不滚动区（说明、摘要、提示条等）。 */
export function FloatingPanelDialogHeader({ children, className }: RegionProps) {
  return (
    <div className={["flex shrink-0 flex-col gap-3", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/** 可滚动中间区（语段列表、长表单等）；缩放面板时仅本区滚动。 */
export function FloatingPanelDialogScroll({ children, className }: RegionProps) {
  return <div className={[SCROLL_CLASS, className].filter(Boolean).join(" ")}>{children}</div>;
}

/** 列表容器：占剩余高度并在内部滚动（与 FloatingPanelSegmentList fillAvailable 配合）。 */
export function FloatingPanelDialogListRegion({ children, className }: RegionProps) {
  return (
    <div className={["min-h-0 flex-1 overflow-hidden", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

type FooterProps = {
  children: ReactNode;
  className?: string;
  justify?: "between" | "end" | "start";
};

/** 底部按钮行：缩放时保持可见，不被上方内容遮挡。 */
export function FloatingPanelDialogFooter({
  children,
  className,
  justify = "between",
}: FooterProps) {
  const justifyClass =
    justify === "end" ? "justify-end" : justify === "start" ? "justify-start" : "justify-between";
  return (
    <div className={[FOOTER_BASE, justifyClass, className].filter(Boolean).join(" ")}>{children}</div>
  );
}
