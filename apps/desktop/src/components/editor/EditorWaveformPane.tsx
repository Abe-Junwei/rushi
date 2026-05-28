import { ResizeBottomHit } from "../ResizeBottomHit";
import { WaveformLiveTimeRuler } from "../WaveformLiveTimeRuler";
import { WaveformPeaksCanvas } from "../WaveformPeaksCanvas";
import { WaveformPlaybackTime } from "../WaveformPlaybackTime";
import { WaveformSegmentPlaybackControls } from "../WaveformSegmentPlaybackControls";
import { WaveformZoomBar } from "../WaveformZoomBar";
import { useWaveformViewportMetrics } from "../../hooks/useWaveformViewportMetrics";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";

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
  const liveViewport = tx.isPlaying || tx.zoomDragging;
  const { scrollLeftPx, clientWidthPx } = useWaveformViewportMetrics(tx.tierScrollRef, liveViewport);
  const waveformStageHeightPx = tx.waveformHeightPx;
  const waveformVisualScale =
    tx.waveformPaintedHeightPx > 0 ? tx.waveformHeightPx / tx.waveformPaintedHeightPx : 1;
  const waveformHeightPreviewActive =
    Math.abs(waveformVisualScale - 1) > 0.001 && !tx.waveformHeightDragging;
  const waveformVerticalTransform =
    Math.abs(waveformVisualScale - 1) > 0.001 ? `scaleY(${waveformVisualScale})` : undefined;
  const waveformVerticalClass = tx.waveformHeightDragging
    ? "h-full w-full origin-top-left will-change-transform"
    : waveformHeightPreviewActive
      ? "h-full w-full origin-top-left will-change-transform transition-transform duration-150 ease-out motion-reduce:transition-none"
      : "h-full w-full origin-top-left";
  return (
    <div className="relative z-0 flex w-full shrink-0 flex-col overflow-hidden bg-notion-sidebar">
      <div
        ref={tx.tierScrollRef}
        onScroll={tx.onTierScroll}
        style={{ height: waveformStageHeightPx }}
        className="w-full shrink-0 overflow-x-auto overflow-y-hidden [overflow-anchor:none]"
      >
        <div
          style={{ width: tx.timelineWidthPx }}
          className={`inline-block align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
        >
          <div
            style={{ height: waveformStageHeightPx }}
            className="relative overflow-hidden bg-notion-sidebar"
            onContextMenu={(e) => {
              if (c.busy) return;
              e.preventDefault();
              const t = tx.clientXToTimeSec(e.clientX);
              const hit = c.segments.findIndex((s) => t >= s.start_sec && t <= s.end_sec);
              const segmentIdx =
                hit >= 0 ? hit : c.segments.length > 0 ? Math.min(c.selectedIdx, c.segments.length - 1) : 0;
              onOpenSegmentContextMenu({ x: e.clientX, y: e.clientY, segmentIdx, pointerTimeSec: t });
            }}
          >
            {tx.loadError ? (
              <p className="absolute inset-x-4 top-4 z-30 rounded-md bg-zen-cinnabar/10 px-3 py-2 text-center text-[12px] text-zen-cinnabar">
                {tx.loadError}
              </p>
            ) : null}

            <div className="relative flex h-full flex-col overflow-x-hidden bg-notion-sidebar">
              <div
                ref={tx.waveformShellRef}
                tabIndex={0}
                className="relative z-0 flex-1 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zen-saffron/40"
                onKeyDown={tx.onWaveformMainKeyDown}
                onClick={() => tx.focusWaveformShell()}
              >
                <div className="w-full overflow-hidden" style={{ height: tx.waveformHeightPx }}>
                  <div
                    className={waveformVerticalClass}
                    style={{
                      width: tx.timelineWidthPx,
                      height: tx.waveformPaintedHeightPx,
                      transform: waveformVerticalTransform,
                    }}
                  >
                    <div
                      className="relative h-full w-full origin-top-left"
                      style={{
                        width: tx.timelineWidthPx,
                        height: tx.waveformPaintedHeightPx,
                      }}
                    >
                      <WaveformPeaksCanvas
                        peakCache={tx.peakCache}
                        pxPerSec={tx.pxPerSec}
                        scrollLeftPx={scrollLeftPx}
                        viewportWidthPx={clientWidthPx}
                        heightPx={tx.waveformPaintedHeightPx}
                        progressTimeSec={
                          tx.isPlaying && tx.isReady ? tx.getPlayheadTime() : tx.currentTime
                        }
                        active={Boolean(tx.peakCache && tx.isReady)}
                      />
                      <div
                        ref={tx.containerRef}
                        style={{ width: tx.timelineWidthPx, height: tx.waveformPaintedHeightPx }}
                        className="relative z-[2] shrink-0 bg-transparent"
                        role="img"
                        aria-label="转写波形与语段时间范围"
                      />
                    </div>
                  </div>
                </div>
                <WaveformSegmentPlaybackControls
                  disabled={c.busy || !tx.isReady}
                  isPlaying={tx.isPlaying}
                  pxPerSec={tx.pxPerSec}
                  scrollLeftPx={scrollLeftPx}
                  viewportWidthPx={clientWidthPx}
                  selectedSegment={selectedSegment}
                  segmentPlaybackRate={tx.segmentPlaybackRate}
                  segmentLoopPlayback={tx.segmentLoopPlayback}
                  onPlaybackRateChange={tx.handleSegmentPlaybackRateChange}
                  onToggleLoop={() => void tx.handleToggleSelectedWaveformLoop()}
                  onTogglePlay={() => void tx.handleToggleSelectedWaveformPlay()}
                />
                <div className="absolute inset-x-0 bottom-0 z-10">
                  <WaveformLiveTimeRuler
                    appearance="embedded"
                    durationSec={tx.duration || 0}
                    timelineWidthPx={tx.timelineWidthPx}
                    scrollLeftPx={scrollLeftPx}
                    viewportWidthPx={clientWidthPx}
                    pxPerSec={tx.pxPerSec}
                    rulerView={tx.rulerView}
                    isPlaying={tx.isPlaying}
                    isReady={tx.isReady}
                    getPlayheadTime={tx.getPlayheadTime}
                    formatMediaTime={tx.formatMediaTime}
                    disabled={c.busy || !tx.isReady}
                    onSeekFromTierClientX={tx.seekFromTierClientX}
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
          <WaveformPlaybackTime
            isPlaying={tx.isPlaying}
            isReady={tx.isReady}
            durationSec={tx.duration || 0}
            getPlayheadTime={tx.getPlayheadTime}
            formatMediaTime={tx.formatMediaTime}
          />
        </div>
        <WaveformZoomBar
          disabled={c.busy}
          isReady={tx.isReady}
          pxPerSec={tx.pxPerSec}
          hasSelectionSegment={c.segments.length > 0}
          onZoomToFitAll={() => tx.zoomToFitTier()}
          onZoomToFitSelection={() => tx.zoomToFitSelection()}
          onResetDefaultZoom={() => tx.resetZoom()}
          onZoomIn={() => tx.zoomIn()}
          onZoomOut={() => tx.zoomOut()}
          onPxPerSecChange={tx.setPxPerSec}
          onZoomInteractionStart={tx.beginZoomInteraction}
          onZoomInteractionEnd={tx.commitZoomInteraction}
        />
      </div>
    </div>
  );
}
