import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";

/** SC1-only controller churn must not repaint waveform pane / workbench shell. */
export function projectControllerShellRenderEqual(
  prev: ProjectControllerApi,
  next: ProjectControllerApi,
): boolean {
  if (prev.busy !== next.busy) return false;
  if (prev.currentFileId !== next.currentFileId) return false;
  if (prev.segments !== next.segments) return false;
  if (prev.segments.length !== next.segments.length) return false;
  if (prev.updateSegmentBounds !== next.updateSegmentBounds) return false;
  if (prev.insertSegmentFromTimeRange !== next.insertSegmentFromTimeRange) return false;
  if (prev.isIndexInSelection !== next.isIndexInSelection) return false;
  if (prev.clearMultiSelection !== next.clearMultiSelection) return false;
  return true;
}

/** Transcription layer fields that affect waveform pane / peaks shell (not SC1 / playhead frame). */
export function transcriptionLayerWaveformShellRenderEqual(
  prev: TranscriptionLayerApi,
  next: TranscriptionLayerApi,
): boolean {
  if (prev.isReady !== next.isReady) return false;
  if (prev.loadError !== next.loadError) return false;
  if (prev.peaksError !== next.peaksError) return false;
  if (prev.isPlaying !== next.isPlaying) return false;
  if (prev.isSelectedSegmentPlaying !== next.isSelectedSegmentPlaying) return false;
  if (prev.segmentLoopPlayback !== next.segmentLoopPlayback) return false;
  if (prev.mediaDurationSec !== next.mediaDurationSec) return false;
  if (prev.timelineWidthPx !== next.timelineWidthPx) return false;
  if (prev.waveformStageHeightPx !== next.waveformStageHeightPx) return false;
  if (prev.waveformHeightPx !== next.waveformHeightPx) return false;
  if (prev.waveformPaintedHeightPx !== next.waveformPaintedHeightPx) return false;
  if (prev.waveformHeightDragging !== next.waveformHeightDragging) return false;
  if (prev.waveformPeaksPhase !== next.waveformPeaksPhase) return false;
  if (prev.mountDeferTimedOut !== next.mountDeferTimedOut) return false;
  if (prev.minimapEnabled !== next.minimapEnabled) return false;
  if (prev.peaksLoading !== next.peaksLoading) return false;
  if (prev.peakCacheGeneration !== next.peakCacheGeneration) return false;
  if (prev.pxPerSec !== next.pxPerSec) return false;
  if (prev.playbackScrollFollowMode !== next.playbackScrollFollowMode) return false;
  if (prev.tierScrollLayout.scrollLeftPx !== next.tierScrollLayout.scrollLeftPx) return false;
  if (prev.tierScrollLayout.clientWidthPx !== next.tierScrollLayout.clientWidthPx) return false;
  if (prev.segmentLaneLayout.laneCount !== next.segmentLaneLayout.laneCount) return false;
  if (prev.segmentLaneLayout.laneByIndex !== next.segmentLaneLayout.laneByIndex) return false;
  if (prev.segmentLaneLayout.dominantSpanIndices !== next.segmentLaneLayout.dominantSpanIndices) return false;
  if (prev.beginWaveformHeightDrag !== next.beginWaveformHeightDrag) return false;
  if (prev.focusWaveformShell !== next.focusWaveformShell) return false;
  if (prev.openSegmentContextMenuFromPointer !== next.openSegmentContextMenuFromPointer) return false;
  if (prev.selectSegmentAt !== next.selectSegmentAt) return false;
  if (prev.dispatchWaveformSelectionGesture !== next.dispatchWaveformSelectionGesture) return false;
  if (prev.selectSegmentIndices !== next.selectSegmentIndices) return false;
  if (prev.seek !== next.seek) return false;
  if (prev.playSegmentAtIndex !== next.playSegmentAtIndex) return false;
  if (prev.handleToggleSelectedWaveformLoop !== next.handleToggleSelectedWaveformLoop) return false;
  if (prev.handleToggleSelectedWaveformPlay !== next.handleToggleSelectedWaveformPlay) return false;
  if (prev.centerTierAtClientX !== next.centerTierAtClientX) return false;
  if (prev.userScrubScroll !== next.userScrubScroll) return false;
  if (prev.minimapScrubScroll !== next.minimapScrubScroll) return false;
  if (prev.exportMinimapPeaks !== next.exportMinimapPeaks) return false;
  if (prev.formatMediaTime !== next.formatMediaTime) return false;
  if (prev.getDisplayPlayheadTimeSec !== next.getDisplayPlayheadTimeSec) return false;
  if (prev.subscribePlayheadFrame !== next.subscribePlayheadFrame) return false;
  if (prev.clientXToTimeSec !== next.clientXToTimeSec) return false;
  if (prev.suppressPlaybackFollowForSelectionSeek !== next.suppressPlaybackFollowForSelectionSeek) return false;
  return true;
}

/** Workbench toolbar transport / zoom (not SC1). */
export function transcriptionLayerWorkbenchToolbarRenderEqual(
  prev: TranscriptionLayerApi,
  next: TranscriptionLayerApi,
): boolean {
  if (prev.isReady !== next.isReady) return false;
  if (prev.isPlaying !== next.isPlaying) return false;
  if (prev.mediaDurationSec !== next.mediaDurationSec) return false;
  if (prev.globalPlaybackRate !== next.globalPlaybackRate) return false;
  if (prev.playbackScrollFollowMode !== next.playbackScrollFollowMode) return false;
  if (prev.minimapEnabled !== next.minimapEnabled) return false;
  if (prev.pxPerSec !== next.pxPerSec) return false;
  if (prev.layoutIntent !== next.layoutIntent) return false;
  if (prev.tierScrollLayout.scrollLeftPx !== next.tierScrollLayout.scrollLeftPx) return false;
  if (prev.tierScrollLayout.clientWidthPx !== next.tierScrollLayout.clientWidthPx) return false;
  if (prev.togglePlay !== next.togglePlay) return false;
  if (prev.toggleGlobalPlay !== next.toggleGlobalPlay) return false;
  if (prev.setGlobalPlaybackRate !== next.setGlobalPlaybackRate) return false;
  if (prev.setPlaybackScrollFollowMode !== next.setPlaybackScrollFollowMode) return false;
  if (prev.setMinimapEnabled !== next.setMinimapEnabled) return false;
  if (prev.zoomToFitSelection !== next.zoomToFitSelection) return false;
  if (prev.zoomToFitAll !== next.zoomToFitAll) return false;
  if (prev.resetZoomForMedia !== next.resetZoomForMedia) return false;
  if (prev.setPxPerSecFromSlider !== next.setPxPerSecFromSlider) return false;
  if (prev.formatMediaTime !== next.formatMediaTime) return false;
  if (prev.getDisplayPlayheadTimeSec !== next.getDisplayPlayheadTimeSec) return false;
  if (prev.subscribePlayheadFrame !== next.subscribePlayheadFrame) return false;
  return true;
}

export function editorWaveformPanePropsEqual(
  prev: { controller: ProjectControllerApi; tx: TranscriptionLayerApi },
  next: { controller: ProjectControllerApi; tx: TranscriptionLayerApi },
): boolean {
  return (
    projectControllerShellRenderEqual(prev.controller, next.controller) &&
    transcriptionLayerWaveformShellRenderEqual(prev.tx, next.tx)
  );
}
