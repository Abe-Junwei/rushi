import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { FLAT_SHELL_ELEVATION_CLASS } from "../config/overlayStyles";
import { useDraggablePanelController } from "../hooks/useDraggablePanelController";
import { dialogCloseButtonTitle } from "../utils/dialogPanelHints";
import { DraggablePanelResizeHandles } from "./DraggablePanelResizeHandles";
import { CspLayout } from "./CspLayout";
import { resolvePanelLayout } from "./draggablePanelGeometry";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

interface DraggableResizablePanelProps {
  id: string;
  title: string;
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  children: React.ReactNode;
  onClose: () => void;
  persistState?: boolean;
  zIndex?: number;
  /** true（autoFit / staticFit）：未手拖时随内容贴合（CSS auto 高度）；false（fill）：固定 px 高度。 */
  autoHeight?: boolean;
  persistPhaseKey?: string;
  layoutRev?: number;
  preferredDefaultPosition?: (size: { width: number; height: number }) => { x: number; y: number };
}

export function DraggableResizablePanel({
  id,
  title,
  defaultPosition,
  defaultSize,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  children,
  onClose,
  persistState,
  zIndex = 50,
  autoHeight = false,
  persistPhaseKey,
  layoutRev,
  preferredDefaultPosition,
}: DraggableResizablePanelProps) {
  const {
    position,
    size,
    centerMode,
    heightMode,
    maxHeightCap,
    panelElementRef,
    startDrag,
    handleTitleDoubleClick,
  } = useDraggablePanelController({
    id,
    defaultPosition,
    defaultSize,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    persistState,
    autoHeight,
    persistPhaseKey,
    layoutRev,
    preferredDefaultPosition,
  });

  const layout = resolvePanelLayout({
    heightMode,
    centered: centerMode,
    position,
    size,
    zIndex,
    maxHeightCap,
  });

  return (
    <CspLayout
      id={id}
      data-panel-id={id}
      ref={panelElementRef}
      className="fixed flex flex-col overflow-hidden"
      layout={layout}
    >
      <DraggablePanelResizeHandles onPointerDown={startDrag} />

      <div className={`relative z-10 flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-lg border border-notion-border bg-notion-bg font-sans antialiased text-notion-text ${FLAT_SHELL_ELEVATION_CLASS}`}>
        <div
          className="flex shrink-0 cursor-move items-center justify-between border-b border-notion-divider bg-notion-sidebar px-6 py-4 select-none"
          onPointerDown={(e) => startDrag("move", e)}
          onDoubleClick={handleTitleDoubleClick}
          title="双击标题栏恢复自动高度"
        >
          <h2 className={`m-0 select-none ${PANEL_TYPOGRAPHY.dialogTitle}`}>{title}</h2>
          <button
            type="button"
            className="rounded border-0 bg-transparent p-1 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label={dialogCloseButtonTitle()}
            title={dialogCloseButtonTitle()}
          >
            <X className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </CspLayout>
  );
}
