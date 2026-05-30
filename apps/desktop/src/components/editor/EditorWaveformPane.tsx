import { Pause, Play } from "lucide-react";
import { ResizeBottomHit } from "../ResizeBottomHit";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { WaveformLiveTimeRuler } from "../WaveformLiveTimeRuler";
import { WAVEFORM_EMBEDDED_TIME_RULER_H_PX } from "../WaveformTimeRuler";
import { WaveformGlobalPlaybackSpeed } from "../WaveformGlobalPlaybackSpeed";
import { WaveformGoToTime } from "../WaveformGoToTime";
import { WaveformPlaybackTime } from "../WaveformPlaybackTime";
import { WaveformSegmentPlaybackControls } from "../WaveformSegmentPlaybackControls";
import { WaveformSegmentOverlay } from "../WaveformSegmentOverlay";
import { WaveformZoomBar } from "../WaveformZoomBar";
import { WaveformMinimapStrip } from "../WaveformMinimapStrip";
import { resolveWaveformCenterStatusLabel } from "../../services/waveform/waveformRenderStatus";
import { clampSegmentTimeBounds } from "../../utils/waveformSegmentBounds";
import { resolveTierViewportMetrics, tierViewportWidthStyle } from "../../utils/waveformViewport";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";

interface EditorWaveformPaneProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
}

export function EditorWaveformPane({
  controller: c,
  tx,
}: EditorWaveformPaneProps) {
  const selectedSegment = c.segments[c.selectedIdx] ?? null;
  const tierViewport = resolveTierViewportMetrics({
    tierScrollEl: tx.tierScrollRef.current,
    tierScrollLive: tx.tierScrollLive,
    tierScrollLayout: tx.tierScrollLayout,
  });
  const { viewportWidthPx } = tierViewport;
  const mediaDurationSec = tx.mediaDurationSec;
  const tierScrollProps = {
    tierScrollRef: tx.tierScrollRef,
    tierScrollLive: tx.tierScrollLive,
    tierScrollLayout: tx.tierScrollLayout,
  };

  const waveformStageHeightPx = tx.waveformStageHeightPx;
  const rulerHeightPx = WAVEFORM_EMBEDDED_TIME_RULER_H_PX;
  const innerWaveformHeightPx = tx.waveformHeightPx;
  const peaksPaneHeightPx = Math.max(1, innerWaveformHeightPx);
  const innerPaintedHeightPx = tx.waveformPaintedHeightPx;
  const peaksPaintedHeightPx = Math.max(1, innerPaintedHeightPx);
  const segmentOverlayHeightPx = peaksPaintedHeightPx;
  const waveformVisualScale =
    peaksPaintedHeightPx > 0 ? peaksPaneHeightPx / peaksPaintedHeightPx : 1;
  const waveformHeightPreviewActive =
    Math.abs(waveformVisualScale - 1) > 0.001 && !tx.waveformHeightDragging;
  const waveformVerticalTransform =
    waveformHeightPreviewActive ? `scaleY(${waveformVisualScale})` : undefined;
  const waveformVerticalClass = tx.waveformHeightDragging
    ? "h-full w-full origin-top-left will-change-transform"
    : waveformHeightPreviewActive
      ? "h-full w-full origin-top-left will-change-transform transition-transform duration-150 ease-out motion-reduce:transition-none"
      : "h-full w-full origin-top-left";
  const stripDisabled = c.busy || !tx.isReady;
  const centerStatusLabel = resolveWaveformCenterStatusLabel({
    phase: tx.waveformPeaksPhase,
    backgroundPeaksEnabled: tx.backgroundPeaksEnabled,
    mountDeferTimedOut: tx.mountDeferTimedOut,
    waveformReady: tx.isReady,
  });

  return (
    <div className="relative z-10 flex w-full shrink-0 flex-col overflow-visible bg-notion-sidebar">
      <div
        ref={tx.tierScrollRef}
        onScroll={tx.onTierScroll}
        style={{ height: waveformStageHeightPx }}
        className="relative w-full shrink-0 overflow-x-auto overflow-y-hidden bg-notion-sidebar [overflow-anchor:none]"
      >
        {centerStatusLabel ? (
          <div
            className="waveform-center-status pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            aria-live="polite"
          >
            <p className="rounded-md bg-notion-sidebar-active/95 px-3 py-2 text-[12px] text-notion-text-muted shadow-sm">
              {centerStatusLabel}
            </p>
          </div>
        ) : null}
        <div
          ref={tx.waveformPeaksStageShellRef}
          className={`relative z-[1] inline-block min-h-full align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <div
            style={{ height: peaksPaneHeightPx }}
            className={`relative w-full ${!tx.isReady ? "bg-notion-sidebar-active" : "waveform-peaks-stage"}`}
            onContextMenu={(e) => {
              if (c.busy) return;
              e.preventDefault();
              const paneTop = e.currentTarget.getBoundingClientRect().top;
              tx.openSegmentContextMenuFromPointer({
                clientX: e.clientX,
                clientY: e.clientY,
                overlayClientTop: paneTop,
                peaksPaintedHeightPx: segmentOverlayHeightPx,
                layoutYScale: waveformHeightPreviewActive ? waveformVisualScale : 1,
              });
            }}
          >
            {tx.loadError ? (
              <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-[12px] text-zen-cinnabar">
                {tx.loadError}
              </p>
            ) : null}
            <div className="relative h-full bg-transparent">
              <div
                ref={tx.waveformShellRef}
                tabIndex={0}
                className="relative z-0 h-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40"
                onKeyDown={tx.onWaveformMainKeyDown}
                onClick={() => tx.focusWaveformShell()}
              >
                <div
                  ref={tx.waveformTimelineShellRef}
                  className="relative"
                  style={{ height: peaksPaneHeightPx }}
                >
                  <div
                    ref={tx.waveformStickyShellRef}
                    className="sticky left-0 top-0 z-[1] h-full overflow-hidden"
                    style={{ ...tierViewportWidthStyle(viewportWidthPx), height: peaksPaneHeightPx }}
                  >
                    <div className="relative h-full w-full">
                      <div
                        className={`absolute inset-0 ${waveformVerticalClass}`}
                        style={{
                          transform: waveformVerticalTransform,
                          transformOrigin: "top left",
                        }}
                      >
                        <div
                          ref={tx.waveformStretchShellRef}
                          className="h-full w-full origin-top-left"
                        >
                          <div
                            ref={tx.containerRef}
                            className="relative z-[1] h-full w-full shrink-0 bg-transparent"
                            role="img"
                            aria-label="转写波形与语段时间范围"
                          />
                        </div>
                      </div>
                      <WaveformLiveTimeRuler
                        appearance="embedded"
                        coordinateSpace="viewport"
                        overlayOnWaveform
                        suppressPlayhead
                        durationSec={mediaDurationSec}
                        timelineWidthPx={tx.timelineWidthPx}
                        {...tierScrollProps}
                        pxPerSec={tx.pxPerSec}
                        isPlaying={tx.isPlaying}
                        isReady={tx.isReady}
                        currentTimeSec={tx.currentTime}
                        getPlayheadTime={tx.getPlayheadTime}
                        formatMediaTime={tx.formatMediaTime}
                        disabled={stripDisabled}
                        onSeekFromTierClientX={tx.seekFromTierClientX}
                        onSetScrollLeftPx={tx.setTierScrollPx}
                      />
                    </div>
                  </div>
                  <WaveformSegmentOverlay
                    disabled={stripDisabled}
                    segments={c.segments}
                    selectedIdx={c.selectedIdx}
                    timelineWidthPx={tx.timelineWidthPx}
                    durationSec={mediaDurationSec}
                    playheadSec={tx.currentTime}
                    layoutHeightPx={segmentOverlayHeightPx}
                    laneByIndex={tx.segmentLaneLayout.laneByIndex}
                    laneCount={tx.segmentLaneLayout.laneCount}
                    dominantSpanIndices={tx.segmentLaneLayout.dominantSpanIndices}
                    enableCreateRange
                    clientXToTimeSec={tx.clientXToTimeSec}
                    onSelectSegmentAt={(idx) => tx.selectSegmentAt(idx, "waveform")}
                    onFocusWaveformShell={tx.focusWaveformShell}
                    onBoundsCommit={(idx, startSec, endSec) => {
                      const clamped =
                        mediaDurationSec > 0
                          ? clampSegmentTimeBounds(startSec, endSec, mediaDurationSec)
                          : { startSec, endSec };
                      c.updateSegmentBounds(idx, clamped.startSec, clamped.endSec, "commit");
                    }}
                    onCreateRange={(lo, hi, options) =>
                      c.insertSegmentFromTimeRange(lo, hi, mediaDurationSec, options?.overlapPolicy)
                    }
                    onPlaySegment={(idx) => void tx.playSegmentAtIndex(idx)}
                    seekToTime={tx.seek}
                  />
                  <WaveformSegmentPlaybackControls
                    disabled={stripDisabled}
                    rulerBandHeightPx={rulerHeightPx}
                    isPlaying={tx.isPlaying}
                    timelineWidthPx={tx.timelineWidthPx}
                    durationSec={mediaDurationSec}
                    tierScrollRef={tx.tierScrollRef}
                    tierScrollLive={tx.tierScrollLive}
                    tierScrollLayout={tx.tierScrollLayout}
                    selectedSegment={selectedSegment}
                    segmentPlaybackRate={tx.segmentPlaybackRate}
                    segmentLoopPlayback={tx.segmentLoopPlayback}
                    onPlaybackRateChange={tx.handleSegmentPlaybackRateChange}
                    onToggleLoop={() => void tx.handleToggleSelectedWaveformLoop()}
                    onTogglePlay={() => void tx.handleToggleSelectedWaveformPlay()}
                  />
                </div>
              </div>
            </div>
          </div>
          <ResizeBottomHit
            busy={c.busy}
            ariaLabel="拖动下边缘调节波形高度"
            onPointerDown={tx.beginWaveformHeightDrag}
          />
        </div>
      </div>

      {tx.minimapEnabled ? (
        <WaveformMinimapStrip
          disabled={stripDisabled}
          durationSec={mediaDurationSec}
          timelineWidthPx={tx.timelineWidthPx}
          {...tierScrollProps}
          pxPerSec={tx.pxPerSec}
          peakCache={tx.peakCache}
          peakCacheGeneration={tx.peakCacheGeneration}
          peaksLoading={tx.peaksLoading}
          isReady={tx.isReady}
          exportMinimapPeaks={tx.exportMinimapPeaks}
          currentTimeSec={tx.currentTime}
          onSeek={tx.seek}
          onSetScrollLeftPx={tx.setTierScrollPx}
        />
      ) : null}

      <div className="waveform-bottom-toolbar">
        <div className="waveform-playback-cluster">
          <button
            type="button"
            className="waveform-playback-btn"
            disabled={c.busy || !tx.isReady}
            onClick={() => void tx.togglePlay()}
            aria-label={tx.isPlaying ? "暂停" : "播放"}
          >
            {tx.isPlaying ? (
              <Pause className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            ) : (
              <Play className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
            )}
          </button>
          <WaveformPlaybackTime
            className="waveform-toolbar-time"
            isPlaying={tx.isPlaying}
            isReady={tx.isReady}
            durationSec={mediaDurationSec}
            currentTimeSec={tx.currentTime}
            getPlayheadTime={tx.getPlayheadTime}
            formatMediaTime={tx.formatMediaTime}
          />
          <WaveformGlobalPlaybackSpeed
            disabled={c.busy || !tx.isReady}
            playbackRate={tx.globalPlaybackRate}
            onPlaybackRateChange={tx.setGlobalPlaybackRate}
          />
          <WaveformGoToTime
            disabled={c.busy || !tx.isReady}
            durationSec={mediaDurationSec}
            onJump={tx.jumpToMediaTime}
          />
        </div>
        <WaveformZoomBar
          disabled={c.busy}
          isReady={tx.isReady}
          minimapEnabled={tx.minimapEnabled}
          onToggleMinimap={() => tx.setMinimapEnabled(!tx.minimapEnabled)}
          pxPerSec={tx.pxPerSec}
          layoutIntent={tx.layoutIntent}
          viewportWidthPx={viewportWidthPx}
          durationSec={mediaDurationSec}
          selectedStartSec={selectedSegment?.start_sec} selectedEndSec={selectedSegment?.end_sec}
          onFitSelection={tx.zoomToFitSelection}
          onFitAll={tx.zoomToFitAll}
          onResetDefaultZoom={() => tx.resetZoomForMedia(viewportWidthPx, mediaDurationSec)}
          onPxPerSecChange={tx.setPxPerSecFromSlider}
          editorHint={tx.editorHint}
        />
      </div>
    </div>
  );
}
