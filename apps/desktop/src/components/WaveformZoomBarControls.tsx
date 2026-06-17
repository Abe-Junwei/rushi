import { Focus, Map, Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { workbenchDropdownItemActiveClass } from "./editor/editorSegmentToolbarStyles";
import { WorkbenchOverflowMenu } from "./editor/WorkbenchOverflowMenu";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type WaveformZoomBarControlsProps = {
  compact: boolean;
  off: boolean;
  hasSelection: boolean;
  minimapEnabled: boolean;
  onToggleMinimap?: () => void;
  atFitSelectionZoom: boolean;
  atFitAllZoom: boolean;
  atDefaultZoom: boolean;
  atMinZoom: boolean;
  atMaxZoom: boolean;
  fitSelectionTitle: string;
  fitAllTitle: string;
  zoomOutTitle: string;
  zoomInTitle: string;
  resetTitle: string;
  zoomMenuEngaged: boolean;
  onFitSelection: () => void;
  onFitAll: () => void;
  onResetDefaultZoom: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
};

export function WaveformZoomBarControls({
  compact,
  off,
  hasSelection,
  minimapEnabled,
  onToggleMinimap,
  atFitSelectionZoom,
  atFitAllZoom,
  atDefaultZoom,
  atMinZoom,
  atMaxZoom,
  fitSelectionTitle,
  fitAllTitle,
  zoomOutTitle,
  zoomInTitle,
  resetTitle,
  zoomMenuEngaged,
  onFitSelection,
  onFitAll,
  onResetDefaultZoom,
  onZoomOut,
  onZoomIn,
}: WaveformZoomBarControlsProps) {
  if (compact) {
    return (
      <>
        <WorkbenchOverflowMenu
          label="缩放"
          ariaLabel="缩放菜单"
          engaged={zoomMenuEngaged}
          align="end"
          className="waveform-zoom-compact-menu"
        >
          {(close) => (
            <>
              {onToggleMinimap ? (
                <button
                  type="button"
                  className={workbenchDropdownItemActiveClass(minimapEnabled)}
                  disabled={off}
                  title={minimapEnabled ? "关闭波形总览条" : "显示波形总览条"}
                  aria-pressed={minimapEnabled}
                  onClick={() => {
                    close();
                    onToggleMinimap();
                  }}
                >
                  <Map className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  {minimapEnabled ? "关闭波形总览" : "波形总览"}
                </button>
              ) : null}
              <button
                type="button"
                className={workbenchDropdownItemActiveClass(atFitSelectionZoom)}
                disabled={off || !hasSelection}
                title={fitSelectionTitle}
                aria-pressed={atFitSelectionZoom}
                onClick={() => {
                  close();
                  onFitSelection();
                }}
              >
                <Focus className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                适配语段
              </button>
              <button
                type="button"
                className={workbenchDropdownItemActiveClass(atFitAllZoom)}
                disabled={off}
                title={fitAllTitle}
                aria-pressed={atFitAllZoom}
                onClick={() => {
                  close();
                  onFitAll();
                }}
              >
                <Maximize2 className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                整段可见
              </button>
              <button
                type="button"
                className={workbenchDropdownItemActiveClass(atDefaultZoom)}
                disabled={off}
                title={resetTitle}
                aria-pressed={atDefaultZoom}
                onClick={() => {
                  close();
                  onResetDefaultZoom();
                }}
              >
                <RotateCcw className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                重置缩放
              </button>
            </>
          )}
        </WorkbenchOverflowMenu>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMinZoom}
          title={zoomOutTitle}
          aria-label="缩小"
          onClick={onZoomOut}
        >
          <ZoomOut className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMaxZoom}
          title={zoomInTitle}
          aria-label="放大"
          onClick={onZoomIn}
        >
          <ZoomIn className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      </>
    );
  }

  return (
    <>
      {onToggleMinimap ? (
        <button
          type="button"
          role="switch"
          className={`icon-btn${minimapEnabled ? " icon-btn-state-active" : ""}`}
          disabled={off}
          aria-label="波形总览"
          aria-checked={minimapEnabled}
          title={minimapEnabled ? "关闭波形总览条" : "显示波形总览条"}
          onClick={onToggleMinimap}
        >
          <Map className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      ) : null}
      <button
        type="button"
        className={`icon-btn${atFitSelectionZoom ? " icon-btn-state-active" : ""}`}
        disabled={off || !hasSelection}
        title={fitSelectionTitle}
        aria-label="适配语段"
        aria-pressed={atFitSelectionZoom}
        onClick={onFitSelection}
      >
        <Focus className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className={`icon-btn${atFitAllZoom ? " icon-btn-state-active" : ""}`}
        disabled={off}
        title={fitAllTitle}
        aria-label="整段可见"
        aria-pressed={atFitAllZoom}
        onClick={onFitAll}
      >
        <Maximize2 className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={off || atMinZoom}
        title={zoomOutTitle}
        aria-label="缩小"
        onClick={onZoomOut}
      >
        <ZoomOut className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={off || atMaxZoom}
        title={zoomInTitle}
        aria-label="放大"
        onClick={onZoomIn}
      >
        <ZoomIn className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
      <button
        type="button"
        className={`icon-btn${atDefaultZoom ? " icon-btn-state-active" : ""}`}
        disabled={off}
        title={resetTitle}
        aria-label="重置缩放"
        aria-pressed={atDefaultZoom}
        onClick={onResetDefaultZoom}
      >
        <RotateCcw className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
      </button>
    </>
  );
}
