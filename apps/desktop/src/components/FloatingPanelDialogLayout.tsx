import type { HTMLAttributes, ReactNode } from "react";

/** compactDialog 正文区水平与顶边距；底边由页脚或 solo 根节点承担。 */
export const FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS = "px-5 pt-3";

/** 无独立页脚时，正文区底边与左右同为 20px（Tailwind pb-5 / px-5）。 */
export const FLOATING_PANEL_DIALOG_BODY_SOLO_BOTTOM_CLASS = "pb-5";

/** 可拖拽 compactDialog 页脚：负边距抵消 root px-5，分隔线与面板正文同宽。 */
export const FLOATING_PANEL_DIALOG_FOOTER_CLASS =
  "-mx-5 mt-3 flex shrink-0 flex-wrap items-center gap-2 self-stretch border-t border-notion-divider px-5 pt-3 pb-5";

const SCROLL_FILL_CLASS = "floating-panel-body-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden";
/** autoFit：列表随内容增高，封顶后区内滚，勿 flex-1 撑满 maxHeight。 */
const SCROLL_AUTO_FIT_CLASS =
  "floating-panel-body-scroll min-h-0 max-h-[min(28rem,50vh)] shrink-0 overflow-y-auto overflow-x-hidden";
const FOOTER_BASE = FLOATING_PANEL_DIALOG_FOOTER_CLASS;

type RootProps = HTMLAttributes<HTMLDivElement> & {
  /** 为 true 时底边距由 FloatingPanelDialogFooter 承担，避免与 root pb 叠加。 */
  hasFooter?: boolean;
  /** autoFit 壳层：h-auto 贴内容，勿 h-full 撑满 maxHeight。 */
  fitToContent?: boolean;
};

/**
 * 占满面板正文区的 flex 列容器。高度真源在壳层（CSS auto + max-height 或固定 px）；
 * 滚动交给内部唯一的滚动区（FloatingPanelDialogScroll / ListRegion，flex-1 overflow-y-auto），
 * 固定区（Header / 页脚）shrink-0 常驻。短内容时整壳贴合，长内容时仅滚动区内滚。
 */
export function FloatingPanelDialogRoot({
  children,
  className,
  hasFooter = false,
  fitToContent = false,
  ...rest
}: RootProps) {
  const paddingClass = hasFooter
    ? FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS
    : `${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS} ${FLOATING_PANEL_DIALOG_BODY_SOLO_BOTTOM_CLASS}`;
  const heightClass = fitToContent ? "h-auto min-h-0" : "h-full min-h-0";
  return (
    <div
      className={["flex w-full flex-col overflow-hidden", heightClass, paddingClass, className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}

type RegionProps = {
  children: ReactNode;
  className?: string;
  /** autoFit 列表：勿 flex-1 撑满壳层。 */
  fitToContent?: boolean;
};

/** 固定不滚动区（说明、摘要、提示条、表单输入等）。 */
export function FloatingPanelDialogHeader({ children, className }: RegionProps) {
  return (
    <div className={["flex shrink-0 flex-col gap-3", className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

/** 唯一可滚动中间区（语段列表、长表单等）：占剩余高度，缩放面板时仅本区内滚。 */
export function FloatingPanelDialogScroll({ children, className, fitToContent = false }: RegionProps) {
  const scrollClass = fitToContent ? SCROLL_AUTO_FIT_CLASS : SCROLL_FILL_CLASS;
  return <div className={[scrollClass, className].filter(Boolean).join(" ")}>{children}</div>;
}

/** 列表容器：占剩余高度并在内部滚动；列表（FloatingPanelSegmentList）自身 intrinsic，不再自带滚动。 */
export function FloatingPanelDialogListRegion({ children, className, fitToContent = false }: RegionProps) {
  const scrollClass = fitToContent ? SCROLL_AUTO_FIT_CLASS : SCROLL_FILL_CLASS;
  return (
    <div className={[scrollClass, className].filter(Boolean).join(" ")}>{children}</div>
  );
}

type FooterProps = {
  children: ReactNode;
  className?: string;
  justify?: "between" | "end" | "start";
  /** 贴面板壳底边（无 root px-5 父级）时使用，分隔线通栏。 */
  fullBleed?: boolean;
};

/** 底部按钮行：缩放时保持可见，不被上方内容遮挡。 */
export function FloatingPanelDialogFooter({
  children,
  className,
  justify = "between",
  fullBleed = false,
}: FooterProps) {
  const justifyClass =
    justify === "end" ? "justify-end" : justify === "start" ? "justify-start" : "justify-between";
  const shellClass = fullBleed
    ? "mt-0 flex w-full shrink-0 flex-wrap items-center gap-2 border-t border-notion-divider px-5 pt-3 pb-5"
    : FOOTER_BASE;
  return (
    <div className={[shellClass, justifyClass, className].filter(Boolean).join(" ")}>{children}</div>
  );
}
