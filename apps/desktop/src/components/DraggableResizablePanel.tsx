import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { FLAT_SHELL_ELEVATION_CLASS } from "../config/overlayStyles";
import { useDraggablePanelController } from "../hooks/useDraggablePanelController";
import { dialogCloseButtonTitle } from "../utils/dialogPanelHints";
import { DraggablePanelResizeHandles } from "./DraggablePanelResizeHandles";
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
  /** 随内容自动调整高度；用户手动改尺寸后跨会话保留（userSized）。 */
  contentFitHeight?: number;
  persistPhaseKey?: string;
  layoutRev?: number;
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
  contentFitHeight,
  persistPhaseKey,
  layoutRev,
}: DraggableResizablePanelProps) {
  const { position, size, centerMode, startDrag, handleTitleDoubleClick } = useDraggablePanelController({
    id,
    defaultPosition,
    defaultSize,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    persistState,
    contentFitHeight,
    persistPhaseKey,
    layoutRev,
  });

  return (
    <div
      id={id}
      data-panel-id={id}
      className="fixed"
      style={{
        left: centerMode ? `calc(50vw - ${size.width / 2}px)` : position.x,
        top: centerMode ? `calc(50vh - ${size.height / 2}px)` : position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }}
    >
      <DraggablePanelResizeHandles onPointerDown={startDrag} />

      <div className={`relative z-10 flex h-full w-full flex-col overflow-hidden rounded-lg border border-notion-border bg-notion-bg font-sans antialiased text-notion-text ${FLAT_SHELL_ELEVATION_CLASS}`}>
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
    </div>
  );
}
