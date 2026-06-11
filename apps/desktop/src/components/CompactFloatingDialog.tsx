import { createPortal } from "react-dom";
import { useMemo, type ReactNode } from "react";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import { mergeContentFitHeights, resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";
import {
  resolveCompactDialogBounds,
  type CompactDialogBoundsOptions,
} from "./floatingPanelCompactDialogBounds";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { FloatingPanelDialogFooter, FloatingPanelDialogRoot } from "./FloatingPanelDialogLayout";

export type CompactFloatingDialogProps = {
  id: string;
  title: string;
  open: boolean;
  onClose: () => void;
  /** 无实测/估算时的面板总高度兜底（含标题栏）。 */
  fallbackHeight: number;
  defaultWidth?: number;
  bounds?: CompactDialogBoundsOptions;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** 列表/多阶段等事先估算的总高度，与实测 merge。 */
  estimatedFitHeight?: number;
  persistState?: boolean;
  persistPhaseKey?: string;
  layoutRev?: number;
  panelZIndex?: number;
  onOverlayClose?: () => void;
  rootRole?: string;
  footer?: ReactNode;
  footerJustify?: "between" | "end" | "start";
  portal?: boolean;
  children: ReactNode;
};

/**
 * compactDialog 成品壳：内置 bounds、ResizeObserver 测量与 contentFitHeight。
 * 业务对话框应使用本组件，勿直接拼 FloatingPanelTemplate + preset="compactDialog"。
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
  estimatedFitHeight,
  persistState = false,
  persistPhaseKey = "default",
  layoutRev,
  panelZIndex,
  onOverlayClose,
  rootRole = "dialog",
  footer,
  footerJustify = "end",
  portal = true,
  children,
}: CompactFloatingDialogProps) {
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(open);
  const resolvedBounds = useMemo(
    () => resolveCompactDialogBounds(boundsOptions ?? {}),
    [boundsOptions],
  );

  const panelMinWidth = minWidth ?? resolvedBounds.minWidth;
  const panelMinHeight = minHeight ?? resolvedBounds.minHeight;
  const panelMaxWidth = maxWidth ?? resolvedBounds.maxWidth;
  const panelMaxHeight = maxHeight ?? resolvedBounds.maxHeight;

  const measuredFit = bodyHeight != null ? resolveMeasuredPanelFitHeight(bodyHeight) : null;
  const contentFitHeight = mergeContentFitHeights(estimatedFitHeight ?? fallbackHeight, measuredFit);
  const defaultPanelHeight = Math.min(contentFitHeight ?? fallbackHeight, panelMaxHeight);

  const panel = (
    <FloatingPanelTemplate
      id={id}
      title={title}
      preset="compactDialog"
      minWidth={panelMinWidth}
      minHeight={panelMinHeight}
      maxWidth={panelMaxWidth}
      maxHeight={panelMaxHeight}
      defaultSize={{ width: defaultWidth, height: defaultPanelHeight }}
      contentFitHeight={contentFitHeight}
      persistPhaseKey={persistPhaseKey}
      layoutRev={layoutRev}
      panelZIndex={panelZIndex}
      persistState={persistState}
      onClose={onClose}
      onOverlayClose={onOverlayClose}
    >
      <FloatingPanelDialogRoot role={rootRole} aria-modal="true" measureRef={bodyRef}>
        {children}
        {footer ? <FloatingPanelDialogFooter justify={footerJustify}>{footer}</FloatingPanelDialogFooter> : null}
      </FloatingPanelDialogRoot>
    </FloatingPanelTemplate>
  );

  if (!open) return null;

  if (!portal || typeof document === "undefined") {
    return <div className="workspace">{panel}</div>;
  }

  return createPortal(<div className="workspace">{panel}</div>, document.body);
}
