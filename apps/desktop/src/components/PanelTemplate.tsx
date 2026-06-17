import { useDialogEscapeClose } from "../hooks/useDialogEscapeClose";
import { DraggableResizablePanel } from "./DraggableResizablePanel";
import { centerFloatingPanelPosition, readFloatingPanelViewport } from "./floatingPanelViewport";

/**
 * 浮动面板预设。对话框类请用 `compactDialog`（Notion/Zen，见 docs/architecture/desktop-floating-dialog-panels.md）。
 */
interface PanelTemplatePreset {
  margin: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  persistState: boolean;
  overlayClassName: string;
}

interface PanelTemplateMetrics {
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
}

const PANEL_TEMPLATE_PRESETS = {
  createProject: {
    margin: 24,
    minWidth: 360,
    minHeight: 360,
    maxWidth: 560,
    maxHeight: 560,
    persistState: false,
    overlayClassName: "fixed inset-0 z-50 bg-zen-ink/10",
  },
  environment: {
    margin: 24,
    minWidth: 360,
    minHeight: 280,
    maxWidth: 920,
    maxHeight: 700,
    persistState: false,
    overlayClassName: "fixed inset-0 z-40 bg-zen-ink/10",
  },
  /** 确认/表单对话框：Notion/Zen 壳 + 可记忆拖放尺寸（上限按视口，勿再用 320×200 硬顶） */
  compactDialog: {
    margin: 24,
    minWidth: 280,
    minHeight: 180,
    maxWidth: 560,
    maxHeight: 720,
    persistState: true,
    overlayClassName: "fixed inset-0 z-40 bg-zen-ink/10",
  },
  /** 查找替换：内容区较高，须压在 editor 工具栏（z-90）之上 */
  findReplace: {
    margin: 16,
    minWidth: 320,
    minHeight: 280,
    maxWidth: 640,
    maxHeight: 720,
    persistState: true,
    overlayClassName: "fixed inset-0 z-[100] bg-zen-ink/10",
  },
} satisfies Record<string, PanelTemplatePreset>;

type PanelTemplatePresetKey = keyof typeof PANEL_TEMPLATE_PRESETS;

function resolvePanelTemplateMetrics(
  preset: PanelTemplatePreset,
  defaultSizeOverride?: { width: number; height: number },
): PanelTemplateMetrics {
  const viewport = readFloatingPanelViewport();
  const availableWidth = Math.max(preset.minWidth, viewport.width - preset.margin * 2);
  const availableHeight = Math.max(preset.minHeight, viewport.height - preset.margin * 2);
  const width = defaultSizeOverride
    ? Math.min(defaultSizeOverride.width, availableWidth)
    : Math.min(preset.maxWidth, availableWidth);
  const height = defaultSizeOverride
    ? Math.min(defaultSizeOverride.height, availableHeight)
    : Math.min(preset.maxHeight, availableHeight);
  const defaultSize = { width, height };

  return {
    defaultPosition: centerFloatingPanelPosition(defaultSize, preset.margin, viewport),
    defaultSize,
  };
}

interface FloatingPanelTemplateProps {
  id: string;
  title: string;
  preset: PanelTemplatePresetKey;
  onClose: () => void;
  /** 点击遮罩关闭；未提供时与 onClose 相同 */
  onOverlayClose?: () => void;
  /** Escape 关闭；未提供时与 onOverlayClose / onClose 相同 */
  onEscapeClose?: () => void;
  canEscapeClose?: () => boolean;
  children: React.ReactNode;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  persistState?: boolean;
  overlayClassName?: string;
  defaultSize?: { width: number; height: number };
  defaultPosition?: { x: number; y: number };
  /** Panel shell z-index; default 50. Editor modals use 110 to clear toolbar (z-90). */
  panelZIndex?: number;
  contentFitHeight?: number;
  persistPhaseKey?: string;
  layoutRev?: number;
}

export function FloatingPanelTemplate({
  id,
  title,
  preset,
  onClose,
  onOverlayClose,
  onEscapeClose,
  canEscapeClose,
  children,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  persistState,
  overlayClassName,
  defaultSize: defaultSizeOverride,
  defaultPosition: defaultPositionOverride,
  panelZIndex,
  contentFitHeight,
  persistPhaseKey,
  layoutRev,
}: FloatingPanelTemplateProps) {
  const presetConfig = PANEL_TEMPLATE_PRESETS[preset];
  const mergedConfig: PanelTemplatePreset = {
    ...presetConfig,
    minWidth: minWidth ?? presetConfig.minWidth,
    minHeight: minHeight ?? presetConfig.minHeight,
    maxWidth: maxWidth ?? presetConfig.maxWidth,
    maxHeight: maxHeight ?? presetConfig.maxHeight,
    persistState: persistState ?? presetConfig.persistState,
    overlayClassName: overlayClassName ?? presetConfig.overlayClassName,
  };
  if (mergedConfig.minHeight > mergedConfig.maxHeight) {
    mergedConfig.maxHeight = mergedConfig.minHeight;
  }
  if (mergedConfig.minWidth > mergedConfig.maxWidth) {
    mergedConfig.maxWidth = mergedConfig.minWidth;
  }
  const metrics = resolvePanelTemplateMetrics(mergedConfig, defaultSizeOverride);
  const handleEscapeClose = onEscapeClose ?? onOverlayClose ?? onClose;
  useDialogEscapeClose(true, handleEscapeClose, canEscapeClose);

  return (
    <>
      <div className={mergedConfig.overlayClassName} onClick={onOverlayClose ?? onClose} />
      <DraggableResizablePanel
        id={id}
        title={title}
        defaultPosition={defaultPositionOverride ?? metrics.defaultPosition}
        defaultSize={defaultSizeOverride ?? metrics.defaultSize}
        minWidth={mergedConfig.minWidth}
        minHeight={mergedConfig.minHeight}
        maxWidth={mergedConfig.maxWidth}
        maxHeight={mergedConfig.maxHeight}
        persistState={mergedConfig.persistState}
        zIndex={panelZIndex}
        contentFitHeight={contentFitHeight}
        persistPhaseKey={persistPhaseKey}
        layoutRev={layoutRev}
        onClose={onClose}
      >
        {children}
      </DraggableResizablePanel>
    </>
  );
}