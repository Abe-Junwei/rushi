import type { HTMLAttributes, ReactNode, Ref } from "react";

const ROOT_CLASS = "flex h-full min-h-0 flex-col px-5 py-3";
const SCROLL_CLASS = "floating-panel-body-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden";
const FOOTER_BASE =
  "mt-3 flex shrink-0 items-center gap-2 border-t border-notion-divider pt-3";

type RootProps = HTMLAttributes<HTMLDivElement> & { measureRef?: Ref<HTMLDivElement> };

/** 占满面板正文区；配合 DraggableResizablePanel 的 flex 列与 overflow-hidden。 */
export function FloatingPanelDialogRoot({ children, className, measureRef, ...rest }: RootProps) {
  return (
    <div ref={measureRef} className={[ROOT_CLASS, className].filter(Boolean).join(" ")} {...rest}>
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
  return <div className={["shrink-0 space-y-2", className].filter(Boolean).join(" ")}>{children}</div>;
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
