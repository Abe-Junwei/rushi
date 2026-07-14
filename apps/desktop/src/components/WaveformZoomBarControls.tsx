import {
  IconArrowsHorizontal,
  IconCrop,
  IconRefresh,
  IconWaveSine,
  IconZoomInArea,
  IconZoomOutArea,
  type TablerIcon,
} from "@tabler/icons-react";
import { workbenchDropdownItemActiveClass } from "./editor/editorSegmentToolbarStyles";
import { WorkbenchOverflowMenu } from "./editor/WorkbenchOverflowMenu";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

/**
 * Tabler：
 * - WaveSine：波形总览条
 * - Crop：适配语段（选区框入视口）
 * - ArrowsHorizontal：整段横向铺满
 */
const MinimapIcon = IconWaveSine;
const FitSelectionIcon = IconCrop;
const FitAllIcon = IconArrowsHorizontal;
const ZoomOutIcon = IconZoomOutArea;
const ZoomInIcon = IconZoomInArea;
const ResetZoomIcon = IconRefresh;

function ZoomBarIcon({ Icon, size }: { Icon: TablerIcon; size: "md" | "lg" }) {
  return (
    <Icon
      className={size === "lg" ? LUCIDE_ICON_SIZE_LG : LUCIDE_ICON_SIZE_MD}
      stroke={LUCIDE_ICON_STROKE_WIDTH}
      aria-hidden
    />
  );
}

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
                  <ZoomBarIcon Icon={MinimapIcon} size="md" />
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
                <ZoomBarIcon Icon={FitSelectionIcon} size="md" />
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
                <ZoomBarIcon Icon={FitAllIcon} size="md" />
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
                <ZoomBarIcon Icon={ResetZoomIcon} size="md" />
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
          <ZoomBarIcon Icon={ZoomOutIcon} size="lg" />
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={off || atMaxZoom}
          title={zoomInTitle}
          aria-label="放大"
          onClick={onZoomIn}
        >
          <ZoomBarIcon Icon={ZoomInIcon} size="lg" />
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
          <ZoomBarIcon Icon={MinimapIcon} size="lg" />
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
        <ZoomBarIcon Icon={FitSelectionIcon} size="lg" />
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
        <ZoomBarIcon Icon={FitAllIcon} size="lg" />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={off || atMinZoom}
        title={zoomOutTitle}
        aria-label="缩小"
        onClick={onZoomOut}
      >
        <ZoomBarIcon Icon={ZoomOutIcon} size="lg" />
      </button>
      <button
        type="button"
        className="icon-btn"
        disabled={off || atMaxZoom}
        title={zoomInTitle}
        aria-label="放大"
        onClick={onZoomIn}
      >
        <ZoomBarIcon Icon={ZoomInIcon} size="lg" />
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
        <ZoomBarIcon Icon={ResetZoomIcon} size="lg" />
      </button>
    </>
  );
}
