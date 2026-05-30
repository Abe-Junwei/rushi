import { useCallback, useState } from "react";
import {
  readStoredBackgroundPeaksEnabled,
  readStoredPeaksHotSwitchWhilePlaying,
  readStoredWaveformMinimapEnabled,
  writeStoredBackgroundPeaksEnabled,
  writeStoredPeaksHotSwitchWhilePlaying,
  writeStoredWaveformMinimapEnabled,
} from "../utils/waveformPrefs";

export function useWaveformEditorRoutePrefs() {
  const [backgroundPeaksEnabled, setBackgroundPeaksEnabledState] = useState(
    () => readStoredBackgroundPeaksEnabled(),
  );
  const [minimapEnabled, setMinimapEnabledState] = useState(() => readStoredWaveformMinimapEnabled());
  const [hotSwitchWhilePlaying, setHotSwitchWhilePlayingState] = useState(
    () => readStoredPeaksHotSwitchWhilePlaying(),
  );

  const setBackgroundPeaksEnabled = useCallback((enabled: boolean) => {
    setBackgroundPeaksEnabledState(enabled);
    writeStoredBackgroundPeaksEnabled(enabled);
  }, []);

  const setMinimapEnabled = useCallback((enabled: boolean) => {
    setMinimapEnabledState(enabled);
    writeStoredWaveformMinimapEnabled(enabled);
  }, []);

  const setHotSwitchWhilePlaying = useCallback((enabled: boolean) => {
    setHotSwitchWhilePlayingState(enabled);
    writeStoredPeaksHotSwitchWhilePlaying(enabled);
  }, []);

  return {
    backgroundPeaksEnabled,
    setBackgroundPeaksEnabled,
    minimapEnabled,
    setMinimapEnabled,
    hotSwitchWhilePlaying,
    setHotSwitchWhilePlaying,
  };
}
