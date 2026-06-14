import { useCallback, useState } from "react";
import {
  readStoredWaveformMinimapEnabled,
  readStoredWaveformPlaybackScrollFollowMode,
  WAVEFORM_HOT_SWITCH_WHILE_PLAYING,
  writeStoredWaveformMinimapEnabled,
  writeStoredWaveformPlaybackScrollFollowMode,
} from "../utils/waveformPrefs";
import type { WaveformPlaybackScrollFollowMode } from "../utils/waveformPlaybackScrollFollow";

export function useWaveformEditorRoutePrefs() {
  const [minimapEnabled, setMinimapEnabledState] = useState(() => readStoredWaveformMinimapEnabled());
  const [playbackScrollFollowMode, setPlaybackScrollFollowModeState] = useState(
    () => readStoredWaveformPlaybackScrollFollowMode(),
  );

  const setMinimapEnabled = useCallback((enabled: boolean) => {
    setMinimapEnabledState(enabled);
    writeStoredWaveformMinimapEnabled(enabled);
  }, []);

  const setPlaybackScrollFollowMode = useCallback((mode: WaveformPlaybackScrollFollowMode) => {
    setPlaybackScrollFollowModeState(mode);
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
