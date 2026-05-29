import { ResizeBottomHit } from "../ResizeBottomHit";
import { WaveformLiveTimeRuler } from "../WaveformLiveTimeRuler";
import { WaveformPeaksTileLayer } from "../WaveformPeaksTileLayer";
import { WaveformProgressOverlay } from "../WaveformProgressOverlay";
import { WaveformGlobalPlaybackSpeed } from "../WaveformGlobalPlaybackSpeed";
import { WaveformGoToTime } from "../WaveformGoToTime";
import { WaveformPlaybackTime } from "../WaveformPlaybackTime";
import { WaveformSegmentPlaybackControls } from "../WaveformSegmentPlaybackControls";
import { WaveformSegmentOverlay } from "../WaveformSegmentOverlay";
import { WaveformOverviewStrip } from "../WaveformOverviewStrip";
import { WaveformGlobalStripShell } from "../WaveformGlobalStripShell";
import { WaveformZoomBar } from "../WaveformZoomBar";
import { WAVEFORM_GLOBAL_STRIP_HEIGHT_PX } from "../../utils/waveformViewMode";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { resolveWaveformPeaksUiState, waveformPeaksStatusMessage } from "../../utils/peakMediaDuration";
import { resolveSegmentIndexAtWaveformPointer } from "../../utils/waveformSegmentBounds";

interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}

interface EditorWaveformPaneProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
}

export function EditorWaveformPane({
  controller: c,
  tx,
  onOpenSegmentContextMenu,
}: EditorWaveformPaneProps) {
  const selectedSegment = c.segments[c.selectedIdx] ?? null;
  const scrollLeftPx = tx.tierScrollLayout.scrollLeftPx;
  const clientWidthPx = tx.tierScrollLayout.clientWidthPx;

  const waveformStageHeightPx = tx.waveformStageHeightPx;
  const innerWaveformHeightPx = tx.waveformHeightPx;
  const innerPaintedHeightPx = tx.waveformPaintedHeightPx;
  const waveformVisualScale =
    tx.waveformPaintedHeightPx > 0 ? tx.waveformHeightPx / tx.waveformPaintedHeightPx : 1;
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
  const progressTimeSec = tx.isPlaying && tx.isReady ? tx.getPlayheadTime() : tx.currentTime;
  const peaksUiState = resolveWaveformPeaksUiState({
    peakCache: tx.peakCache,
    peaksLoading: tx.peaksLoading,
    peaksError: tx.peaksError,
    layoutMediaDurationSec: tx.duration,
    peakDurationSec: tx.peakCache?.durationSec ?? 0,
  });
  const peaksStatusMessage = waveformPeaksStatusMessage(peaksUiState, tx.peaksError);
  const drawMediaDurationSec =
    tx.peaksDrawMediaDurationSec > 0 ? tx.peaksDrawMediaDurationSec : tx.duration;

  return (
    <div className="relative z-10 flex w-full shrink-0 flex-col overflow-visible bg-notion-sidebar">
      <div
        ref={tx.tierScrollRef}
        onScroll={tx.onTierScroll}
        style={{ height: waveformStageHeightPx }}
        className="relative w-full shrink-0 overflow-x-auto overflow-y-hidden [overflow-anchor:none]"
      >
        <div
          style={{ width: tx.timelineWidthPx }}
          className={`relative z-[1] inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <div
            style={{ height: waveformStageHeightPx }}
            className="relative overflow-hidden"
            onContextMenu={(e) => {
              if (c.busy) return;
              e.preventDefault();
              const t = tx.clientXToTimeSec(e.clientX);
              const overlayEl = e.currentTarget.querySelector<HTMLElement>(".waveform-segment-overlay");
              const overlayTop = overlayEl?.getBoundingClientRect().top ?? e.clientY;
              const segmentIdx = resolveSegmentIndexAtWaveformPointer({
                segments: c.segments,
                timeSec: t,
                pointerClientY: e.clientY,
                overlayClientTop: overlayTop,
                layoutHeightPx: tx.waveformPaintedHeightPx,
                laneByIndex: tx.segmentLaneLayout.laneByIndex,
                laneCount: tx.segmentLaneLayout.laneCount,
                selectedIdx: c.selectedIdx,
              });
              if (segmentIdx < 0) return;
              onOpenSegmentContextMenu({ x: e.clientX, y: e.clientY, segmentIdx, pointerTimeSec: t });
            }}
          >
            {tx.loadError ? (
              <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-[12px] text-zen-cinnabar">
                {tx.loadError}
              </p>
            ) : null}
            {peaksStatusMessage && peaksUiState === "error" ? (
              <p className="absolute inset-x-4 top-14 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-[12px] text-zen-cinnabar">
                {peaksStatusMessage}
              </p>
            ) : null}
            {peaksUiState === "loading" ? (
              <p className="absolute inset-x-4 top-14 z-30 rounded-md bg-notion-sidebar-active/80 px-3 py-2 text-center text-[12px] text-notion-text/50">
                正在更新波形…
              </p>
            ) : null}

            <div className="relative flex h-full flex-col overflow-x-hidden bg-transparent">
              <div
                ref={tx.waveformShellRef}
                tabIndex={0}
                className="relative z-0 flex-1 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40"
                onKeyDown={tx.onWaveformMainKeyDown}
                onClick={() => tx.focusWaveformShell()}
              >
                <div className="w-full overflow-hidden" style={{ height: innerWaveformHeightPx }}>
                  <div
                    className={waveformVerticalClass}
                    style={{
                      width: tx.timelineWidthPx,
                      height: innerPaintedHeightPx,
                      transform: waveformVerticalTransform,
                    }}
                  >
                    <div
                      className="relative h-full w-full origin-top-left"
                      style={{
                        width: tx.timelineWidthPx,
                        height: innerPaintedHeightPx,
                      }}
                    >
                      <WaveformPeaksTileLayer
                        peakCache={tx.peakCache}
                        layoutPxPerSec={tx.layoutPxPerSec}
                        drawPxPerSec={tx.drawPxPerSec}
                        layoutTimelineWidthPx={tx.timelineWidthPx}
                        drawTimelineWidthPx={tx.drawTimelineWidthPx}
                        mediaDurationSec={drawMediaDurationSec}
                        peaksLoading={tx.peaksLoading}
                        heightPx={innerWaveformHeightPx}
                        scrollLeftPx={scrollLeftPx}
                        viewportWidthPx={clientWidthPx}
                      />
                      <WaveformProgressOverlay
                        isPlaying={tx.isPlaying}
                        durationSec={tx.duration}
                        timelineWidthPx={tx.timelineWidthPx}
                        currentTimeSec={tx.currentTime}
                        getPlayheadTime={tx.getPlayheadTime}
                      />
                      {tx.timelineWidthPx < clientWidthPx && (
                        <div className="pointer-events-none absolute top-0 z-0 bg-notion-sidebar/30" style={{ left: tx.timelineWidthPx, width: clientWidthPx - tx.timelineWidthPx, height: "100%" }} aria-hidden />
                      )}
                      <WaveformSegmentOverlay
                        disabled={stripDisabled} segments={c.segments} selectedIdx={c.selectedIdx}
                        pxPerSec={tx.pxPerSec} durationSec={tx.duration} layoutHeightPx={innerPaintedHeightPx}
                        laneByIndex={tx.segmentLaneLayout.laneByIndex} laneCount={tx.segmentLaneLayout.laneCount}
                        enableCreateRange clientXToTimeSec={tx.clientXToTimeSec}
                        onSelectSegmentAt={(idx) => tx.selectSegmentAt(idx, "waveform")}
                        onFocusWaveformShell={tx.focusWaveformShell}
                        onBoundsCommit={(idx, startSec, endSec) =>
                          c.updateSegmentBounds(idx, startSec, endSec, "commit")
                        }
                        onCreateRange={c.insertSegmentFromTimeRange}
                        onPlaySegment={(idx) => void tx.playSegmentAtIndex(idx)}
                        seekToTime={tx.seek}
                      />
                      <div
                        ref={tx.containerRef}
                        style={{ width: tx.timelineWidthPx, height: innerPaintedHeightPx }}
                        className="pointer-events-none relative z-0 shrink-0 bg-transparent"
                        role="img"
                        aria-label="转写波形与语段时间范围"
                      />
                      <WaveformSegmentPlaybackControls
                        disabled={stripDisabled}
                        isPlaying={tx.isPlaying}
                        pxPerSec={tx.pxPerSec}
                        scrollLeftPx={scrollLeftPx}
                        viewportWidthPx={clientWidthPx}
                        tierScrollRef={tx.tierScrollRef}
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
                <div className="absolute inset-x-0 bottom-0 z-10">
                  <WaveformLiveTimeRuler
                    appearance="embedded" durationSec={tx.duration} timelineWidthPx={tx.timelineWidthPx}
                    scrollLeftPx={scrollLeftPx} viewportWidthPx={clientWidthPx} pxPerSec={tx.pxPerSec}
                    rulerView={tx.rulerView} isPlaying={tx.isPlaying} isReady={tx.isReady}
                    getPlayheadTime={tx.getPlayheadTime} formatMediaTime={tx.formatMediaTime}
                    disabled={stripDisabled} onSeekFromTierClientX={tx.seekFromTierClientX}
                    onSetScrollLeftPx={tx.setTierScrollPx}
                  />
                </div>
              </div>
              <ResizeBottomHit
                busy={c.busy}
                ariaLabel="拖动下边缘调节波形高度"
                onPointerDown={tx.beginWaveformHeightDrag}
              />
            </div>
          </div>
        </div>
      </div>

      <WaveformGlobalStripShell
        collapsed={tx.globalStripCollapsed}
        disabled={stripDisabled}
        onToggleCollapsed={tx.toggleGlobalStripCollapsed}
      >
        {!tx.globalStripCollapsed ? (
          <WaveformOverviewStrip
            stripHeightPx={WAVEFORM_GLOBAL_STRIP_HEIGHT_PX} disabled={stripDisabled}
            isReady={tx.isReady} durationSec={tx.duration} drawMediaDurationSec={drawMediaDurationSec}
            peaksLoading={tx.peaksLoading} peaksError={tx.peaksError} pxPerSec={tx.pxPerSec}
            timelineWidthPx={tx.timelineWidthPx} scrollLeftPx={scrollLeftPx}
            mainViewportWidthPx={clientWidthPx} progressTimeSec={progressTimeSec}
            peakCache={tx.peakCache} segments={c.segments} selectedIdx={c.selectedIdx}
            setTierScrollPx={tx.setTierScrollPx} seekToTime={tx.seek}
            onSelectSegmentAt={(idx) => tx.selectSegmentAt(idx, "global-strip")}
          />
        ) : null}
      </WaveformGlobalStripShell>

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
              <span className="waveform-playback-pause" aria-hidden>
                <span />
                <span />
              </span>
            ) : (
              <span className="waveform-playback-play" aria-hidden />
            )}
          </button>
          <WaveformGlobalPlaybackSpeed
            disabled={c.busy || !tx.isReady}
            playbackRate={tx.globalPlaybackRate}
            onPlaybackRateChange={tx.setGlobalPlaybackRate}
          />
          <WaveformPlaybackTime
            isPlaying={tx.isPlaying}
            isReady={tx.isReady}
            durationSec={tx.duration}
            getPlayheadTime={tx.getPlayheadTime}
            formatMediaTime={tx.formatMediaTime}
          />
          <WaveformGoToTime
            disabled={c.busy || !tx.isReady}
            durationSec={tx.duration}
            onJump={tx.jumpToMediaTime}
          />
        </div>
        <WaveformZoomBar
          disabled={c.busy} isReady={tx.isReady} pxPerSec={tx.pxPerSec}
          viewportWidthPx={clientWidthPx} durationSec={tx.duration}
          selectedStartSec={selectedSegment?.start_sec} selectedEndSec={selectedSegment?.end_sec}
          onResetDefaultZoom={() => tx.resetZoomForMedia(clientWidthPx, tx.duration)}
          onPxPerSecChange={tx.setPxPerSecFromSlider}
          onZoomInteractionStart={tx.beginZoomInteraction}
          onZoomInteractionEnd={tx.commitZoomInteraction}
          editorHint={tx.editorHint}
        />
      </div>
    </div>
  );
}
