import { useSyncExternalStore } from "react";
import {
  resolveWaveformSelectionChromeView,
  type WaveformSelectionChromeReactInput,
  type WaveformSelectionChromeView,
} from "../services/selection/resolveWaveformSelectionChromeView";
import {
  getTranscriptProjectionSnapshot,
  subscribeTranscriptProjection,
} from "../components/editor/core/transcriptProjection";

function projectionVersion(): string {
  const proj = getTranscriptProjectionSnapshot();
  return `${proj.primaryIdx}:${proj.metaVersion}:${proj.selectedSet.size}`;
}

export function useWaveformSelectionChromeView(
  input: WaveformSelectionChromeReactInput,
): WaveformSelectionChromeView {
  const version = useSyncExternalStore(
    subscribeTranscriptProjection,
    projectionVersion,
    () => "0",
  );
  void version;
  return resolveWaveformSelectionChromeView(input);
}
