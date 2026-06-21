import { useSyncExternalStore } from "react";
import {
  resolveWaveformSelectionChromeView,
  type WaveformSelectionChromeReactInput,
  type WaveformSelectionChromeView,
} from "../services/selection/resolveWaveformSelectionChromeView";
import {
  getSelectionChromeSnapshot,
  subscribeSelectionChrome,
} from "../services/selection/selectionChromeStore";

export function useWaveformSelectionChromeView(
  input: WaveformSelectionChromeReactInput,
): WaveformSelectionChromeView {
  const version = useSyncExternalStore(
    subscribeSelectionChrome,
    () => getSelectionChromeSnapshot().version,
    () => 0,
  );
  void version;
  return resolveWaveformSelectionChromeView(input);
}
