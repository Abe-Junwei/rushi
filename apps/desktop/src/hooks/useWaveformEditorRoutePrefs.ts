import { useCallback, useSyncExternalStore } from "react";
import {
  readStoredWaveformMinimapEnabled,
  readStoredWaveformPlaybackScrollFollowMode,
  subscribeWaveformPrefs,
  WAVEFORM_HOT_SWITCH_WHILE_PLAYING,
  writeStoredWaveformMinimapEnabled,
  writeStoredWaveformPlaybackScrollFollowMode,
} from "../utils/waveformPrefs";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";

export function useWaveformEditorRoutePrefs() {
  const minimapEnabled = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredWaveformMinimapEnabled,
    readStoredWaveformMinimapEnabled,
  );
  const playbackScrollFollowMode = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredWaveformPlaybackScrollFollowMode,
    readStoredWaveformPlaybackScrollFollowMode,
  );

  const setMinimapEnabled = useCallback((enabled: boolean) => {
    writeStoredWaveformMinimapEnabled(enabled);
  }, []);

  const setPlaybackScrollFollowMode = useCallback((mode: WaveformPlaybackScrollFollowMode) => {
    writeStoredWaveformPlaybackScrollFollowMode(mode);
  }, []);

  return {
    hotSwitchWhilePlaying: WAVEFORM_HOT_SWITCH_WHILE_PLAYING,
    minimapEnabled,
    setMinimapEnabled,
    playbackScrollFollowMode,
    setPlaybackScrollFollowMode,
  };
}
