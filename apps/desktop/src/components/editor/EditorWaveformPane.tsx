import { useCallback, useState } from "react";
import { ResizeBottomHit } from "../ResizeBottomHit";
import { WaveformLiveTimeRuler } from "../WaveformLiveTimeRuler";
import { WaveformViewportPlayhead } from "../WaveformViewportPlayhead";
import { WAVEFORM_EMBEDDED_TIME_RULER_H_PX } from "../WaveformTimeRuler";
import { WaveformSegmentPlaybackControls } from "../WaveformSegmentPlaybackControls";
import { WaveformSegmentBandCanvas } from "../WaveformSegmentBandCanvas";
import { WaveformSegmentOverlay } from "../WaveformSegmentOverlay";
import { WaveformMinimapStrip } from "../WaveformMinimapStrip";
import { resolveWaveformCenterStatusLabel } from "../../services/waveform/waveformRenderStatus";
import { clampSegmentTimeBounds } from "../../utils/waveformSegmentBounds";
import {
  resolveTierViewportMetrics,
  resolveWaveformSegmentLayoutHeightPx,
  resolveWaveformVerticalScalePreview,
  tierViewportWidthStyle,
} from "../../utils/waveformViewport";
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
  const {
    active: waveformVerticalScaleActive,
    transform: waveformVerticalTransform,
  } = resolveWaveformVerticalScalePreview(peaksPaneHeightPx, peaksPaintedHeightPx);
  const waveformHeightPreviewActive = waveformVerticalScaleActive || tx.waveformHeightDragging;
  const segmentLayoutHeightPx = resolveWaveformSegmentLayoutHeightPx(
    peaksPaneHeightPx,
    peaksPaintedHeightPx,
    waveformHeightPreviewActive,
  );
  const waveSurferPreviewLayerClass =
    waveformVerticalScaleActive && !tx.waveformHeightDragging
      ? "w-full origin-top-left will-change-transform transition-transform duration-150 ease-out motion-reduce:transition-none"
      : "w-full origin-top-left will-change-transform";
  const stripDisabled = c.busy || !tx.isReady;
  const [overlayDraftIdx, setOverlayDraftIdx] = useState<number | null>(null);
  const onOverlayDraftIdxChange = useCallback((idx: number | null) => {
    setOverlayDraftIdx(idx);
  }, []);
  const centerStatusLabel = resolveWaveformCenterStatusLabel({
    phase: tx.waveformPeaksPhase,
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
            <p className="rounded-md border border-notion-border bg-notion-sidebar-active/95 px-3 py-2 text-body text-notion-text-muted shadow-none">
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
                peaksPaintedHeightPx: segmentLayoutHeightPx,
                layoutYScale: 1,
              });
            }}
          >
            {tx.loadError ? (
              <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-body text-zen-cinnabar">
                {tx.loadError}
              </p>
            ) : null}
            {tx.peaksError && !tx.loadError ? (
              <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-body text-zen-cinnabar">
                波形生成失败：{tx.peaksError}
              </p>
            ) : null}
            <div className="relative h-full bg-transparent">
              <div
                ref={tx.waveformShellRef}
                tabIndex={0}
                className="relative z-0 h-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40"
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
                        ref={tx.waveformScrollLayerRef}
                        className="absolute left-0 top-0 h-full will-change-transform"
                      >
                        <div
                          className={waveSurferPreviewLayerClass}
                          style={{
                            height: waveformHeightPreviewActive ? peaksPaintedHeightPx : "100%",
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
                      </div>
                      <WaveformSegmentBandCanvas
                        segments={c.segments}
                        durationSec={mediaDurationSec}
                        timelineWidthPx={tx.timelineWidthPx}
                        layoutHeightPx={segmentLayoutHeightPx}
                        selectedIdx={c.selectedIdx}
                        selectionLo={c.selectionLo}
                        selectionHi={c.selectionHi}
                        selectionCount={c.selectionCount}
                        isContiguousSelection={c.isContiguousSelection}
                        selectedIndices={c.selectedIndices}
                        dominantSpanIndices={tx.segmentLaneLayout.dominantSpanIndices}
                        draftIdx={overlayDraftIdx}
                        getPlayheadSec={tx.getPlayheadTime}
                        tierScrollRef={tx.tierScrollRef}
                        tierScrollLive={tx.tierScrollLive}
                        tierScrollLayout={tx.tierScrollLayout}
                      />
                      <div
                        ref={tx.overlayScrollLayerRef}
                        className="absolute left-0 top-0 z-[3] h-full will-change-transform"
                      >
                        <WaveformSegmentOverlay
                          disabled={stripDisabled}
                          segments={c.segments}
                          selectedIdx={c.selectedIdx}
                          selectionLo={c.selectionLo}
                          selectionHi={c.selectionHi}
                          selectionCount={c.selectionCount}
                          isContiguousSelection={c.isContiguousSelection}
                          timelineWidthPx={tx.timelineWidthPx}
                          durationSec={mediaDurationSec}
                          layoutHeightPx={segmentLayoutHeightPx}
                          laneByIndex={tx.segmentLaneLayout.laneByIndex}
                          laneCount={tx.segmentLaneLayout.laneCount}
                          dominantSpanIndices={tx.segmentLaneLayout.dominantSpanIndices}
                          getPlayheadSec={tx.getPlayheadTime}
                          onDraftIdxChange={onOverlayDraftIdxChange}
                          enableCreateRange
                          clientXToTimeSec={tx.clientXToTimeSec}
                          onSelectSegmentAt={(idx, opts) => tx.selectSegmentAt(idx, "waveform", opts)}
                          onSelectSegmentIndices={(indices, primaryIdx) =>
                            c.selectSegmentIndices(indices, primaryIdx)
                          }
                          getSelectedIndices={() => c.selectedIndices}
                          isIndexInSelection={c.isIndexInSelection}
                          selectedIndices={c.selectedIndices}
                          onClearMultiSelection={c.clearMultiSelection}
                          isMultiSegmentSelection={() => c.isMultiSegmentSelection}
                          onFocusWaveformShell={tx.focusWaveformShell}
                          revealSelectedSegmentInViewport={tx.revealSelectedSegmentInViewport}
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
                      </div>
                      <WaveformViewportPlayhead
                        durationSec={mediaDurationSec}
                        timelineWidthPx={tx.timelineWidthPx}
                        {...tierScrollProps}
                        isPlaying={tx.isPlaying}
                        isReady={tx.isReady}
                        currentTimeSec={tx.currentTime}
                        getPlayheadTime={tx.getPlayheadTime}
                        formatMediaTime={tx.formatMediaTime}
                      />
                      <WaveformLiveTimeRuler
                        appearance="embedded"
                        coordinateSpace="viewport"
                        overlayOnWaveform
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
                  <WaveformSegmentPlaybackControls
                    disabled={stripDisabled}
                    rulerBandHeightPx={rulerHeightPx}
                    isPlaying={tx.isSelectedSegmentPlaying}
                    timelineWidthPx={tx.timelineWidthPx}
                    durationSec={mediaDurationSec}
                    tierScrollRef={tx.tierScrollRef}
                    tierScrollLive={tx.tierScrollLive}
                    tierScrollLayout={tx.tierScrollLayout}
                    selectedSegment={selectedSegment}
                    segmentLoopPlayback={tx.segmentLoopPlayback}
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
    </div>
  );
}
