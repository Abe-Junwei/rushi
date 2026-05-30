import { useCallback, useState } from "react";
import {
  readStoredWaveformMinimapEnabled,
  WAVEFORM_BACKGROUND_PEAKS_ENABLED,
  WAVEFORM_HOT_SWITCH_WHILE_PLAYING,
  writeStoredWaveformMinimapEnabled,
} from "../utils/waveformPrefs";

export function useWaveformEditorRoutePrefs() {
  const [minimapEnabled, setMinimapEnabledState] = useState(() => readStoredWaveformMinimapEnabled());

  const setMinimapEnabled = useCallback((enabled: boolean) => {
    setMinimapEnabledState(enabled);
    writeStoredWaveformMinimapEnabled(enabled);
  }, []);

  return {
    backgroundPeaksEnabled: WAVEFORM_BACKGROUND_PEAKS_ENABLED,
    hotSwitchWhilePlaying: WAVEFORM_HOT_SWITCH_WHILE_PLAYING,
    minimapEnabled,
    setMinimapEnabled,
  };
}
