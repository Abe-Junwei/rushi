import { PRODUCT_ICON } from "../../config/productIcons";
import { useWorkbenchToolbarCompactFromElement } from "../../hooks/useWorkbenchToolbarCompact";
import { useWaveformSelectionChromeView } from "../../hooks/useWaveformSelectionChromeView";
import type { SegmentListFilterApi } from "../../hooks/useSegmentListFilter";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { resolveTierViewportMetrics } from "../../utils/waveformViewport";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { WaveformGlobalPlaybackSpeed } from "../WaveformGlobalPlaybackSpeed";
import { WaveformPlaybackScrollFollowModeControl } from "../WaveformPlaybackScrollFollowMode";
import { WaveformPlaybackTime } from "../WaveformPlaybackTime";
import { WaveformZoomBar } from "../WaveformZoomBar";
import { EditorSegmentListFilterMenu } from "./EditorSegmentListFilterMenu";
import { EditorSegmentTranscribeActions } from "./EditorSegmentToolbarActions";

interface EditorWorkbenchToolbarProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  hasAudio: boolean;
  segmentFilter: SegmentListFilterApi;
}

/** 波形区与语段区之间的统一单行工具条（左播放滚屏 / 中转录编辑 / 右缩放）。 */
export function EditorWorkbenchToolbar({
  controller: c,
  tx,
  hasAudio,
  segmentFilter,
}: EditorWorkbenchToolbarProps) {
  const { trackRef, compact: compactLayout } = useWorkbenchToolbarCompactFromElement();
  const filterMenu =
    c.segments.length > 0 ? (
      <EditorSegmentListFilterMenu
        filter={segmentFilter.filter}
        filteredCount={segmentFilter.filteredIndices.length}
        totalCount={c.segments.length}
        busy={c.busy}
        isActive={segmentFilter.isActive}
        onToggleStage={segmentFilter.toggleStage}
        onAnnotationChange={segmentFilter.setAnnotation}
        onReset={segmentFilter.resetFilter}
      />
    ) : null;

  if (!hasAudio) {
    return (
      <div className="waveform-bottom-toolbar editor-workbench-toolbar editor-workbench-toolbar--no-audio">
        <div
          ref={trackRef}
          className="waveform-bottom-toolbar-track editor-workbench-toolbar-track editor-workbench-toolbar-track--no-audio"
        >
          <div className="workbench-toolbar-center workbench-toolbar-center--solo">
            <div className="workbench-toolbar-group workbench-toolbar-group--solo waveform-toolbar-subzone waveform-toolbar-transcribe">
              <EditorSegmentTranscribeActions controller={c} compactLayout={compactLayout} />
              {filterMenu}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const selectionView = useWaveformSelectionChromeView({
    fileId: c.currentFileId,
    selectedIdx: c.selectedIdx,
    selectionLo: c.selectionLo,
    selectionHi: c.selectionHi,
    selectionCount: c.selectionCount,
    isContiguousSelection: c.isContiguousSelection,
    selectedIndices: c.selectedIndices,
    segmentCount: c.segments.length,
  });
  const selectedSegment = c.segments[selectionView.selectedIdx] ?? null;
  const tierViewport = resolveTierViewportMetrics({
    tierScrollEl: tx.tierScrollRef.current,
    tierScrollLive: tx.tierScrollLive,
    tierScrollLayout: tx.tierScrollLayout,
  });
  const { viewportWidthPx } = tierViewport;
  const mediaDurationSec = tx.mediaDurationSec;
  const stripDisabled = c.busy || !tx.isReady;

  return (
    <div className="waveform-bottom-toolbar editor-workbench-toolbar">
      <div ref={trackRef} className="waveform-bottom-toolbar-track editor-workbench-toolbar-track">
        <div className="workbench-toolbar-left">
          <div className="workbench-toolbar-group waveform-toolbar-zone waveform-toolbar-transport">
              <button
                type="button"
                className="waveform-playback-btn"
                disabled={stripDisabled}
                onClick={() => void tx.togglePlay()}
                aria-label={tx.isPlaying ? "暂停" : "播放"}
              >
                {tx.isPlaying ? (
                  <PRODUCT_ICON.pauseAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                ) : (
                  <PRODUCT_ICON.playAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                )}
              </button>
              <WaveformPlaybackTime
                className="waveform-toolbar-time"
                isPlaying={tx.isPlaying}
                isReady={tx.isReady}
                durationSec={mediaDurationSec}
                currentTimeSec={tx.currentTime}
                getDisplayPlayheadTimeSec={tx.getDisplayPlayheadTimeSec}
                subscribePlayheadFrame={tx.subscribePlayheadFrame}
                formatMediaTime={tx.formatMediaTime}
              />
              <WaveformGlobalPlaybackSpeed
                disabled={stripDisabled}
                playbackRate={tx.globalPlaybackRate}
                onPlaybackRateChange={tx.setGlobalPlaybackRate}
              />
              <WaveformPlaybackScrollFollowModeControl
                disabled={stripDisabled}
                mode={tx.playbackScrollFollowMode}
                onModeChange={tx.setPlaybackScrollFollowMode}
            />
          </div>
        </div>

        <div className="workbench-toolbar-center">
          <EditorSegmentTranscribeActions controller={c} compactLayout={compactLayout} />
        </div>

        <div className="workbench-toolbar-right">
          <div className="workbench-toolbar-group waveform-toolbar-zone waveform-toolbar-viewport">
            {filterMenu}
            <WaveformZoomBar
                disabled={c.busy}
                isReady={tx.isReady}
                minimapEnabled={tx.minimapEnabled}
                onToggleMinimap={() => tx.setMinimapEnabled(!tx.minimapEnabled)}
                pxPerSec={tx.pxPerSec}
                layoutIntent={tx.layoutIntent}
                viewportWidthPx={viewportWidthPx}
                durationSec={mediaDurationSec}
                selectedStartSec={selectedSegment?.start_sec}
                selectedEndSec={selectedSegment?.end_sec}
                onFitSelection={tx.zoomToFitSelection}
                onFitAll={tx.zoomToFitAll}
                onResetDefaultZoom={() => tx.resetZoomForMedia(viewportWidthPx, mediaDurationSec)}
              onPxPerSecChange={tx.setPxPerSecFromSlider}
              compactLayout={compactLayout}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
