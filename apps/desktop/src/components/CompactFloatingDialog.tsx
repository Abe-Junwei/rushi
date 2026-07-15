import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import {
  resolveEffectivePanelFitKind,
  resolvePanelAutoHeight,
  type PanelFitKind,
} from "./floatingPanelFitKind";
import {
  resolveCompactDialogBounds,
  type CompactDialogBoundsOptions,
} from "./floatingPanelCompactDialogBounds";
import { FLOATING_PANEL_LAYOUT_REV } from "./floatingPanelPersist";
import { FloatingPanelTemplate, type PanelTemplatePresetKey } from "./PanelTemplate";
import { FloatingPanelDialogFooter, FloatingPanelDialogRoot } from "./FloatingPanelDialogLayout";

export type CompactFloatingDialogShellPreset = PanelTemplatePresetKey;

export type CompactFloatingDialogProps = {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  /** 打开时的初始面板总高度（含标题栏）。autoFit/staticFit 由内容贴合后仅作占位；fill 为默认高度。 */
  fallbackHeight: number;
  defaultWidth?: number;
  bounds?: CompactDialogBoundsOptions;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  persistState?: boolean;
  persistPhaseKey?: string;
  layoutRev?: number;
  panelZIndex?: number;
  onOverlayClose?: () => void;
  rootRole?: string;
  rootClassName?: string;
  footer?: ReactNode;
  footerJustify?: "between" | "end" | "start";
  footerFullBleed?: boolean;
  footerClassName?: string;
  portal?: boolean;
  /** 壳层 preset；Editor 浮层用 findReplace（z≥110）。 */
  shellPreset?: CompactFloatingDialogShellPreset;
  preferredDefaultPosition?: (size: { width: number; height: number }) => { x: number; y: number };
  defaultPosition?: { x: number; y: number };
  /** 显式贴合种类（CONTEXT：Auto-fit / Fill / Static-fit dialog）。 */
  fitKind: PanelFitKind;
  children: ReactNode;
};

/**
 * compactDialog 成品壳：内置 bounds 与 CSS 自动高度。
 * autoFit / staticFit → 壳层随内容贴合（height:auto + 视口封顶），fill → 固定 px 高度。
 * 业务对话框应使用本组件，勿直接拼 FloatingPanelTemplate。
 */
export function CompactFloatingDialog({
  id,
  title,
  open,
  onClose,
  fallbackHeight,
  defaultWidth = 400,
  bounds: boundsOptions,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  persistState,
  persistPhaseKey = "default",
  layoutRev = FLOATING_PANEL_LAYOUT_REV,
  panelZIndex,
  onOverlayClose,
  rootRole = "dialog",
  rootClassName,
  footer,
  footerJustify = "end",
  footerFullBleed = false,
  footerClassName,
  portal = true,
  shellPreset = "compactDialog",
  preferredDefaultPosition,
  defaultPosition,
  fitKind,
  children,
}: CompactFloatingDialogProps) {
  const effectiveFitKind = resolveEffectivePanelFitKind(fitKind);
  const autoHeight = resolvePanelAutoHeight(effectiveFitKind);

  const resolvedBounds = resolveCompactDialogBounds(boundsOptions ?? {});

  const panelMinWidth = minWidth ?? resolvedBounds.minWidth;
  const panelMaxWidth = maxWidth ?? resolvedBounds.maxWidth;
  const panelMaxHeight = maxHeight ?? resolvedBounds.maxHeight;
  const resolvedMinHeight = minHeight ?? resolvedBounds.minHeight;
  const panelMinHeight = Math.min(resolvedMinHeight, panelMaxHeight);
  const defaultPanelHeight = Math.min(fallbackHeight, panelMaxHeight);

  const resolvedPanelZIndex = panelZIndex ?? (shellPreset === "findReplace" ? 110 : undefined);

  const panel = (
    <FloatingPanelTemplate
      id={id}
      title={title}
      preset={shellPreset}
      minWidth={panelMinWidth}
      minHeight={panelMinHeight}
      maxWidth={panelMaxWidth}
      maxHeight={panelMaxHeight}
      defaultSize={{ width: defaultWidth, height: defaultPanelHeight }}
      autoHeight={autoHeight}
      persistPhaseKey={persistPhaseKey}
      layoutRev={layoutRev}
      panelZIndex={resolvedPanelZIndex}
      persistState={persistState}
      preferredDefaultPosition={preferredDefaultPosition}
      defaultPosition={defaultPosition}
      onClose={onClose}
      onOverlayClose={onOverlayClose}
    >
      <FloatingPanelDialogRoot
        role={rootRole}
        aria-modal="true"
        hasFooter={Boolean(footer)}
        fitToContent={autoHeight}
        className={rootClassName}
      >
        {children}
        {footer ? (
          <FloatingPanelDialogFooter
            justify={footerJustify}
            fullBleed={footerFullBleed}
            className={footerClassName}
          >
            {footer}
          </FloatingPanelDialogFooter>
        ) : null}
      </FloatingPanelDialogRoot>
    </FloatingPanelTemplate>
  );

  if (!open) return null;

  if (!portal || typeof document === "undefined") {
    return <div className="workspace">{panel}</div>;
  }

  return createPortal(<div className="workspace">{panel}</div>, document.body);
}
