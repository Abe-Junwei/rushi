import { memo, useCallback, useMemo, useRef, useState } from "react";
import { CspLayout } from "../CspLayout";
import { WaveformLiveTimeRuler } from "../WaveformLiveTimeRuler";
import { WaveformViewportPlayhead } from "../WaveformViewportPlayhead";
import { WaveformViewportPeaksCanvas } from "../WaveformViewportPeaksCanvas";
import { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX } from "../../services/waveform/drawWaveformTimeRuler";
import { WaveformSegmentPlaybackControls } from "../WaveformSegmentPlaybackControls";
import { WaveformSegmentBandCanvas } from "../WaveformSegmentBandCanvas";
import { WaveformSegmentOverlay } from "../WaveformSegmentOverlay";
import { useWaveformSelectionChromeViewContext } from "../../hooks/WaveformSelectionChromeViewContext";
import { clampSegmentTimeBounds } from "../../utils/waveformSegmentBounds";
import {
  WAVEFORM_TIER_VIEWPORT_WIDTH_CLASS,
  WAVEFORM_TIER_VIEWPORT_WIDTH_VAR,
} from "../../utils/waveformViewport";
import { useWaveformScrollPinnedLayers } from "../../utils/waveformScrollPinnedLayers";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { editorWaveformPanePropsEqual } from "./editorShellRenderCompare";

type TierScrollProps = {
  tierScrollRef: TranscriptionLayerApi["tierScrollRef"];
  tierScrollLive: TranscriptionLayerApi["tierScrollLive"];
  tierScrollLayout: TranscriptionLayerApi["tierScrollLayout"];
};

type Props = {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  viewportWidthPx: number;
  peaksPaneHeightPx: number;
  peaksPaintedHeightPx: number;
  segmentLayoutHeightPx: number;
  waveformVerticalTransform: string | undefined;
  waveSurferPreviewLayerClass: string;
  waveformHeightPreviewActive: boolean;
  stripDisabled: boolean;
  tierScrollProps: TierScrollProps;
};

export const EditorWaveformPeaksStage = memo(function EditorWaveformPeaksStage({
  controller: c,
  tx,
  viewportWidthPx,
  peaksPaneHeightPx,
  peaksPaintedHeightPx,
  segmentLayoutHeightPx,
  waveformVerticalTransform,
  waveSurferPreviewLayerClass,
  waveformHeightPreviewActive,
  stripDisabled,
  tierScrollProps,
}: Props) {
  const { view: selectionView, filterExcludesPrimary, listVisibleIndexSet } =
    useWaveformSelectionChromeViewContext();
  const selectedSegment = c.segments[selectionView.selectedIdx] ?? null;
  const mediaDurationSec = tx.mediaDurationSec;
  const rulerHeightPx = WAVEFORM_EMBEDDED_RULER_HEIGHT_PX;
  const [overlayDraftIdx, setOverlayDraftIdx] = useState<number | null>(null);
  const onOverlayDraftIdxChange = useCallback((idx: number | null) => {
    setOverlayDraftIdx(idx);
  }, []);

  const waveLayerPinRef = useRef<HTMLDivElement | null>(null);
  const scrollPinLayerRefs = useMemo(
    () => [waveLayerPinRef, tx.waveformStickyShellRef],
    [tx.waveformStickyShellRef],
  );
  useWaveformScrollPinnedLayers({
    layerRefs: scrollPinLayerRefs,
    tierScrollRef: tierScrollProps.tierScrollRef,
    tierScrollLive: tierScrollProps.tierScrollLive,
    layoutScrollLeftPx: tierScrollProps.tierScrollLayout.scrollLeftPx,
  });

  return (
    <CspLayout
      layout={{ height: peaksPaneHeightPx }}
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
      {/* peaksError is shown viewport-centered in EditorWaveformPane — avoid a
          full-timeline-width banner whose centered text sits off-screen. */}
      <div className="relative h-full bg-transparent">
        <div
          ref={tx.waveformShellRef}
          tabIndex={0}
          className="relative z-0 h-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/40"
          onClick={() => tx.focusWaveformShell()}
        >
          <CspLayout ref={tx.waveformTimelineShellRef} className="relative" layout={{ height: peaksPaneHeightPx }}>
            {/*
              Viewport-pinned wave host (WS-2a width). Use absolute + scroll translate —
              NOT `position: sticky`: WKWebView can promote sticky onto a compositor
              layer that paints over EditorToolbar (header「消失」).
            */}
            <CspLayout
              ref={waveLayerPinRef}
              className={`waveform-timeline-wave-layer absolute left-0 top-0 z-[1] h-0 overflow-visible ${WAVEFORM_TIER_VIEWPORT_WIDTH_CLASS}`}
              layout={{
                [WAVEFORM_TIER_VIEWPORT_WIDTH_VAR]:
                  viewportWidthPx > 0 ? `${viewportWidthPx}px` : undefined,
                width: viewportWidthPx > 0 ? viewportWidthPx : undefined,
              }}
            >
              <CspLayout
                className={`absolute left-0 top-0 overflow-hidden ${tx.isReady ? "pointer-events-none opacity-0" : ""} ${waveSurferPreviewLayerClass}`}
                layout={{
                  // WS-2b: keep media ticking (no display:none) but collapse the
                  // compositor surface so WS internal canvases are not painted.
                  width: tx.isReady ? 1 : "100%",
                  height: tx.isReady
                    ? 1
                    : waveformHeightPreviewActive
                      ? peaksPaintedHeightPx
                      : peaksPaneHeightPx,
                  transform: waveformVerticalTransform,
                  transformOrigin: "top left",
                }}
              >
                <div ref={tx.waveformStretchShellRef} className="h-full w-full origin-top-left">
                  <div
                    ref={tx.containerRef}
                    className="relative z-[1] h-full w-full shrink-0 bg-transparent"
                    role="img"
                    aria-label="转写波形与语段时间范围"
                  />
                </div>
              </CspLayout>
            </CspLayout>
            <CspLayout
              className="waveform-timeline-overlay-layer absolute left-0 top-0 z-[3] h-full"
              layout={{ width: tx.timelineWidthPx }}
            >
              <WaveformViewportPeaksCanvas
                durationSec={mediaDurationSec}
                timelineWidthPx={tx.timelineWidthPx}
                layoutHeightPx={peaksPaintedHeightPx}
                drawPxPerSec={tx.drawPxPerSec}
                peakCache={tx.peakCache}
                peakCacheGeneration={tx.peakCacheGeneration}
                getPlayheadSec={tx.getDisplayPlayheadTimeSec}
                subscribePlayheadFrame={tx.subscribePlayheadFrame}
                tierScrollRef={tx.tierScrollRef}
                tierScrollLive={tx.tierScrollLive}
                tierScrollLayout={tx.tierScrollLayout}
              />
              <WaveformSegmentBandCanvas
                fileId={c.currentFileId}
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
                filterExcludesPrimary={filterExcludesPrimary}
                listVisibleIndexSet={listVisibleIndexSet}
                getPlayheadSec={tx.getDisplayPlayheadTimeSec}
                subscribePlayheadFrame={tx.subscribePlayheadFrame}
                tierScrollRef={tx.tierScrollRef}
                tierScrollLive={tx.tierScrollLive}
                tierScrollLayout={tx.tierScrollLayout}
              />
              <WaveformSegmentOverlay
                fileId={c.currentFileId}
                disabled={stripDisabled}
                segments={c.segments}
                selectedIdx={c.selectedIdx}
                selectionLo={c.selectionLo}
                selectionHi={c.selectionHi}
                selectionCount={c.selectionCount}
                isContiguousSelection={c.isContiguousSelection}
                filterExcludesPrimary={filterExcludesPrimary}
                timelineWidthPx={tx.timelineWidthPx}
                durationSec={mediaDurationSec}
                layoutHeightPx={segmentLayoutHeightPx}
                laneByIndex={tx.segmentLaneLayout.laneByIndex}
                laneCount={tx.segmentLaneLayout.laneCount}
                dominantSpanIndices={tx.segmentLaneLayout.dominantSpanIndices}
                getPlayheadSec={tx.getDisplayPlayheadTimeSec}
                onDraftIdxChange={onOverlayDraftIdxChange}
                enableCreateRange
                clientXToTimeSec={tx.clientXToTimeSec}
                onSelectSegmentAt={(idx, opts) => tx.selectSegmentAt(idx, "waveform", opts)}
                onWaveformSelectionGesture={tx.dispatchWaveformSelectionGesture}
                onSelectSegmentIndices={(indices, primaryIdx) => tx.selectSegmentIndices(indices, primaryIdx)}
                getSelectedIndices={() => c.selectedIndices}
                isIndexInSelection={c.isIndexInSelection}
                selectedIndices={c.selectedIndices}
                onClearMultiSelection={c.clearMultiSelection}
                isMultiSegmentSelection={() => c.isMultiSegmentSelection}
                onFocusWaveformShell={tx.focusWaveformShell}
                onBoundsCommit={(idx, startSec, endSec, options) => {
                  const clamped =
                    mediaDurationSec > 0
                      ? clampSegmentTimeBounds(startSec, endSec, mediaDurationSec)
                      : { startSec, endSec };
                  c.updateSegmentBounds(idx, clamped.startSec, clamped.endSec, "commit", options);
                }}
                onCreateRange={(lo, hi, options) => {
                  const idx = c.insertSegmentFromTimeRange(
                    lo,
                    hi,
                    mediaDurationSec,
                    options?.overlapPolicy,
                  );
                  if (idx == null || idx < 0) return;
                  tx.focusSegmentAfterWaveformCreate(idx);
                }}
                onPlaySegment={(idx, fromSec) => void tx.playSegmentAtIndex(idx, { fromSec })}
                seekToTime={tx.seek}
                seekBlankToTime={tx.seekBlankToTime}
                suppressPlaybackFollowForSelectionSeek={tx.suppressPlaybackFollowForSelectionSeek}
              />
              <WaveformLiveTimeRuler
                viewportWidthPx={viewportWidthPx}
                durationSec={mediaDurationSec}
                timelineWidthPx={tx.timelineWidthPx}
                {...tierScrollProps}
                isPlaying={tx.isPlaying}
                isReady={tx.isReady}
                currentTimeSec={tx.currentTime}
                getDisplayPlayheadTimeSec={tx.getDisplayPlayheadTimeSec}
                subscribePlayheadFrame={tx.subscribePlayheadFrame}
                formatMediaTime={tx.formatMediaTime}
                disabled={stripDisabled}
                onCenterTierAtClientX={tx.centerTierAtClientX}
                onSetScrollLeftPx={tx.userScrubScroll}
              />
            </CspLayout>
            <WaveformSegmentPlaybackControls
              disabled={stripDisabled}
              fileId={c.currentFileId}
              segments={c.segments}
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
            {/*
              Same zero-height absolute + scroll-pin pattern as the wave layer.
              h-0 avoids consuming in-flow height inside the fixed-height shell.
            */}
            <CspLayout
              ref={tx.waveformStickyShellRef}
              className={`pointer-events-none absolute left-0 top-0 z-[10] h-0 overflow-visible ${WAVEFORM_TIER_VIEWPORT_WIDTH_CLASS}`}
              layout={{
                [WAVEFORM_TIER_VIEWPORT_WIDTH_VAR]:
                  viewportWidthPx > 0 ? `${viewportWidthPx}px` : undefined,
                width: viewportWidthPx > 0 ? viewportWidthPx : undefined,
              }}
            >
              <CspLayout className="relative overflow-hidden" layout={{ height: peaksPaneHeightPx }}>
                <WaveformViewportPlayhead
                  durationSec={mediaDurationSec}
                  timelineWidthPx={tx.timelineWidthPx}
                  {...tierScrollProps}
                  isPlaying={tx.isPlaying}
                  isReady={tx.isReady}
                  currentTimeSec={tx.currentTime}
                  getDisplayPlayheadTimeSec={tx.getDisplayPlayheadTimeSec}
                  subscribePlayheadFrame={tx.subscribePlayheadFrame}
                  playbackFollowMode={tx.playbackScrollFollowMode}
                  playheadChromeMode={tx.playheadChromeMode}
                />
              </CspLayout>
            </CspLayout>
          </CspLayout>
        </div>
      </div>
    </CspLayout>
  );
}, editorWaveformPanePropsEqual);

