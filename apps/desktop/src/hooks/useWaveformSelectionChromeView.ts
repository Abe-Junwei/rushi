import { useSyncExternalStore } from "react";
import {
  resolveWaveformSelectionChromeView,
  type WaveformSelectionChromeReactInput,
  type WaveformSelectionChromeView,
} from "../services/selection/resolveWaveformSelectionChromeView";
import {
  getTranscriptProjectionSnapshot,
  subscribeTranscriptSelectionProjection,
} from "../components/editor/core/transcriptProjection";

function projectionVersion(): string {
  const proj = getTranscriptProjectionSnapshot();
  return `${proj.primaryIdx}:${proj.selectionVersion}:${proj.selectedSet.size}`;
}

export function useWaveformSelectionChromeView(
  input: WaveformSelectionChromeReactInput,
): WaveformSelectionChromeView {
  const version = useSyncExternalStore(
    subscribeTranscriptSelectionProjection,
    projectionVersion,
    () => "0",
  );
  void version;
  return resolveWaveformSelectionChromeView(input);
}
