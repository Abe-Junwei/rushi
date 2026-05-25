import { DraggableResizablePanel } from "./DraggableResizablePanel";

type PanelVariant = "serene" | "notion";

interface PanelTemplatePreset {
  margin: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  variant: PanelVariant;
  persistState: boolean;
  overlayClassName: string;
}

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
    variant: "notion",
    persistState: false,
    overlayClassName: "fixed inset-0 z-50 bg-zen-ink/20 backdrop-blur-sm",
  },
  environment: {
    margin: 24,
    minWidth: 360,
    minHeight: 280,
    maxWidth: 920,
    maxHeight: 700,
    variant: "notion",
    persistState: false,
    overlayClassName: "fixed inset-0 z-40 bg-zen-ink/20 backdrop-blur-sm",
  },
  compactDialog: {
    margin: 24,
    minWidth: 280,
    minHeight: 180,
    maxWidth: 320,
    maxHeight: 200,
    variant: "serene",
    persistState: true,
    overlayClassName: "fixed inset-0 z-40 bg-zen-ink/20 backdrop-blur-sm",
  },
} satisfies Record<string, PanelTemplatePreset>;

type PanelTemplatePresetKey = keyof typeof PANEL_TEMPLATE_PRESETS;

function resolvePanelTemplateMetrics(preset: PanelTemplatePreset): PanelTemplateMetrics {
  const viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
  const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
  const availableWidth = Math.max(preset.minWidth, viewportWidth - preset.margin * 2);
  const availableHeight = Math.max(preset.minHeight, viewportHeight - preset.margin * 2);
  const width = Math.min(preset.maxWidth, availableWidth);
  const height = Math.min(preset.maxHeight, availableHeight);

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
  variant?: PanelVariant;
  persistState?: boolean;
  overlayClassName?: string;
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
  variant,
  persistState,
  overlayClassName,
}: FloatingPanelTemplateProps) {
  const presetConfig = PANEL_TEMPLATE_PRESETS[preset];
  const mergedConfig: PanelTemplatePreset = {
    ...presetConfig,
    minWidth: minWidth ?? presetConfig.minWidth,
    minHeight: minHeight ?? presetConfig.minHeight,
    maxWidth: maxWidth ?? presetConfig.maxWidth,
    maxHeight: maxHeight ?? presetConfig.maxHeight,
    variant: variant ?? presetConfig.variant,
    persistState: persistState ?? presetConfig.persistState,
    overlayClassName: overlayClassName ?? presetConfig.overlayClassName,
  };
  const metrics = resolvePanelTemplateMetrics(mergedConfig);

  return (
    <>
      <div className={mergedConfig.overlayClassName} onClick={onClose} />
      <DraggableResizablePanel
        id={id}
        title={title}
        defaultPosition={metrics.defaultPosition}
        defaultSize={metrics.defaultSize}
        minWidth={mergedConfig.minWidth}
        minHeight={mergedConfig.minHeight}
        persistState={mergedConfig.persistState}
        variant={mergedConfig.variant}
        onClose={onClose}
      >
        {children}
      </DraggableResizablePanel>
    </>
  );
}