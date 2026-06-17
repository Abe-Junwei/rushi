import { createPortal } from "react-dom";
import { useMemo, type ReactNode } from "react";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import { useFrozenPanelBodyHeight } from "../hooks/useFrozenPanelBodyHeight";
import { resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";
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
  /** 是否 ResizeObserver 测高；配合 layoutRev 冻结可避免输入时抖动。 */
  measureBody?: boolean;
  /** 含 flex-1 列表/滚动区时为 true；静态表单保持 false。 */
  fillHeight?: boolean;
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
  layoutRev = 0,
  panelZIndex,
  onOverlayClose,
  rootRole = "dialog",
  footer,
  footerJustify = "end",
  portal = true,
  measureBody = true,
  fillHeight = false,
  children,
}: CompactFloatingDialogProps) {
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(open && measureBody);
  const frozenBodyHeight = useFrozenPanelBodyHeight(bodyHeight, layoutRev, measureBody);
  const resolvedBounds = useMemo(
    () => resolveCompactDialogBounds(boundsOptions ?? {}),
    [boundsOptions],
  );

  const panelMinWidth = minWidth ?? resolvedBounds.minWidth;
  const panelMinHeight = minHeight ?? resolvedBounds.minHeight;
  const panelMaxWidth = maxWidth ?? resolvedBounds.maxWidth;
  const panelMaxHeight = maxHeight ?? resolvedBounds.maxHeight;

  const measuredFit =
    frozenBodyHeight != null ? resolveMeasuredPanelFitHeight(frozenBodyHeight) : null;
  const baseHeight = estimatedFitHeight ?? fallbackHeight;
  /** 有冻结实测时以实测为准，避免估算偏高导致页脚下方留白。 */
  const contentFitHeight = measuredFit ?? baseHeight;
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
      <FloatingPanelDialogRoot
        role={rootRole}
        aria-modal="true"
        measureRef={measureBody ? bodyRef : undefined}
        hasFooter={Boolean(footer)}
        fillHeight={fillHeight}
      >
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
