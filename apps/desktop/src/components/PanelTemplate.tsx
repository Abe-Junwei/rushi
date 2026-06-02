import { DraggableResizablePanel } from "./DraggableResizablePanel";

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

/** 标准可拖动确认/表单对话框预设名 */
export const FLOATING_COMPACT_DIALOG_PRESET = "compactDialog" as const;

interface PanelTemplateMetrics {
  defaultPosition: { x: number; y: number };
  defaultSize: { width: number; height: number };
}

export const PANEL_TEMPLATE_PRESETS = {
  createProject: {
    margin: 24,
    minWidth: 360,
    minHeight: 360,
    maxWidth: 560,
    maxHeight: 560,
    persistState: false,
    overlayClassName: "fixed inset-0 z-50 bg-zen-ink/20 backdrop-blur-sm",
  },
  environment: {
    margin: 24,
    minWidth: 360,
    minHeight: 280,
    maxWidth: 920,
    maxHeight: 700,
    persistState: false,
    overlayClassName: "fixed inset-0 z-40 bg-zen-ink/20 backdrop-blur-sm",
  },
  /** 确认/表单对话框：Notion/Zen 壳 + 可记忆拖放尺寸 */
  compactDialog: {
    margin: 24,
    minWidth: 280,
    minHeight: 180,
    maxWidth: 320,
    maxHeight: 200,
    persistState: true,
    overlayClassName: "fixed inset-0 z-40 bg-zen-ink/20 backdrop-blur-sm",
  },
  /** 查找替换：内容区较高，须压在 editor 工具栏（z-90）之上 */
  findReplace: {
    margin: 16,
    minWidth: 320,
    minHeight: 280,
    maxWidth: 640,
    maxHeight: 720,
    persistState: true,
    overlayClassName: "fixed inset-0 z-[100] bg-zen-ink/20 backdrop-blur-sm",
  },
} satisfies Record<string, PanelTemplatePreset>;

type PanelTemplatePresetKey = keyof typeof PANEL_TEMPLATE_PRESETS;

function resolvePanelTemplateMetrics(
  preset: PanelTemplatePreset,
  defaultSizeOverride?: { width: number; height: number },
): PanelTemplateMetrics {
  const viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
  const availableWidth = Math.max(preset.minWidth, viewportWidth - preset.margin * 2);
  const availableHeight = Math.max(preset.minHeight, viewportHeight - preset.margin * 2);
  const width = defaultSizeOverride
    ? Math.min(defaultSizeOverride.width, availableWidth)
    : Math.min(preset.maxWidth, availableWidth);
  const height = defaultSizeOverride
    ? Math.min(defaultSizeOverride.height, availableHeight)
    : Math.min(preset.maxHeight, availableHeight);

  return {
    defaultPosition: {
      x: preset.margin + Math.max(0, Math.round((availableWidth - width) / 2)),
      y: preset.margin + Math.max(0, Math.round((availableHeight - height) / 2)),
    },
    defaultSize: {
      width,
      height,
    },
  };
}

interface FloatingPanelTemplateProps {
  id: string;
  title: string;
  preset: PanelTemplatePresetKey;
  onClose: () => void;
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
}

export function FloatingPanelTemplate({
  id,
  title,
  preset,
  onClose,
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
  const metrics = resolvePanelTemplateMetrics(mergedConfig, defaultSizeOverride);

  return (
    <>
      <div className={mergedConfig.overlayClassName} onClick={onClose} />
      <DraggableResizablePanel
        id={id}
        title={title}
        defaultPosition={defaultPositionOverride ?? metrics.defaultPosition}
        defaultSize={defaultSizeOverride ?? metrics.defaultSize}
        minWidth={mergedConfig.minWidth}
        minHeight={mergedConfig.minHeight}
        persistState={mergedConfig.persistState}
        zIndex={panelZIndex}
        onClose={onClose}
      >
        {children}
      </DraggableResizablePanel>
    </>
  );
}