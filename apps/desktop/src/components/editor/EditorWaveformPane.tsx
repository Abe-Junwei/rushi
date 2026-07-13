import { memo } from "react";
import { ResizeBottomHit } from "../ResizeBottomHit";
import { WaveformMinimapStrip } from "../WaveformMinimapStrip";
import { CspLayout } from "../CspLayout";
import { resolveWaveformCenterStatusLabel } from "../../services/waveform/waveformRenderStatus";
import { resolveTierViewportMetrics } from "../../utils/waveformViewport";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { EditorWaveformPeaksStage } from "./EditorWaveformPeaksStage";
import { resolveEditorWaveformPaneMetrics } from "./editorWaveformPaneMetrics";
import { editorWaveformPanePropsEqual } from "./editorShellRenderCompare";

interface EditorWaveformPaneProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
}

export const EditorWaveformPane = memo(function EditorWaveformPane({
  controller: c,
  tx,
}: EditorWaveformPaneProps) {
  const tierViewport = resolveTierViewportMetrics({
    tierScrollEl: tx.tierScrollRef.current,
    tierScrollLive: tx.tierScrollLive,
    tierScrollLayout: tx.tierScrollLayout,
  });
  const { viewportWidthPx } = tierViewport;
  const tierScrollProps = {
    tierScrollRef: tx.tierScrollRef,
    tierScrollLive: tx.tierScrollLive,
    tierScrollLayout: tx.tierScrollLayout,
  };

  const waveformStageHeightPx = tx.waveformStageHeightPx;
  const {
    peaksPaneHeightPx,
    segmentLayoutHeightPx,
    waveformVerticalTransform,
    waveSurferPreviewLayerClass,
    waveformHeightPreviewActive,
  } = resolveEditorWaveformPaneMetrics(tx);
  const stripDisabled = c.busy || !tx.isReady;
  const centerStatusLabel = resolveWaveformCenterStatusLabel({
    phase: tx.waveformPeaksPhase,
    mountDeferTimedOut: tx.mountDeferTimedOut,
    waveformReady: tx.isReady,
    peaksError: tx.peaksError,
    peakCache: tx.peakCache,
    mediaDurationSec: tx.mediaDurationSec,
  });
  const centerStatusIsError = Boolean(tx.peaksError);

  return (
    <div className="relative z-10 flex w-full shrink-0 flex-col overflow-hidden bg-notion-sidebar">
      {/*
        Status overlay sits on the non-scrolling shell so long timelines keep the
        tip centered in the visible viewport (not the full scroll content width).
      */}
      <div className="relative w-full shrink-0">
        {centerStatusLabel ? (
          <div
            className="waveform-center-status pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
            aria-live="polite"
          >
            <p
              className={
                centerStatusIsError
                  ? "max-w-[min(36rem,90%)] rounded-md border border-zen-cinnabar/30 bg-zen-cinnabar/10 px-3 py-2 text-center text-body text-zen-cinnabar shadow-none"
                  : "rounded-md border border-notion-border bg-notion-sidebar-active/95 px-3 py-2 text-body text-notion-text-muted shadow-none"
              }
            >
              {centerStatusLabel}
            </p>
          </div>
        ) : null}
        <CspLayout
          ref={tx.tierScrollRef}
          layout={{ "--waveform-stage-height": `${waveformStageHeightPx}px` }}
          className="relative w-full shrink-0 overflow-x-auto overflow-y-hidden bg-notion-sidebar waveform-tier-scroll-fallback [overflow-anchor:none]"
        >
          <div
            ref={tx.waveformPeaksStageShellRef}
            className={`relative z-[1] inline-block min-h-full align-top ${c.busy ? "pointer-events-none opacity-60" : ""}`}
          >
            <EditorWaveformPeaksStage
              controller={c}
              tx={tx}
              viewportWidthPx={viewportWidthPx}
              peaksPaneHeightPx={peaksPaneHeightPx}
              peaksPaintedHeightPx={Math.max(1, tx.waveformPaintedHeightPx)}
              segmentLayoutHeightPx={segmentLayoutHeightPx}
              waveformVerticalTransform={waveformVerticalTransform}
              waveSurferPreviewLayerClass={waveSurferPreviewLayerClass}
              waveformHeightPreviewActive={waveformHeightPreviewActive}
              stripDisabled={stripDisabled}
              tierScrollProps={tierScrollProps}
            />
            <ResizeBottomHit
              busy={c.busy}
              ariaLabel="拖动下边缘调节波形高度"
              onPointerDown={tx.beginWaveformHeightDrag}
            />
          </div>
        </CspLayout>
      </div>

      {tx.minimapEnabled ? (
        <WaveformMinimapStrip
          disabled={stripDisabled}
          durationSec={tx.mediaDurationSec}
          timelineWidthPx={tx.timelineWidthPx}
          {...tierScrollProps}
          pxPerSec={tx.pxPerSec}
          peakCache={tx.peakCache}
          peakCacheGeneration={tx.peakCacheGeneration}
          peaksLoading={tx.peaksLoading}
          isReady={tx.isReady}
          exportMinimapPeaks={tx.exportMinimapPeaks}
          currentTimeSec={tx.currentTime}
          getDisplayPlayheadTimeSec={tx.getDisplayPlayheadTimeSec}
          subscribePlayheadFrame={tx.subscribePlayheadFrame}
          isPlaying={tx.isPlaying}
          onSeek={tx.seekBlankToTime}
          onSetScrollLeftPx={tx.minimapScrubScroll}
          playheadChromeMode={tx.playheadChromeMode}
        />
      ) : null}
    </div>
  );
}, editorWaveformPanePropsEqual);
