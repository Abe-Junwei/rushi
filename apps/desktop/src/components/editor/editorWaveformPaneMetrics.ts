import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  resolveWaveformSegmentLayoutHeightPx,
  resolveWaveformVerticalScalePreview,
} from "../../utils/waveformViewport";

export function resolveEditorWaveformPaneMetrics(tx: TranscriptionLayerApi) {
  const innerWaveformHeightPx = tx.waveformHeightPx;
  const peaksPaneHeightPx = Math.max(1, innerWaveformHeightPx);
  const innerPaintedHeightPx = tx.waveformPaintedHeightPx;
  const peaksPaintedHeightPx = Math.max(1, innerPaintedHeightPx);
  const { active: waveformVerticalScaleActive, transform: waveformVerticalTransform } =
    resolveWaveformVerticalScalePreview(peaksPaneHeightPx, peaksPaintedHeightPx);
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

  return {
    peaksPaneHeightPx,
    peaksPaintedHeightPx,
    segmentLayoutHeightPx,
    waveformVerticalTransform,
    waveSurferPreviewLayerClass,
    waveformHeightPreviewActive,
  };
}
