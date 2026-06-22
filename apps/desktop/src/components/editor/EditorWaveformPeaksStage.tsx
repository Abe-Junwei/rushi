import { useCallback, useState } from "react";
import { CspLayout } from "../CspLayout";
import { WaveformLiveTimeRuler } from "../WaveformLiveTimeRuler";
import { WaveformViewportPlayhead } from "../WaveformViewportPlayhead";
import { WAVEFORM_EMBEDDED_RULER_HEIGHT_PX } from "../../services/waveform/drawWaveformTimeRuler";
import { WaveformSegmentPlaybackControls } from "../WaveformSegmentPlaybackControls";
import { WaveformSegmentBandCanvas } from "../WaveformSegmentBandCanvas";
import { WaveformSegmentOverlay } from "../WaveformSegmentOverlay";
import { clampSegmentTimeBounds } from "../../utils/waveformSegmentBounds";
import {
  WAVEFORM_TIER_VIEWPORT_WIDTH_CLASS,
  WAVEFORM_TIER_VIEWPORT_WIDTH_VAR,
} from "../../utils/waveformViewport";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";

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
  filterExcludesPrimary?: boolean;
};

export function EditorWaveformPeaksStage({
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
  filterExcludesPrimary = false,
}: Props) {
  const selectedSegment = c.segments[c.selectedIdx] ?? null;
  const mediaDurationSec = tx.mediaDurationSec;
  const rulerHeightPx = WAVEFORM_EMBEDDED_RULER_HEIGHT_PX;
  const [overlayDraftIdx, setOverlayDraftIdx] = useState<number | null>(null);
  const onOverlayDraftIdxChange = useCallback((idx: number | null) => {
    setOverlayDraftIdx(idx);
  }, []);

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
      {tx.peaksError && !tx.loadError ? (
        <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-body text-zen-cinnabar">
          波形生成失败：{tx.peaksError}
        </p>
      ) : null}
      <div className="relative h-full bg-transparent">
        <div
          ref={tx.waveformShellRef}
          tabIndex={0}
          className="relative z-0 h-full outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-action/40"
          onClick={() => tx.focusWaveformShell()}
        >
          <CspLayout ref={tx.waveformTimelineShellRef} className="relative" layout={{ height: peaksPaneHeightPx }}>
            <CspLayout
              className="waveform-timeline-wave-layer absolute left-0 top-0 z-[1] h-full"
              layout={{ width: tx.timelineWidthPx }}
            >
              <CspLayout
                className={waveSurferPreviewLayerClass}
                layout={{
                  height: waveformHeightPreviewActive ? peaksPaintedHeightPx : "100%",
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
                onSelectSegmentIndices={(indices, primaryIdx) => tx.selectSegmentIndices(indices, primaryIdx)}
                getSelectedIndices={() => c.selectedIndices}
                isIndexInSelection={c.isIndexInSelection}
                selectedIndices={c.selectedIndices}
                onClearMultiSelection={c.clearMultiSelection}
                isMultiSegmentSelection={() => c.isMultiSegmentSelection}
                onFocusWaveformShell={tx.focusWaveformShell}
                onBoundsCommit={(idx, startSec, endSec) => {
                  const clamped =
                    mediaDurationSec > 0
                      ? clampSegmentTimeBounds(startSec, endSec, mediaDurationSec)
                      : { startSec, endSec };
                  c.updateSegmentBounds(idx, clamped.startSec, clamped.endSec, "commit");
                }}
                onCreateRange={(lo, hi, options) => {
                  const idx = c.insertSegmentFromTimeRange(
                    lo,
                    hi,
                    mediaDurationSec,
                    options?.overlapPolicy,
                  );
                  if (idx == null || idx < 0) return;
                  requestAnimationFrame(() => {
                    tx.selectSegmentAt(idx, "waveform");
                    requestAnimationFrame(() => tx.focusSegmentTextarea(idx));
                  });
                }}
                onPlaySegment={(idx) => void tx.playSegmentAtIndex(idx)}
                seekToTime={tx.seek}
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
            <CspLayout
              ref={tx.waveformStickyShellRef}
              className={`pointer-events-none sticky left-0 top-0 z-[10] h-full overflow-hidden ${WAVEFORM_TIER_VIEWPORT_WIDTH_CLASS}`}
              layout={{
                [WAVEFORM_TIER_VIEWPORT_WIDTH_VAR]: viewportWidthPx > 0 ? `${viewportWidthPx}px` : undefined,
                height: peaksPaneHeightPx,
              }}
            >
              <div className="relative h-full w-full">
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
                />
              </div>
            </CspLayout>
          </CspLayout>
        </div>
      </div>
    </CspLayout>
  );
}

