import { useDialogEscapeClose } from "../hooks/useDialogEscapeClose";
import { OVERLAY_SCRIM_LAYER } from "../config/overlayStyles";
import { scaleUiPanelPx } from "../services/ui/uiDisplayScale";
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
  /** Shell z-index; must exceed editor toolbar (z-90) when opened from editor. */
  panelZIndex?: number;
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
    persistState: true,
    overlayClassName: `${OVERLAY_SCRIM_LAYER} z-50`,
  },
  environment: {
    margin: 24,
    minWidth: 360,
    minHeight: 280,
    maxWidth: 920,
    maxHeight: 700,
    persistState: true,
    // 编辑页工具栏 z-90；与 findReplace 一致须整体抬层。
    overlayClassName: `${OVERLAY_SCRIM_LAYER} z-[100]`,
    panelZIndex: 110,
  },
  /** 确认/表单对话框：Notion/Zen 壳 + 可记忆拖放尺寸（上限按视口，勿再用 320×200 硬顶） */
  compactDialog: {
    margin: 24,
    minWidth: 280,
    minHeight: 180,
    maxWidth: 560,
    maxHeight: 720,
    persistState: true,
    overlayClassName: `${OVERLAY_SCRIM_LAYER} z-40`,
  },
  /** 查找替换：内容区较高，须压在 editor 工具栏（z-90）之上 */
  findReplace: {
    margin: 16,
    minWidth: 320,
    minHeight: 280,
    maxWidth: 640,
    maxHeight: 720,
    persistState: true,
    overlayClassName: `${OVERLAY_SCRIM_LAYER} z-[100]`,
    panelZIndex: 110,
  },
} satisfies Record<string, PanelTemplatePreset>;

export type PanelTemplatePresetKey = keyof typeof PANEL_TEMPLATE_PRESETS;

export function readPanelTemplatePresetPersistState(key: PanelTemplatePresetKey): boolean {
  return PANEL_TEMPLATE_PRESETS[key].persistState;
}

function scalePanelTemplatePreset(preset: PanelTemplatePreset): PanelTemplatePreset {
  return {
    ...preset,
    margin: scaleUiPanelPx(preset.margin),
    minWidth: scaleUiPanelPx(preset.minWidth),
    minHeight: scaleUiPanelPx(preset.minHeight),
    maxWidth: scaleUiPanelPx(preset.maxWidth),
    maxHeight: scaleUiPanelPx(preset.maxHeight),
  };
}

function resolvePanelTemplateMetrics(
  preset: PanelTemplatePreset,
  defaultSizeOverride?: { width: number; height: number },
): PanelTemplateMetrics {
  const viewport = readFloatingPanelViewport();
  const availableWidth = Math.max(preset.minWidth, viewport.width - preset.margin * 2);
  const availableHeight = Math.max(preset.minHeight, viewport.height - preset.margin * 2);
  const scaledOverride = defaultSizeOverride
    ? {
        width: scaleUiPanelPx(defaultSizeOverride.width),
        height: scaleUiPanelPx(defaultSizeOverride.height),
      }
    : undefined;
  const width = scaledOverride
    ? Math.min(scaledOverride.width, availableWidth)
    : Math.min(preset.maxWidth, availableWidth);
  const height = scaledOverride
    ? Math.min(scaledOverride.height, availableHeight)
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
  /** 编辑器工作条锚点等；迁移旧版视口居中记忆。 */
  preferredDefaultPosition?: (size: { width: number; height: number }) => { x: number; y: number };
  /** Panel shell z-index; default 50. Editor modals use 110 to clear toolbar (z-90). */
  panelZIndex?: number;
  /** true（autoFit / staticFit）：随内容 CSS 自动贴合；false（fill）：固定 px 高度。 */
  autoHeight?: boolean;
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
  preferredDefaultPosition,
  panelZIndex,
  autoHeight,
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
  const scaledConfig = scalePanelTemplatePreset(mergedConfig);
  const metrics = resolvePanelTemplateMetrics(scaledConfig, defaultSizeOverride);
  const handleEscapeClose = onEscapeClose ?? onOverlayClose ?? onClose;
  useDialogEscapeClose(true, handleEscapeClose, canEscapeClose);

  return (
    <>
      <div className={mergedConfig.overlayClassName} onClick={onOverlayClose ?? onClose} />
      <DraggableResizablePanel
        id={id}
        title={title}
        defaultPosition={defaultPositionOverride ?? metrics.defaultPosition}
        defaultSize={metrics.defaultSize}
        minWidth={scaledConfig.minWidth}
        minHeight={scaledConfig.minHeight}
        maxWidth={scaledConfig.maxWidth}
        maxHeight={scaledConfig.maxHeight}
        persistState={mergedConfig.persistState}
        zIndex={panelZIndex ?? mergedConfig.panelZIndex}
        autoHeight={autoHeight}
        persistPhaseKey={persistPhaseKey}
        layoutRev={layoutRev}
        preferredDefaultPosition={preferredDefaultPosition}
        onClose={onClose}
      >
        {children}
      </DraggableResizablePanel>
    </>
  );
}